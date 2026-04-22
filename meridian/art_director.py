"""Runs the Art Director as a single LLM call that curates the whole deck.

The AD picks one `recipe` from the 40-recipe Plot catalog (and optionally a
`secondary_recipe`) per slide and assigns one `narrative_tag` from the
14-tag vocabulary. Intentional repeats are allowed up to 2 per recipe.

Output: out/art_direction.json — a dict with `slides_storyboard` array.
"""

from __future__ import annotations

import asyncio
import json
import os
import re
from collections import Counter
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import httpx
import jsonschema
from dotenv import load_dotenv
from rich.console import Console
from rich.table import Table

from .openrouter import OpenRouterClient, text_block

load_dotenv()

ROOT = Path(__file__).resolve().parent.parent
console = Console()

_PLACEHOLDER_RE = re.compile(r"\{\{\s*([a-z_]+)\s*\}\}")


def _render(template: str, mapping: dict[str, str]) -> str:
    return _PLACEHOLDER_RE.sub(lambda m: mapping.get(m.group(1), ""), template)


def _strip_code_fences(text: str) -> str:
    s = text.strip()
    if s.startswith("```"):
        s = s.split("\n", 1)[1] if "\n" in s else s[3:]
        if s.lower().startswith("json"):
            s = s[4:].lstrip("\n")
        if s.endswith("```"):
            s = s[:-3]
    return s.strip()


def _load_prompts() -> tuple[str, str, dict[str, Any], str, str]:
    system = (ROOT / "prompts/art_director/system.md").read_text()
    user_tmpl = (ROOT / "prompts/art_director/user.md").read_text()
    schema = json.loads((ROOT / "prompts/art_director/response.schema.json").read_text())
    recipes = (ROOT / "prompts/shared/plot_recipes.md").read_text()
    narrative_tags = (ROOT / "prompts/shared/narrative_tags.md").read_text()
    return system, user_tmpl, schema, recipes, narrative_tags


@dataclass
class StoryboardResult:
    ok: bool
    body: dict[str, Any] | None
    error: str | None
    usage: dict[str, Any]
    raw_content: str
    reasoning: str | None


def _build_user_message(
    *,
    user_tmpl: str,
    enriched: dict[str, Any],
    plan: dict[str, Any] | None,
    branding: dict[str, Any],
    insights: list[dict[str, Any]],
    recipes: str,
    narrative_tags: str,
    target_slide_count: int,
) -> list[dict[str, Any]]:
    meta = (plan or {}).get("meta", {}) or {}
    plan_meta = plan or {}
    enriched_meta = enriched.get("_meta", {}) or {}
    company = enriched.get("company", {}) or {}
    shared_mapping = {
        "company_short_name": (
            meta.get("company_short_name")
            or company.get("short_name")
            or company.get("legal_name", "")
        ),
        "fiscal_year": str(
            meta.get("fiscal_year") or enriched_meta.get("fiscal_year", "")
        ),
        "report_thesis": plan_meta.get("report_thesis", ""),
        "running_motif": plan_meta.get("running_motif", ""),
        "branding_json": json.dumps(branding, ensure_ascii=False, indent=2),
        "style_notes_json": json.dumps(
            plan_meta.get("style_notes", {}), ensure_ascii=False, indent=2
        ),
        "plot_recipes": recipes,
        "narrative_tags": narrative_tags,
        "enriched_json": json.dumps(enriched, ensure_ascii=False),
        "insights_json": "__INSIGHTS_SPLIT__",
        "target_slide_count": str(target_slide_count),
    }
    rendered = _render(user_tmpl, shared_mapping)
    shared_part, _, tail = rendered.partition("__INSIGHTS_SPLIT__")
    insights_blob = json.dumps({"insights": insights}, ensure_ascii=False, indent=2) + tail
    return [
        text_block(shared_part, cache=True),
        text_block(insights_blob, cache=False),
    ]


