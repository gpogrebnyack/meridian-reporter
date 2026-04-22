# Narrative tags — the closed vocabulary

Every slide carries exactly **one** `narrative_tag` from this list. The tag
answers the question: *what kind of story is this slide telling?* Recipe
answers the question *what shape does the chart take?* The two axes are
independent — the same recipe can serve different narratives on different
slides.

## Slugs (17)

`scale_surprise` · `slope` · `trajectory` · `divergence` · `concentration` ·
`composition` · `hierarchy` · `ranking` · `peer_gap` · `correlation` ·
`distribution` · `duration` · `seasonality` · `anomaly` · `threshold_breach` ·
`milestone` · `geography` · `flow`

## When to use each

| slug | Use when the story is… | Example | Recipes that fit best |
|---|---|---|---|
| `scale_surprise` | one number is startlingly big or small on its own | "AED 12.4bn cash reserves" | `hero_number` |
| `slope` | a two-point before/after change | "Margin: 8% → 14% in one year" | `slope_graph`, `dumbbell` |
| `trajectory` | a multi-period arc of one series | "Revenue climbed every year since 2020" | `area_line_custom`, `moving_average`, `index_chart` |
| `divergence` | two series drift apart over time | "Profit grew 2.6× while revenue grew 1.5×" | `index_chart`, `slope_graph`, `connected_scatter` |
| `concentration` | one item dominates the whole | "Real Estate = 63% of revenue" | `treemap`, `arc_concentration`, `marimekko`, `waffle_grid` |
| `composition` | parts add up to a whole (flat) | "Revenue mix across 4 segments" | `single_stacked_bar`, `stacked_bars`, `marimekko` |
| `hierarchy` | nested levels of a structure | "Group → subsidiaries → lines of business" | `treemap`, `sunburst`, `arc_diagram` |
| `ranking` | who is #1, #2, #3 on one metric | "Top 10 logistics hubs by tonnage" | `lollipop`, `dot_plot`, `bar` |
| `peer_gap` | we vs comparables on the same metric | "Our EBITDA margin 8pp below sector median" | `dumbbell`, `bullet_chart`, `beeswarm` |
| `correlation` | two variables move together (or don't) | "Headcount vs EBITDA, 4-year path" | `connected_scatter`, `scatter`, `hex_bin` |
| `distribution` | the shape of many values | "Ticket sizes — 80% under AED 5M" | `histogram`, `box_plot`, `ridgeline`, `strip_plot` |
| `duration` | how long something took or lasted | "Avg sales cycle: 182 days" | `barcode`, `bar`, `hero_number` |
| `seasonality` | repeating intra-year pattern | "Q4 is 40% of annual revenue every year" | `calendar_heatmap`, `dot_heatmap`, `small_multiples_area` |
| `anomaly` | one outlier breaks the pattern | "Q3 2023 — revenue spike from one-off deal" | `warming_stripes`, `spike_map`, `calendar_heatmap`, `beeswarm` |
| `threshold_breach` | approaching or crossing a limit | "Net debt / EBITDA 2.8× vs covenant 3.0×" | `bullet_chart`, `hero_number`, `barcode` |
| `milestone` | a single datable event of importance | "AED 1.2bn sukuk issued August 2024" | `hero_number`, `typographic`, `annotation` |
| `geography` | spatial distribution across a map | "Operations across 12 emirates" | `choropleth`, `spike_map`, `hex_bin` |
| `flow` | movement between nodes | "Capital flows: parent → 5 subsidiaries" | `arc_diagram`, `sankey` |

## Tips for picking

- If two tags fit, pick the one that names **the punchline**, not the
  mechanic. `trajectory` describes an arc; `divergence` describes *two*
  arcs drifting — if the point is the gap, use `divergence`.
- `scale_surprise` is for the one-number slide where the number *itself*
  is the story. If the surprise is embedded in context (rank, gap, trend),
  use the tag for that context instead.
- `anomaly` = breaks a pattern. `threshold_breach` = approaches a limit.
  `milestone` = a single dated event. These three are often confused —
  ask which frame actually powers the headline.
- `concentration` ≠ `composition`. Concentration highlights that **one**
  item dominates; composition just shows how the pie is split.
