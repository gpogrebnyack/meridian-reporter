"""Design → render → screenshot → critique → retry loop.

Runs the initial Slide Designer pass, then iterates: render deck HTML, capture
per-slide PNGs, ask the vision critic to verdict each slide, and re-run the
designer on failing slides with the critic's issues injected as feedback.
Stops when every slide is `ok`, when no slide improves across a round, or
when `max_rounds` is hit.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from rich.console import Console

from .render import build_slides
from .screenshots import screenshot_slides
from .slide_critic import CriticResult, critique_slides
from .slides import run_slides

ROOT = Path(__file__).resolve().parent.parent
console = Console()


def _format_feedback(cr: CriticResult) -> str:
    lines = [f"Verdict: {cr.verdict}."]
    if cr.summary:
        lines.append(f"Summary: {cr.summary}")
    for i, issue in enumerate(cr.issues, 1):
        lines.append(f"{i}. [{issue.kind}] {issue.description}")
        lines.append(f"   Fix hint: {issue.hint}")
    return "\n".join(lines)


def _load_slide_bodies(slides_dir: Path, ids: list[str]) -> dict[str, dict[str, Any]]:
    bodies: dict[str, dict[str, Any]] = {}
    for sid in ids:
        p = slides_dir / f"{sid}.json"
        if p.exists():
            bodies[sid] = json.loads(p.read_text())
    return bodies


def run_design_critique_loop(
    *,
    storyboard_path: Path,
    enriched_path: Path,
    plan_path: Path | None,
    designer_model: str,
    critic_model: str,
    output_dir: Path,
    html_path: Path,
    concurrency: int = 5,
    max_rounds: int = 2,
    only: list[str] | None = None,
) -> list[CriticResult]:
    """Run one design pass, then up to `max_rounds` rounds of critic + redesign."""
    storyboard_doc = json.loads(storyboard_path.read_text())
    storyboard = storyboard_doc.get("slides_storyboard", [])
    if only:
        storyboard = [s for s in storyboard if s["id"] in only]
    all_ids = [s["id"] for s in storyboard]

    # Round 0: initial design (no critic feedback).
    console.rule("[bold cyan]Round 0 — initial design")
    run_slides(
        storyboard_path=storyboard_path,
        enriched_path=enriched_path,
        plan_path=plan_path,
        model=designer_model,
        output_dir=output_dir,
        concurrency=concurrency,
        only=only,
    )

    slides_dir = output_dir / "slides"
    screenshots_dir = output_dir / "screenshots"

    last_critic: list[CriticResult] = []
    for rnd in range(1, max_rounds + 1):
        console.rule(f"[bold cyan]Round {rnd} — render + critique")
        # Render a fresh deck HTML off the latest slide JSONs.
        build_slides(
            enriched_path=enriched_path,
            slides_dir=slides_dir,
            output_html=html_path,
        )
        bodies = _load_slide_bodies(slides_dir, all_ids)
        # Capture screenshots for every slide with a body.
        shots = screenshot_slides(html_path, screenshots_dir, list(bodies.keys()))
        last_critic = critique_slides(
            storyboard=storyboard,
            slide_bodies=bodies,
            screenshots=shots,
            model=critic_model,
            output_dir=output_dir,
            concurrency=concurrency,
        )
        failing = [c for c in last_critic if c.verdict == "fail"]
        if not failing:
            console.print(f"[green]Round {rnd}: all {len(last_critic)} slides ok — stopping")
            return last_critic
        if rnd == max_rounds:
            console.print(
                f"[yellow]Round {rnd}: {len(failing)} still failing, max_rounds reached"
            )
            return last_critic

        feedback_by_id = {c.slide_id: _format_feedback(c) for c in failing}
        console.rule(f"[bold magenta]Round {rnd} — redesign {len(failing)} failing slide(s)")
        for c in failing:
            console.print(f"  [red]✗[/red] {c.slide_id}: {len(c.issues)} issue(s)")
        run_slides(
            storyboard_path=storyboard_path,
            enriched_path=enriched_path,
            plan_path=plan_path,
            model=designer_model,
            output_dir=output_dir,
            concurrency=concurrency,
            only=[c.slide_id for c in failing],
            critic_feedback_by_id=feedback_by_id,
        )

    return last_critic


def main() -> None:
    import sys
    from .config import load_config

    cfg = load_config()
    out = ROOT / "out"
    only = sys.argv[1:] or None
    run_design_critique_loop(
        storyboard_path=out / "art_direction.json",
        enriched_path=out / "enriched.json",
        plan_path=out / "planner.plan.json",
        designer_model=cfg.slide_designer_model,
        critic_model=cfg.slide_critic_model,
        output_dir=out,
        html_path=ROOT / "slides.html",
        concurrency=cfg.concurrency,
        only=only,
    )


if __name__ == "__main__":
    main()