async def _direct_deck(
    *,
    client_http: httpx.AsyncClient,
    or_client: OpenRouterClient,
    model: str,
    system_blocks: list[dict[str, Any]],
    user_tmpl: str,
    enriched: dict[str, Any],
    plan: dict[str, Any] | None,
    branding: dict[str, Any],
    insights: list[dict[str, Any]],
    recipes: str,
    narrative_tags: str,
    schema: dict[str, Any],
    max_tokens: int,
    reasoning_max_tokens: int | None,
    target_slide_count: int,
) -> StoryboardResult:
    user_blocks = _build_user_message(
        user_tmpl=user_tmpl,
        enriched=enriched,
        plan=plan,
        branding=branding,
        insights=insights,
        recipes=recipes,
        narrative_tags=narrative_tags,
        target_slide_count=target_slide_count,
    )
    try:
        result = await or_client.chat_async(
            client=client_http,
            model=model,
            system=system_blocks,
            user=user_blocks,
            max_tokens=max_tokens,
            reasoning_max_tokens=reasoning_max_tokens,
            response_json=True,
        )
    except Exception as e:  # noqa: BLE001
        return StoryboardResult(
            ok=False, body=None,
            error=f"http: {e}", usage={}, raw_content="", reasoning=None,
        )

    content = _strip_code_fences(result.content)
    try:
        body = json.loads(content)
    except json.JSONDecodeError as e:
        return StoryboardResult(
            ok=False, body=None,
            error=f"non-JSON: {e}", usage=result.usage,
            raw_content=result.content, reasoning=result.reasoning,
        )

    try:
        jsonschema.validate(body, schema)
        ok, err = True, None
    except jsonschema.ValidationError as e:
        path = "/".join(str(p) for p in e.absolute_path)
        ok, err = False, f"schema: {e.message} at /{path}"

    return StoryboardResult(
        ok=ok, body=body,
        error=err, usage=result.usage,
        raw_content=result.content, reasoning=result.reasoning,
    )


GEO_RECIPES = {"spike_map", "choropleth"}


def _has_geo_data(enriched: dict[str, Any]) -> int:
    """Return country count if enriched has a per-country array, else 0."""
    for key in ("geographic_presence_enriched", "geographic_presence"):
        rows = enriched.get(key)
        if isinstance(rows, list) and len(rows) >= 5:
            sample = rows[0] if rows else {}
            if isinstance(sample, dict) and any(
                k in sample for k in ("iso2", "iso3", "lat", "country")
            ):
                return len(rows)
    return 0


def _check_deck_rules(
    body: dict[str, Any], enriched: dict[str, Any] | None = None
) -> list[str]:
    """Post-schema checks the JSON schema cannot express."""
    issues: list[str] = []
    slides = body.get("slides_storyboard", [])
    ids = [s["id"] for s in slides]
    if len(set(ids)) != len(ids):
        issues.append("duplicate slide ids")

    used: list[str] = []
    for s in slides:
        used.append(s["recipe"])
        if s.get("secondary_recipe"):
            used.append(s["secondary_recipe"])
    distinct = len(set(used))
    if distinct < 10:
        issues.append(
            f"only {distinct} distinct recipes across {len(slides)} slides (need ≥10)"
        )
    counts = Counter(used)
    for r, n in counts.items():
        if n > 2:
            issues.append(f"recipe '{r}' used {n} times (cap is 2)")

    if enriched is not None:
        geo_n = _has_geo_data(enriched)
        if geo_n and not (GEO_RECIPES & set(used)):
            issues.append(
                f"enriched has {geo_n} country rows but no map recipe in deck "
                f"(require ≥1 of {sorted(GEO_RECIPES)})"
            )
    return issues


