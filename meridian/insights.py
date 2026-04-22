"""Runs the Insight Hunter LLM call against an enriched JSON.

Single Opus call that reads the enriched company dump and returns
15-20 editorially-charged facts, each annotated with category, headline,
shape_hint, and data_refs. Output → out/insights.json.
"""

from __future__ import annotations

import asyncio
import json
import os
import re
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


def _load_prompts() -> tuple[str, str, dict[str, Any]]:
    system = (ROOT / "prompts/insight_hunter/system.md").read_text()
    user_tmpl = (ROOT / "prompts/insight_hunter/user.md").read_text()
    schema = json.loads((ROOT / "prompts/insight_hunter/response.schema.json").read_text())
    return system, user_tmpl, schema


async def _run_async(
    *,
    enriched: dict[str, Any],
    model: str,
    output_dir: Path,
    max_tokens: int,
    reasoning_max_tokens: int | None,
) -> dict[str, Any]:
    system, user_tmpl, schema = _load_prompts()

    meta = enriched.get("_meta", {}) or {}
    company = enriched.get("company", {}) or {}
    mapping = {
        "company_short_name": company.get("short_name") or company.get("legal_name", ""),
        "fiscal_year": str(meta.get("fiscal_year", "")),
        "enriched_json": json.dumps(enriched, ensure_ascii=False),
    }
    user_text = _render(user_tmpl, mapping)

    console.log(
        f"insight_hunter: [bold]{model}[/bold]  "
        f"max_tokens={max_tokens}  reasoning={reasoning_max_tokens}"
    )

    or_client = OpenRouterClient()
    timeout = httpx.Timeout(connect=30.0, read=900.0, write=60.0, pool=30.0)
    async with httpx.AsyncClient(timeout=timeout) as http:
        result = await or_client.chat_async(
            client=http,
            model=model,
            system=[text_block(system, cache=True)],
            user=[text_block(user_text, cache=False)],
            max_tokens=max_tokens,
            reasoning_max_tokens=reasoning_max_tokens,
            response_json=True,
        )

    content = _strip_code_fences(result.content)
    output_dir.mkdir(parents=True, exist_ok=True)

    try:
        body = json.loads(content)
    except json.JSONDecodeError as e:
        (output_dir / "insights.invalid.txt").write_text(result.content)
        raise RuntimeError(f"Insight Hunter returned non-JSON: {e}") from e

    try:
        jsonschema.validate(body, schema)
    except jsonschema.ValidationError as e:
        (output_dir / "insights.invalid.json").write_text(
            json.dumps(body, indent=2, ensure_ascii=False)
        )
        path = "/".join(str(p) for p in e.absolute_path)
        raise RuntimeError(f"Insight Hunter schema violation at /{path}: {e.message}") from e

    (output_dir / "insights.json").write_text(
        json.dumps(body, indent=2, ensure_ascii=False)
    )
    if result.reasoning:
        (output_dir / "insights.reasoning.md").write_text(result.reasoning)

    _print_summary(body, result.usage)
    return body


def _print_summary(body: dict[str, Any], usage: dict[str, Any]) -> None:
    insights = body.get("insights", []) or []
    by_cat: dict[str, int] = {}
    for i in insights:
        by_cat[i.get("category", "?")] = by_cat.get(i.get("category", "?"), 0) + 1

    console.rule("[bold]Insight Hunter")
    console.print(f"insights: [green]{len(insights)}[/green]  categories: {len(by_cat)}")

    t = Table(show_lines=False)
    t.add_column("id")
    t.add_column("category")
    t.add_column("headline", overflow="fold")
    for i in insights:
        t.add_row(
            i.get("id", "?"),
            i.get("category", "?"),
            i.get("headline", ""),
        )
    console.print(t)

    console.print(
        f"prompt={int(usage.get('prompt_tokens', 0) or 0):,}  "
        f"completion={int(usage.get('completion_tokens', 0) or 0):,}  "
        f"reasoning={int(usage.get('reasoning_tokens', 0) or 0):,}  "
        f"total={int(usage.get('total_tokens', 0) or 0):,}"
    )
    console.print("by category: " + ", ".join(f"{k}={v}" for k, v in sorted(by_cat.items())))


def run_insight_hunter(
    *,
    enriched_path: Path,
    model: str,
    output_dir: Path,
    max_tokens: int = 16000,
    reasoning_max_tokens: int | None = 4000,
) -> dict[str, Any]:
    enriched = json.loads(enriched_path.read_text())
    return asyncio.run(
        _run_async(
            enriched=enriched,
            model=model,
            output_dir=output_dir,
            max_tokens=max_tokens,
            reasoning_max_tokens=reasoning_max_tokens,
        )
    )


def main() -> None:
    from .config import load_config
    out = ROOT / "out"
    run_insight_hunter(
        enriched_path=out / "enriched.json",
        model=load_config().insight_hunter_model,
        output_dir=out,
    )


if __name__ == "__main__":
    main()
