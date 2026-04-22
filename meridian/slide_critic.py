"""Post-render visual QA: multimodal LLM looks at each slide PNG and flags bugs.

The Slide Designer is text-blind — it composes SVG without seeing its own
output, so overlaps, overflows and stray marks slip through. This module
closes the loop: it pairs every rendered slide with its `render_code` +
storyboard entry, asks a vision model for a verdict, and returns structured
issues that the designer pass can consume as retry feedback.
"""

from __future__ import annotations

import asyncio
import base64
import json
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import httpx
import jsonschema
from rich.console import Console
from rich.table import Table

from .openrouter import OpenRouterClient, gather_limited, text_block

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
    system = (ROOT / "prompts/slide_critic/system.md").read_text()
    user_tmpl = (ROOT / "prompts/slide_critic/user.md").read_text()
    schema = json.loads((ROOT / "prompts/slide_critic/response.schema.json").read_text())
    return system, user_tmpl, schema


@dataclass
class CriticIssue:
    kind: str
    description: str
    hint: str


@dataclass
class CriticResult:
    slide_id: str
    verdict: str  # "ok" | "fail" | "error"
    summary: str = ""
    issues: list[CriticIssue] = field(default_factory=list)
    error: str | None = None
    usage: dict[str, Any] = field(default_factory=dict)
    raw_content: str = ""

    @property
    def ok(self) -> bool:
        return self.verdict == "ok"


def _image_block(png_path: Path) -> dict[str, Any]:
    data = base64.b64encode(png_path.read_bytes()).decode("ascii")
    return {
        "type": "image_url",
        "image_url": {"url": f"data:image/png;base64,{data}"},
    }


def _build_user_message(
    *,
    user_tmpl: str,
    storyboard_entry: dict[str, Any],
    slide_body: dict[str, Any],
    png_path: Path,
) -> list[dict[str, Any]]:
    mapping = {
        "storyboard_entry_json": json.dumps(storyboard_entry, ensure_ascii=False, indent=2),
        "render_code": slide_body.get("render_code", "") or "",
        "eyebrow": slide_body.get("eyebrow", "") or "",
        "headline": slide_body.get("headline", "") or "",
        "subhead": slide_body.get("subhead", "") or "",
        "footnote": slide_body.get("footnote", "") or "",
        "source": slide_body.get("source", "") or "",
    }
    text = _render(user_tmpl, mapping)
    return [text_block(text, cache=False), _image_block(png_path)]


