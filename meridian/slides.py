"""Runs the Slide Designer LLM call, one call per storyboard entry, in parallel.

Each slide picks one `recipe` (40-slug enum from plot_recipes.md).
Consumes out/art_direction.json + out/enriched.json. Shared prefix
(system + enriched + recipes catalog + branding) is cached so N-1 calls
pay only the per-slide delta.
"""

from __future__ import annotations

import asyncio
import json
import os
import re
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import httpx
import jsonschema
from dotenv import load_dotenv
from rich.console import Console
from rich.table import Table

from .openrouter import OpenRouterClient, gather_limited, text_block

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
    system = (ROOT / "prompts/slide_designer/system.md").read_text()
    user_tmpl = (ROOT / "prompts/slide_designer/user.md").read_text()
    schema = json.loads((ROOT / "prompts/slide_designer/response.schema.json").read_text())
    recipes = (ROOT / "prompts/shared/plot_recipes.md").read_text()
    narrative_tags = (ROOT / "prompts/shared/narrative_tags.md").read_text()
    return system, user_tmpl, schema, recipes, narrative_tags


@dataclass
class SlideResult:
    slide_id: str
    recipe: str
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
    recipes: str,
    narrative_tags: str,
    storyboard_entry: dict[str, Any],
) -> list[dict[str, Any]]:
    """Split user into cacheable shared prefix and per-slide tail."""
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
        "storyboard_entry_json": "__STORYBOARD_SPLIT__",
    }
    rendered = _render(user_tmpl, shared_mapping)
    shared_part, _, tail = rendered.partition("__STORYBOARD_SPLIT__")
    entry_blob = json.dumps(storyboard_entry, ensure_ascii=False, indent=2) + tail
    return [
        text_block(shared_part, cache=True),
        text_block(entry_blob, cache=False),
    ]


