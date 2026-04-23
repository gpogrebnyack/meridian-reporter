# Meridian Autoreport

LLM pipeline that turns a company's enriched financial/ESG dataset into a
Swiss-style editorial slide deck — 5–15 data-driven infographics rendered
as a single interactive HTML page.

Live demo: **https://meridian-autoreport.vercel.app**

## What it does

Given `input.enriched.json` + `input.design_tokens.json`, the pipeline runs
four LLM phases end-to-end:

1. **Insight Hunter** — reads the enriched dataset and surfaces the
   statistically notable findings (trends, concentrations, anomalies, gaps).
2. **Art Director** — sequences the insights into a 5–15 slide storyboard,
   assigning one chart recipe per slide from a fixed 40-recipe catalog.
3. **Slide Designer** — for each storyboard entry, emits a JSON spec with
   `render_code`: Observable Plot + d3 + a small `prim` primitive library,
   drawn into a fixed 1600×900 SVG stage.
4. **Slide Critic** — vision QA pass. Screenshots every rendered slide and
   flags visible bugs (overlap, overflow, broken charts). Failing slides
   are re-designed with the critic's fix hints (up to 2 rounds).

Output: a single `slides.html` file plus `out/slides/*.json`,
`out/screenshots/*.png`, and cost/usage accounting under `out/`.

## Stack

- **Models** via OpenRouter — defaults: Claude Opus 4.7 (IH, SD), Claude
  Sonnet 4.6 (AD, Critic). Anthropic prompt caching is used on the shared
  system + enriched + recipe prefix.
- **Rendering** — Observable Plot 0.6.17 + d3 v7 via jsdelivr ESM, loaded
  by `renderer/slides_boot.js`.
- **Screenshots** — Playwright async Chromium against a local HTTP server
  (CORS-free ESM).
- **Schema** — every LLM response is JSONSchema-validated per phase.

## Layout

```
meridian/             # pipeline code (one module per phase)
  insights.py         # phase 1: Insight Hunter
  art_director.py     # phase 2: Art Director
  slides.py           # phase 3: Slide Designer (parallel + cached prefix)
  slide_critic.py     # phase 4: visual QA critic
  slide_loop.py       # orchestrates design → render → critic retry
  render.py           # assembles slides.html
  screenshots.py      # Playwright capture harness
  openrouter.py       # thin OpenRouter client with cache_control + reasoning
  pipeline.py         # end-to-end runner
  config.py           # loads config.json

prompts/              # system/user/schema for each phase
renderer/             # Observable Plot boot + primitive library + map data
bench/                # multi-model benchmark harness (gitignored outputs)
```

## Running it

```bash
# 1. install
uv sync

# 2. set OpenRouter key
cp .env.example .env   # then fill in OPENROUTER_API_KEY

# 3. run end-to-end
uv run python -m meridian.pipeline
```

The final deck is written to `slides.html` at the repo root.

## Deploying

Static site — `vercel.json` rewrites `/` → `/slides.html`. Deploy via:

```bash
vercel deploy --prod
```

`.vercelignore` keeps Python code, prompts, archive, and inputs out of the
upload — only `slides.html` + `renderer/` ship.

## Multi-model benchmark

`bench/` has a harness for swapping each phase's model against a frozen
reference run (other three phases held fixed at the baseline). See
`bench/candidates.json` for the model matrix.

```bash
uv run python -m bench.harness sd anthropic/claude-sonnet-4.6 --run-id r1
uv run python -m bench.eval sd --all
uv run python -m bench.report
```

Output lands in `bench/out/report.md` with per-phase quality/$/tokens tables
and a Pareto pick (cheapest model within 5% of best quality per phase).
