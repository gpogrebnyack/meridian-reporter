"""Pipeline config loader: config.json at repo root, env vars override."""

from __future__ import annotations

import json
import os
from dataclasses import dataclass
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CONFIG_PATH = ROOT / "config.json"


@dataclass(frozen=True)
class Config:
    target_slide_count: int
    concurrency: int
    insight_hunter_model: str
    art_director_model: str
    slide_designer_model: str
    enriched_input: Path
    design_tokens_input: Path


def load_config() -> Config:
    raw = json.loads(CONFIG_PATH.read_text())
    models = raw.get("models", {})
    inputs = raw.get("inputs", {})

    def _env(name: str, fallback: str) -> str:
        return os.environ.get(name, fallback)

    def _env_int(name: str, fallback: int) -> int:
        v = os.environ.get(name)
        return int(v) if v else fallback

    return Config(
        target_slide_count=_env_int("TARGET_SLIDE_COUNT", raw["target_slide_count"]),
        concurrency=_env_int("CONCURRENCY", raw.get("concurrency", 5)),
        insight_hunter_model=_env("INSIGHT_HUNTER_MODEL", models["insight_hunter"]),
        art_director_model=_env("ART_DIRECTOR_MODEL", models["art_director"]),
        slide_designer_model=_env("SLIDE_DESIGNER_MODEL", models["slide_designer"]),
        enriched_input=ROOT / inputs.get("enriched", "input.enriched.json"),
        design_tokens_input=ROOT / inputs.get("design_tokens", "input.design_tokens.json"),
    )