async def _design_slide(
    *,
    client_http: httpx.AsyncClient,
    or_client: OpenRouterClient,
    model: str,
    system_blocks: list[dict[str, Any]],
    user_tmpl: str,
    enriched: dict[str, Any],
    plan: dict[str, Any] | None,
    branding: dict[str, Any],
    recipes: str,
    narrative_tags: str,
    storyboard_entry: dict[str, Any],
    schema: dict[str, Any],
    max_tokens: int,
    reasoning_max_tokens: int | None,
) -> SlideResult:
    sid = storyboard_entry["id"]
    recipe = storyboard_entry.get("recipe", "")
    user_blocks = _build_user_message(
        user_tmpl=user_tmpl,
        enriched=enriched,
        plan=plan,
        branding=branding,
        recipes=recipes,
        narrative_tags=narrative_tags,
        storyboard_entry=storyboard_entry,
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
        return SlideResult(
            slide_id=sid, recipe=recipe, ok=False, body=None,
            error=f"http: {e}", usage={}, raw_content="", reasoning=None,
        )

    content = _strip_code_fences(result.content)
    try:
        body = json.loads(content)
    except json.JSONDecodeError as e:
        return SlideResult(
            slide_id=sid, recipe=recipe, ok=False, body=None,
            error=f"non-JSON: {e}", usage=result.usage,
            raw_content=result.content, reasoning=result.reasoning,
        )

    try:
        jsonschema.validate(body, schema)
        ok, err = True, None
    except jsonschema.ValidationError as e:
        path = "/".join(str(p) for p in e.absolute_path)
        ok, err = False, f"schema: {e.message} at /{path}"

    # Recipe-lock: designer MUST match storyboard recipe
    if ok and body.get("recipe") != recipe:
        ok = False
        err = f"recipe mismatch: storyboard={recipe} slide={body.get('recipe')}"

    return SlideResult(
        slide_id=sid, recipe=recipe, ok=ok, body=body,
        error=err, usage=result.usage,
        raw_content=result.content, reasoning=result.reasoning,
    )


async def _run_async(
    *,
    storyboard: list[dict[str, Any]],
    enriched: dict[str, Any],
    plan: dict[str, Any] | None,
    model: str,
    output_dir: Path,
    concurrency: int,
    max_tokens: int,
    reasoning_max_tokens: int | None,
    only: set[str] | None,
) -> list[SlideResult]:
    system, user_tmpl, schema, recipes, narrative_tags = _load_prompts()
    system_blocks = [text_block(system, cache=True)]
    or_client = OpenRouterClient()
    branding = enriched.get("branding", {}) or {}

    if only:
        storyboard = [s for s in storyboard if s["id"] in only]

    console.log(
        f"slide_designer: [bold]{model}[/bold]  "
        f"slides={len(storyboard)}  concurrency={concurrency}  "
        f"max_tokens={max_tokens}  reasoning={reasoning_max_tokens}"
    )

    timeout = httpx.Timeout(connect=30.0, read=900.0, write=60.0, pool=30.0)
    async with httpx.AsyncClient(timeout=timeout) as http:
        coros = [
            _design_slide(
                client_http=http,
                or_client=or_client,
                model=model,
                system_blocks=system_blocks,
                user_tmpl=user_tmpl,
                enriched=enriched,
                plan=plan,
                branding=branding,
                recipes=recipes,
                narrative_tags=narrative_tags,
                storyboard_entry=entry,
                schema=schema,
                max_tokens=max_tokens,
                reasoning_max_tokens=reasoning_max_tokens,
            )
            for entry in storyboard
        ]
        results: list[SlideResult] = await gather_limited(coros, concurrency=concurrency)

    slides_dir = output_dir / "slides"
    slides_dir.mkdir(parents=True, exist_ok=True)
    for r in results:
        if r.body is not None:
            (slides_dir / f"{r.slide_id}.json").write_text(
                json.dumps(r.body, indent=2, ensure_ascii=False)
            )
        else:
            (slides_dir / f"{r.slide_id}.invalid.txt").write_text(r.raw_content or "")
        if r.reasoning:
            (slides_dir / f"{r.slide_id}.reasoning.md").write_text(r.reasoning)

    index = {
        "model": model,
        "slides": [
            {
                "id": r.slide_id,
                "recipe": r.recipe,
                "ok": r.ok,
                "error": r.error,
                "usage": r.usage,
            }
            for r in results
        ],
    }
    (slides_dir / "_index.json").write_text(json.dumps(index, indent=2, ensure_ascii=False))

    return results


def _print_summary(results: list[SlideResult]) -> None:
    ok = [r for r in results if r.ok]
    bad = [r for r in results if not r.ok]

    def _sum(key: str) -> int:
        return sum(int(r.usage.get(key, 0) or 0) for r in results)

    console.rule("[bold]Slide Designer v2")
    console.print(
        f"slides: {len(results)}  "
        f"[green]ok={len(ok)}[/green]  "
        f"[red]fail={len(bad)}[/red]"
    )

    t = Table(show_lines=False)
    t.add_column("id")
    t.add_column("recipe")
    t.add_column("status")
    t.add_column("p.tok", justify="right")
    t.add_column("c.tok", justify="right")
    t.add_column("note", overflow="fold")
    for r in results:
        status = "[green]ok[/green]" if r.ok else "[red]fail[/red]"
        t.add_row(
            r.slide_id,
            r.recipe,
            status,
            f"{int(r.usage.get('prompt_tokens', 0) or 0):,}",
            f"{int(r.usage.get('completion_tokens', 0) or 0):,}",
            r.error or "",
        )
    console.print(t)

    console.print(
        f"prompt={_sum('prompt_tokens'):,}  "
        f"completion={_sum('completion_tokens'):,}  "
        f"reasoning={_sum('reasoning_tokens'):,}  "
        f"total={_sum('total_tokens'):,}"
    )


def run_slides(
    *,
    storyboard_path: Path,
    enriched_path: Path,
    plan_path: Path | None,
    model: str,
    output_dir: Path,
    concurrency: int = 5,
    max_tokens: int = 16000,
    reasoning_max_tokens: int | None = 3000,
    only: list[str] | None = None,
) -> list[SlideResult]:
    storyboard_doc = json.loads(storyboard_path.read_text())
    storyboard = storyboard_doc.get("slides_storyboard", [])
    enriched = json.loads(enriched_path.read_text())
    plan = json.loads(plan_path.read_text()) if plan_path and plan_path.exists() else None
    output_dir.mkdir(parents=True, exist_ok=True)

    console.log(
        f"slide_designer: storyboard has {len(storyboard)} entries at {storyboard_path}"
    )

    results = asyncio.run(
        _run_async(
            storyboard=storyboard,
            enriched=enriched,
            plan=plan,
            model=model,
            output_dir=output_dir,
            concurrency=concurrency,
            max_tokens=max_tokens,
            reasoning_max_tokens=reasoning_max_tokens,
            only=set(only) if only else None,
        )
    )
    _print_summary(results)
    return results


def main() -> None:
    from .config import load_config
    cfg = load_config()
    out = ROOT / "out"
    only = sys.argv[1:] or None
    run_slides(
        storyboard_path=out / "art_direction.json",
        enriched_path=out / "enriched.json",
        plan_path=out / "planner.plan.json",
        model=cfg.slide_designer_model,
        output_dir=out,
        concurrency=cfg.concurrency,
        only=only,
    )


if __name__ == "__main__":
    main()