async def _critique_one(
    *,
    client_http: httpx.AsyncClient,
    or_client: OpenRouterClient,
    model: str,
    system_blocks: list[dict[str, Any]],
    user_tmpl: str,
    storyboard_entry: dict[str, Any],
    slide_body: dict[str, Any],
    png_path: Path,
    schema: dict[str, Any],
    max_tokens: int,
    reasoning_max_tokens: int | None,
) -> CriticResult:
    sid = storyboard_entry["id"]
    if not png_path.exists():
        return CriticResult(slide_id=sid, verdict="error", error=f"no screenshot at {png_path}")

    user_blocks = _build_user_message(
        user_tmpl=user_tmpl,
        storyboard_entry=storyboard_entry,
        slide_body=slide_body,
        png_path=png_path,
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
        return CriticResult(slide_id=sid, verdict="error", error=f"http: {e}")

    content = _strip_code_fences(result.content)
    try:
        body = json.loads(content)
    except json.JSONDecodeError as e:
        return CriticResult(
            slide_id=sid, verdict="error", error=f"non-JSON: {e}",
            usage=result.usage, raw_content=result.content,
        )
    try:
        jsonschema.validate(body, schema)
    except jsonschema.ValidationError as e:
        return CriticResult(
            slide_id=sid, verdict="error", error=f"schema: {e.message}",
            usage=result.usage, raw_content=result.content,
        )

    issues = [CriticIssue(**i) for i in body.get("issues", [])]
    return CriticResult(
        slide_id=sid,
        verdict=body["verdict"],
        summary=body.get("summary", ""),
        issues=issues,
        usage=result.usage,
        raw_content=result.content,
    )


async def _run_async(
    *,
    tasks: list[tuple[dict[str, Any], dict[str, Any], Path]],
    model: str,
    concurrency: int,
    max_tokens: int,
    reasoning_max_tokens: int | None,
) -> list[CriticResult]:
    system, user_tmpl, schema = _load_prompts()
    system_blocks = [text_block(system, cache=True)]
    or_client = OpenRouterClient()

    console.log(
        f"slide_critic: [bold]{model}[/bold]  slides={len(tasks)}  "
        f"concurrency={concurrency}  max_tokens={max_tokens}  "
        f"reasoning={reasoning_max_tokens}"
    )

    timeout = httpx.Timeout(connect=30.0, read=900.0, write=60.0, pool=30.0)
    async with httpx.AsyncClient(timeout=timeout) as http:
        coros = [
            _critique_one(
                client_http=http,
                or_client=or_client,
                model=model,
                system_blocks=system_blocks,
                user_tmpl=user_tmpl,
                storyboard_entry=entry,
                slide_body=body,
                png_path=png,
                schema=schema,
                max_tokens=max_tokens,
                reasoning_max_tokens=reasoning_max_tokens,
            )
            for entry, body, png in tasks
        ]
        return await gather_limited(coros, concurrency=concurrency)


def _print_summary(results: list[CriticResult]) -> None:
    ok = [r for r in results if r.verdict == "ok"]
    fail = [r for r in results if r.verdict == "fail"]
    err = [r for r in results if r.verdict == "error"]

    console.rule("[bold]Slide Critic")
    console.print(
        f"slides: {len(results)}  "
        f"[green]ok={len(ok)}[/green]  "
        f"[red]fail={len(fail)}[/red]  "
        f"[yellow]err={len(err)}[/yellow]"
    )

    t = Table(show_lines=False)
    t.add_column("id")
    t.add_column("verdict")
    t.add_column("#iss", justify="right")
    t.add_column("issues", overflow="fold")
    for r in results:
        color = {"ok": "green", "fail": "red", "error": "yellow"}[r.verdict]
        if r.verdict == "error":
            desc = r.error or ""
        else:
            desc = "; ".join(f"[{i.kind}] {i.description}" for i in r.issues) or r.summary
        t.add_row(r.slide_id, f"[{color}]{r.verdict}[/{color}]", str(len(r.issues)), desc)
    console.print(t)


def critique_slides(
    *,
    storyboard: list[dict[str, Any]],
    slide_bodies: dict[str, dict[str, Any]],
    screenshots: dict[str, Path],
    model: str,
    output_dir: Path,
    concurrency: int = 5,
    max_tokens: int = 4000,
    reasoning_max_tokens: int | None = 2000,
    only: list[str] | None = None,
) -> list[CriticResult]:
    """Critique every slide for which we have both a body and a screenshot."""
    only_set = set(only) if only else None
    tasks: list[tuple[dict[str, Any], dict[str, Any], Path]] = []
    for entry in storyboard:
        sid = entry["id"]
        if only_set and sid not in only_set:
            continue
        body = slide_bodies.get(sid)
        png = screenshots.get(sid)
        if body is None or png is None:
            console.log(f"[yellow]skip[/yellow] {sid}: body={body is not None} png={png is not None}")
            continue
        tasks.append((entry, body, png))

    if not tasks:
        console.log("[yellow]slide_critic: nothing to critique")
        return []

    results = asyncio.run(
        _run_async(
            tasks=tasks,
            model=model,
            concurrency=concurrency,
            max_tokens=max_tokens,
            reasoning_max_tokens=reasoning_max_tokens,
        )
    )

    critic_dir = output_dir / "critic"
    critic_dir.mkdir(parents=True, exist_ok=True)
    index = {
        "model": model,
        "slides": [
            {
                "id": r.slide_id,
                "verdict": r.verdict,
                "summary": r.summary,
                "issues": [i.__dict__ for i in r.issues],
                "error": r.error,
                "usage": r.usage,
            }
            for r in results
        ],
    }
    (critic_dir / "_index.json").write_text(json.dumps(index, indent=2, ensure_ascii=False))

    _print_summary(results)
    return results


def main() -> None:
    """CLI: critique the current out/slides/*.json against out/screenshots/*.png."""
    import sys
    from .config import load_config
    from .screenshots import screenshot_slides

    cfg = load_config()
    out = ROOT / "out"
    only = sys.argv[1:] or None

    storyboard = json.loads((out / "art_direction.json").read_text()).get("slides_storyboard", [])
    slide_bodies: dict[str, dict[str, Any]] = {}
    for entry in storyboard:
        p = out / "slides" / f"{entry['id']}.json"
        if p.exists():
            slide_bodies[entry["id"]] = json.loads(p.read_text())

    ids_to_shoot = [sid for sid in slide_bodies if (not only or sid in only)]
    console.log(f"slide_critic: capturing {len(ids_to_shoot)} screenshots…")
    screenshots = screenshot_slides(
        ROOT / "slides.html",
        out / "screenshots",
        ids_to_shoot,
    )

    critic_model = getattr(cfg, "slide_critic_model", None) or cfg.art_director_model
    critique_slides(
        storyboard=storyboard,
        slide_bodies=slide_bodies,
        screenshots=screenshots,
        model=critic_model,
        output_dir=out,
        concurrency=cfg.concurrency,
        only=only,
    )


if __name__ == "__main__":
    main()
