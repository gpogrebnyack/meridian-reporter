"""End-to-end pipeline: data + design tokens → insights → storyboard → slides → HTML.

Inputs (repo root):
  input.enriched.json        — company data
  input.design_tokens.json   — brand/typography tokens (merged into branding)

Outputs:
  out/enriched.json          — data with design tokens merged into .branding
  out/insights.json
  out/art_direction.json
  out/slides/*.json
  slides.html
"""

from __future__ import annotations

import json
from pathlib import Path

from rich.console import Console

from .art_director import run_art_direction
from .config import load_config
from .insights import run_insight_hunter
from .render import build_slides
from .slides import run_slides

ROOT = Path(__file__).resolve().parent.parent
console = Console()


def _merge_enriched_with_tokens(
    enriched_in: Path, tokens_in: Path, out_path: Path
) -> dict:
    enriched = json.loads(enriched_in.read_text())
    tokens = json.loads(tokens_in.read_text()) if tokens_in.exists() else {}
    branding = {**enriched.get("branding", {}), **tokens}
    enriched["branding"] = branding
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(enriched, ensure_ascii=False, indent=2))
    console.log(
        f"merged design tokens → {out_path}  "
        f"font_heading={branding.get('font_heading')}  "
        f"font_body={branding.get('font_body')}"
    )
    return enriched


def run() -> None:
    cfg = load_config()
    out_dir = ROOT / "out"
    out_dir.mkdir(parents=True, exist_ok=True)

    enriched_path = out_dir / "enriched.json"
    _merge_enriched_with_tokens(cfg.enriched_input, cfg.design_tokens_input, enriched_path)

    console.rule("[bold]insight hunter")
    run_insight_hunter(
        enriched_path=enriched_path,
        model=cfg.insight_hunter_model,
        output_dir=out_dir,
    )

    console.rule(f"[bold]art director (target={cfg.target_slide_count})")
    run_art_direction(
        insights_path=out_dir / "insights.json",
        enriched_path=enriched_path,
        plan_path=None,
        model=cfg.art_director_model,
        output_dir=out_dir,
        target_slide_count=cfg.target_slide_count,
    )

    console.rule("[bold]slide designer")
    run_slides(
        storyboard_path=out_dir / "art_direction.json",
        enriched_path=enriched_path,
        plan_path=None,
        model=cfg.slide_designer_model,
        output_dir=out_dir,
        concurrency=cfg.concurrency,
    )

    console.rule("[bold]render")
    build_slides(
        enriched_path=enriched_path,
        slides_dir=out_dir / "slides",
        output_html=ROOT / "slides.html",
    )


def main() -> None:
    run()


if __name__ == "__main__":
    main()