async def _run_async(
    *,
    insights: list[dict[str, Any]],
    enriched: dict[str, Any],
    plan: dict[str, Any] | None,
    model: str,
    output_dir: Path,
    max_tokens: int,
    reasoning_max_tokens: int | None,
    target_slide_count: int,
) -> StoryboardResult:
    system, user_tmpl, schema, recipes, narrative_tags = _load_prompts()
    system = _render(system, {"target_slide_count": str(target_slide_count)})
    system_blocks = [text_block(system, cache=True)]
    or_client = OpenRouterClient()
    branding = enriched.get("branding", {}) or {}

    console.log(
        f"art_director: [bold]{model}[/bold]  "
        f"insights={len(insights)}  single-call  "
        f"max_tokens={max_tokens}  reasoning={reasoning_max_tokens}"
    )

    timeout = httpx.Timeout(connect=30.0, read=1800.0, write=60.0, pool=30.0)
    async with httpx.AsyncClient(timeout=timeout) as http:
        result = await _direct_deck(
            client_http=http,
            or_client=or_client,
            model=model,
            system_blocks=system_blocks,
            user_tmpl=user_tmpl,
            enriched=enriched,
            plan=plan,
            branding=branding,
            insights=insights,
            recipes=recipes,
            narrative_tags=narrative_tags,
            schema=schema,
            max_tokens=max_tokens,
            reasoning_max_tokens=reasoning_max_tokens,
            target_slide_count=target_slide_count,
        )

    output_dir.mkdir(parents=True, exist_ok=True)
    briefs_dir = output_dir / "art_direction"
    briefs_dir.mkdir(parents=True, exist_ok=True)

    if result.body is not None:
        (output_dir / "art_direction.json").write_text(
            json.dumps(result.body, indent=2, ensure_ascii=False)
        )
    else:
        (briefs_dir / "storyboard.invalid.txt").write_text(result.raw_content or "")
    if result.reasoning:
        (briefs_dir / "storyboard.reasoning.md").write_text(result.reasoning)

    return result


def _print_summary(
    result: StoryboardResult, enriched: dict[str, Any] | None = None
) -> None:
    console.rule("[bold]Art Director v2")
    status = "[green]ok[/green]" if result.ok else "[red]fail[/red]"
    usage = result.usage or {}
    console.print(
        f"storyboard: {status}  "
        f"prompt={int(usage.get('prompt_tokens', 0) or 0):,}  "
        f"completion={int(usage.get('completion_tokens', 0) or 0):,}  "
        f"reasoning={int(usage.get('reasoning_tokens', 0) or 0):,}  "
        f"total={int(usage.get('total_tokens', 0) or 0):,}"
    )
    if result.error:
        console.print(f"[red]error:[/red] {result.error}")

    if not result.body:
        return

    slides = result.body.get("slides_storyboard", [])
    issues = _check_deck_rules(result.body, enriched)
    used: list[str] = []
    for s in slides:
        used.append(s["recipe"])
        if s.get("secondary_recipe"):
            used.append(s["secondary_recipe"])
    distinct = len(set(used))
    console.print(
        f"slides: {len(slides)}  distinct recipes: {distinct}  "
        + ("[green]rules ok[/green]" if not issues else f"[yellow]{len(issues)} issue(s)[/yellow]")
    )
    for i in issues:
        console.print(f"  [yellow]•[/yellow] {i}")

    t = Table(show_lines=False)
    t.add_column("id")
    t.add_column("recipe")
    t.add_column("2nd")
    t.add_column("tag")
    t.add_column("headline", overflow="fold")
    for s in slides:
        hl = s.get("headline", "")
        t.add_row(
            s.get("id", ""),
            s.get("recipe", ""),
            s.get("secondary_recipe", "") or "",
            s.get("narrative_tag", ""),
            (hl[:80] + "…") if len(hl) > 80 else hl,
        )
    console.print(t)


def run_art_direction(
    *,
    insights_path: Path,
    enriched_path: Path,
    plan_path: Path | None,
    model: str,
    output_dir: Path,
    max_tokens: int = 28000,
    reasoning_max_tokens: int | None = 4000,
    target_slide_count: int = 10,
) -> StoryboardResult:
    insights_data = json.loads(insights_path.read_text())
    insights = insights_data.get("insights", [])
    enriched = json.loads(enriched_path.read_text())
    plan = json.loads(plan_path.read_text()) if plan_path and plan_path.exists() else None
    output_dir.mkdir(parents=True, exist_ok=True)

    result = asyncio.run(
        _run_async(
            insights=insights,
            enriched=enriched,
            plan=plan,
            model=model,
            output_dir=output_dir,
            max_tokens=max_tokens,
            reasoning_max_tokens=reasoning_max_tokens,
            target_slide_count=target_slide_count,
        )
    )
    _print_summary(result, enriched)
    return result


def main() -> None:
    from .config import load_config
    cfg = load_config()
    out = ROOT / "out"
    run_art_direction(
        insights_path=out / "insights.json",
        enriched_path=out / "enriched.json",
        plan_path=out / "planner.plan.json",
        model=cfg.art_director_model,
        output_dir=out,
        target_slide_count=cfg.target_slide_count,
    )


if __name__ == "__main__":
    main()
