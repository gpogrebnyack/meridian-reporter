"""Assemble slide specs into slides.html (minimal-chrome deck).

Inputs:
  out/enriched.json
  out/slides/*.json  (+ optional _index.json for ordering)

Output:
  slides.html  — standalone HTML, pulls Plot/d3 via jsdelivr ESM
"""

from __future__ import annotations

import html
import json
import time
from pathlib import Path
from typing import Any

from rich.console import Console

from .placeholders import resolve_recursive

ROOT = Path(__file__).resolve().parent.parent
console = Console()


def _render_text(s: str, enriched: dict[str, Any]) -> str:
    from .placeholders import resolve
    rendered, rep = resolve(s or "", enriched)
    safe = html.escape(rendered)
    for miss in rep.missing:
        tok = html.escape(f"[?{miss}]")
        safe = safe.replace(tok, f'<span class="placeholder-miss">{tok}</span>')
    return safe


def _inline_text(s: str, enriched: dict[str, Any]) -> str:
    return _render_text(s, enriched)


def _slide_html(index: int, total: int, slide: dict[str, Any],
                enriched: dict[str, Any]) -> str:
    sid = slide.get("id", f"slide-{index}")
    source = (slide.get("source") or "").strip()

    parts = [
        f'<section class="slide slide--minimal" id="slide-{html.escape(sid)}">',
        '<div class="slide-stage slide-stage--full">',
    ]
    spec_json = json.dumps(
        {
            "render_code": slide.get("render_code") or slide.get("plot_code", ""),
            "data_refs": slide.get("data_refs", {}),
        },
        ensure_ascii=False,
    )
    parts.append(
        f'<div class="slide-plot-host" data-slide-plot '
        f'data-spec="{html.escape(spec_json, quote=True)}"></div>'
    )
    parts.append('</div>')
    source_html = (
        f'<span class="slide-source"><strong>Source:</strong> '
        f'{_inline_text(source, enriched)}</span>'
        if source else '<span class="slide-source"></span>'
    )
    parts.append(
        '<div class="slide-source-footer">'
        f'{source_html}'
        f'<span class="slide-page"><em>{index:02d}</em> / {total:02d}</span>'
        '</div>'
    )
    parts.append('</section>')
    return "".join(parts)


def _cover_slide(company: str, fiscal_year: int | str, total: int) -> str:
    kicker = "Annual Report"
    return (
        f'<section class="slide cover">'
        f'<div>'
        f'<div class="cover-kicker">{html.escape(kicker)} · {html.escape(str(fiscal_year))}</div>'
        f'<h1 class="cover-title">{html.escape(company)}</h1>'
        f'</div>'
        f'<div class="cover-meta">'
        f'<span>{total} slides</span>'
        f'<span>Scroll or press ↓ to navigate</span>'
        f'</div>'
        f'</section>'
    )


def _slides_head(branding: dict[str, Any], company_name: str,
                 fiscal_year: int | str, slides_css: str) -> str:
    bg = branding.get("background", "#F5F0E8")
    secs = branding.get("secondary_colors") or []
    sec1 = secs[0] if len(secs) > 0 else "#3E9A8F"
    sec2 = secs[1] if len(secs) > 1 else "#4B80BF"
    sec3 = secs[2] if len(secs) > 2 else "#E8D5A8"
    font_heading = branding.get("font_heading") or "Inter Tight"
    font_body = branding.get("font_body") or "Inter"
    fam_parts = []
    for fam in {font_heading, font_body}:
        fam_parts.append(fam.replace(" ", "+") + ":wght@300;400;500;600;700")
    google_fonts_url = "https://fonts.googleapis.com/css2?" + "&".join(
        f"family={p}" for p in fam_parts
    ) + "&display=swap"
    return f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>{html.escape(company_name)} — Slides {html.escape(str(fiscal_year))}</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="{google_fonts_url}">
<style>
  :root {{
    --primary: {branding.get("primary_color", "#0D1B2E")};
    --accent: {branding.get("accent_color", "#C9A96E")};
    --bg: {bg};
    --sec1: {sec1};
    --sec2: {sec2};
    --sec3: {sec3};
    --rule: #B8B0A4;
    --font-heading: "{font_heading}", -apple-system, BlinkMacSystemFont, sans-serif;
    --font-body: "{font_body}", -apple-system, BlinkMacSystemFont, sans-serif;
  }}
</style>
<style>{slides_css}</style>
</head>
<body>
<div class="deck">
"""


def _slides_foot(enriched_inline: str) -> str:
    v = int(time.time())
    return f"""
</div>
<script>window.__MERIDIAN__ = {enriched_inline};</script>
<script type="module" src="./renderer/slides_boot.js?v={v}"></script>
</body></html>
"""


def build_slides(
    *,
    enriched_path: Path,
    slides_dir: Path,
    output_html: Path,
    slides_css_path: Path | None = None,
    cover: bool = True,
    minimal_chrome: bool = True,  # retained for call-site compat; always minimal
) -> Path:
    enriched = json.loads(enriched_path.read_text())
    slides_css = (slides_css_path or (ROOT / "renderer/slides.css")).read_text()

    branding = enriched.get("branding", {}) or {}
    company = (
        enriched.get("company", {}).get("short_name", "")
        or enriched.get("company", {}).get("legal_name", "")
    )
    fiscal_year = enriched.get("_meta", {}).get("fiscal_year", "")

    index_path = slides_dir / "_index.json"
    ordered_ids: list[str] = []
    if index_path.exists():
        idx = json.loads(index_path.read_text())
        ordered_ids = [s["id"] for s in idx.get("slides", []) if s.get("ok")]
    if not ordered_ids:
        ordered_ids = [
            p.stem for p in sorted(slides_dir.glob("*.json"))
            if p.name != "_index.json"
        ]

    slides: list[dict[str, Any]] = []
    for sid in ordered_ids:
        p = slides_dir / f"{sid}.json"
        if p.exists():
            slides.append(json.loads(p.read_text()))

    head = _slides_head(branding, company, fiscal_year, slides_css)
    parts = [head]

    total = len(slides) + (1 if cover else 0)
    if cover:
        parts.append(_cover_slide(company, fiscal_year, total))

    start = 2 if cover else 1
    for i, slide in enumerate(slides, start=start):
        parts.append(_slide_html(i, total, slide, enriched))

    enriched_js = json.dumps(
        {"enriched": enriched, "branding": branding},
        ensure_ascii=False,
    ).replace("</", "<\\/")
    parts.append(_slides_foot(enriched_js))

    output_html.write_text("\n".join(parts))

    missing_total = 0
    for slide in slides:
        _, rep = resolve_recursive(slide, enriched)
        missing_total += len(rep.missing)

    console.log(
        f"slides → [bold]{output_html}[/bold]  "
        f"size={output_html.stat().st_size:,} bytes  "
        f"slides={len(slides)}  placeholder_misses={missing_total}"
    )
    return output_html


def main() -> None:
    out = ROOT / "out"
    build_slides(
        enriched_path=out / "enriched.json",
        slides_dir=out / "slides",
        output_html=ROOT / "slides.html",
    )


if __name__ == "__main__":
    main()
