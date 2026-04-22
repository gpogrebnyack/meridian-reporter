# Plot recipes — the closed catalog for v2

35 business-usable recipes curated from the Observable Plot gallery (https://observablehq.com/@observablehq/plot-gallery) plus a handful of obvious omissions (choropleth, box plot, ridgeline, calendar heatmap, hexbin, slope graph, dumbbell, bullet chart). Each recipe is a **concrete shape** the Art Director picks for a slide, not a semantic category.

Each entry: `slug` · **Name** — one-line data shape · **Narratives** it can serve · **Marks** · **Code sketch**.

Recipes are ranked roughly from scale-first → trajectory → distribution → composition → hierarchy → geography.

**Narrative vocabulary** (10 tags, assigned by AD per slide): `scale_surprise`, `slope`, `trajectory`, `concentration`, `anomaly`, `composition`, `duration`, `correlation`, `named_detail`, `ranking`, `distribution`, `geography`, `flow`, `hierarchy`. Use these on slides, not on recipes.

---

## 1. `hero_number` · Hero number — one numeral dominates

*Narratives*: scale_surprise, concentration.
*Marks*: none — typography only. `prim.heroNumber` at size 240-320.

```js
prim.heroNumber(svg, fmt.pct(datasets.share), {
  x: 80, y: 420, size: 280, color: "primary",
  subLabel: "SHARE OF TOTAL", subSubLabel: null,
});
```

## 2. `slope_graph` · Slope graph — two points, joined

*Narratives*: slope, trajectory.
*Marks*: `prim.slopeLine` or raw d3 line + dots.

```js
prim.slopeLine(svg, {
  xLeft: 140, xRight: 1080, yTop: 200, yBottom: 560,
  valueLeft: datasets.then, valueRight: datasets.now,
  labelLeft: datasets.then_year + " value", labelRight: datasets.now_year + " value",
  numberLeft: fmt.pct(datasets.then), numberRight: fmt.pct(datasets.now),
  accentRight: true,
});
```

## 3. `dumbbell` · Dumbbell — before→after rows

*Narratives*: slope, composition.
*Marks*: `Plot.ruleY + Plot.dot × 2` or `prim.dumbbell`.

```js
Plot.plot({
  marks: [
    Plot.ruleY(rows, {y: "label", x1: "left", x2: "right", stroke: palette.rule, strokeOpacity: 0.35, strokeWidth: 2}),
    Plot.dot(rows, {y: "label", x: "left", fill: palette.rule, r: 5}),
    Plot.dot(rows, {y: "label", x: "right", fill: (d)=> d.accent ? palette.accent : palette.ink, r: 7}),
  ],
});
```

## 4. `diverging_bars` · Diverging bars — centered at zero, +/− on each side

*Narratives*: anomaly, ranking, composition.
*Marks*: `Plot.barX` with sorted y, `Plot.axisX`.

```js
Plot.plot({
  x: {axis: "top", label: null, ticks: 2},
  y: {label: null, axis: "left", domain: d3.sort(rows, d => d.value).map(d => d.label)},
  marks: [
    Plot.ruleX([0], {stroke: palette.ink, strokeWidth: 1}),
    Plot.barX(rows, {y: "label", x: "value", fill: d => d.value < 0 ? palette.rule : palette.ink}),
    Plot.text(rows, {y: "label", x: "value", text: d => fmt.signed_pct(d.value), textAnchor: "start", dx: 6, fontSize: 11}),
  ],
});
```

## 5. `lollipop` · Lollipop — ranked, one accent

*Narratives*: ranking, anomaly.
*Marks*: `Plot.ruleY + Plot.dot`; use `prim.rankedDots` for canonical output.

```js
prim.rankedDots(svg, {
  x: 140, y: 200, width: 1200,
  items: rows, // [{label, value, accent?, italicSub?}]
  maxValue: d3.max(rows, d=>d.value),
  rowHeight: 44, dotRadius: 7,
  valueFormatter: (v) => fmt.pct(v),
});
```

## 6. `bullet_chart` · Bullet chart — actual vs target vs range

*Narratives*: anomaly, duration.
*Marks*: raw d3 `rect` + `line` per row.

```js
rows.forEach((r, i) => {
  const y = 220 + i * 60;
  svg.append("rect").attr("x", 140).attr("y", y-8).attr("width", x(r.ranges[2])).attr("height", 16).attr("fill", palette.rule).attr("fill-opacity", 0.18);
  svg.append("rect").attr("x", 140).attr("y", y-4).attr("width", x(r.actual)).attr("height", 8).attr("fill", palette.ink);
  svg.append("line").attr("x1", 140+x(r.target)).attr("x2", 140+x(r.target)).attr("y1", y-12).attr("y2", y+12).attr("stroke", palette.accent).attr("stroke-width", 2);
  svg.append("text").attr("x", 100).attr("y", y+4).attr("text-anchor", "end").attr("font-family", palette.bodyFont).attr("font-size", 11).attr("letter-spacing", 2.4).attr("font-weight", 600).attr("fill", palette.ink).text(r.label.toUpperCase());
});
```

## 7. `grouped_bar` · Grouped bar chart — categories × sub-groups

*Narratives*: composition, ranking, correlation.
*Marks*: `Plot.barY` with `fx`.

```js
Plot.plot({
  x: {label: null, axis: null},
  fx: {label: null, padding: 0.1},
  y: {label: null, axis: "left", ticks: 2},
  color: {range: [palette.ink, palette.accent, palette.rule]},
  marks: [
    Plot.barY(rows, {fx: "group", x: "sub", y: "value", fill: "sub"}),
    Plot.ruleY([0], {stroke: palette.ink}),
  ],
});
```

## 8. `stacked_bars` · Stacked bars — composition × category

*Narratives*: composition, ranking.
*Marks*: `Plot.barY` with stack.

```js
Plot.plot({
  x: {label: null, padding: 0.1}, y: {axis: "left", label: null, ticks: 3},
  color: {range: [palette.accent, palette.ink, palette.rule]},
  marks: [
    Plot.barY(rows, {x: "category", y: "value", fill: "segment", stroke: palette.ink, strokeOpacity: 0}),
    Plot.ruleY([0], {stroke: palette.ink}),
  ],
});
```

## 9. `single_stacked_bar` · Single stacked bar — one bar, multiple segments

*Narratives*: composition, concentration.
*Marks*: `Plot.barX` horizontal, `Plot.text` for segment labels.

```js
Plot.plot({
  x: {axis: null}, y: {axis: null},
  color: {range: [palette.accent, palette.ink, palette.rule]},
  marks: [
    Plot.barX(segments, {y: () => "total", x: "share", fill: "segment"}),
    Plot.text(segments, Plot.stackX({y: () => "total", x: "share", text: (d) => d.segment + " · " + fmt.pct(d.share), fill: "white", textAnchor: "start", dx: 4, fontSize: 11, fontFamily: palette.bodyFont})),
  ],
});
```

## 10. `marimekko` · Marimekko — variable-width columns with inner stack

*Narratives*: composition, correlation.
*Marks*: raw d3 with `rect`s sized by two dimensions.

```js
let xCursor = 0;
const totalWidth = 1200;
const colSums = segments.map(s => d3.sum(s.parts, p => p.value));
const totalSum = d3.sum(colSums);
segments.forEach((seg, i) => {
  const colW = (colSums[i] / totalSum) * totalWidth;
  let yCursor = 0;
  const segSum = colSums[i];
  seg.parts.forEach((p, j) => {
    const h = (p.value / segSum) * 440;
    svg.append("rect").attr("x", 140 + xCursor).attr("y", 220 + yCursor).attr("width", colW - 2).attr("height", h - 2)
      .attr("fill", p.accent ? palette.accent : palette.ink).attr("fill-opacity", p.accent ? 1 : 0.3 + 0.15*j);
    yCursor += h;
  });
  xCursor += colW;
});
```

## 11. `index_chart` · Index chart — trajectories normalized to 100

*Narratives*: trajectory, correlation, ranking.
*Marks*: `Plot.line` with `z`, normalize values to a base year.

```js
Plot.plot({
  y: {type: "log", ticks: 3, label: null, grid: false, axis: "left"},
  x: {label: null, ticks: 4},
  marks: [
    Plot.ruleY([100], {stroke: palette.rule, strokeDasharray: "2 3"}),
    Plot.line(data, {x: "year", y: "indexed", z: "series", stroke: (d) => d.series === hero ? palette.accent : palette.ink, strokeOpacity: (d) => d.series === hero ? 1 : 0.25, strokeWidth: (d) => d.series === hero ? 2.5 : 1}),
    Plot.text(data.filter(d => d.year === endYear), {x: "year", y: "indexed", text: "series", dx: 6, textAnchor: "start", fontSize: 11, fontFamily: palette.bodyFont}),
  ],
});
```

## 12. `connected_scatter` · Connected scatterplot — path through XY with year labels

*Narratives*: trajectory, correlation.
*Marks*: `Plot.line + Plot.dot + Plot.arrow + Plot.text`.

```js
Plot.plot({
  x: {label: "→ x axis label", ticks: 2}, y: {label: "↑ y axis label", ticks: 2},
  marks: [
    Plot.line(points, {x: "x", y: "y", stroke: palette.ink, strokeWidth: 1.5, curve: "catmull-rom"}),
    Plot.dot(points, {x: "x", y: "y", fill: palette.ink, r: 4}),
    Plot.dot(points.slice(-1), {x: "x", y: "y", fill: palette.accent, r: 7}),
    Plot.arrow([{x1: points.at(-2).x, y1: points.at(-2).y, x2: points.at(-1).x, y2: points.at(-1).y}], {x1: "x1", y1: "y1", x2: "x2", y2: "y2", stroke: palette.accent, strokeWidth: 2, headLength: 10}),
    Plot.text(points, {x: "x", y: "y", text: "year", dy: -12, fontSize: 11, fontFamily: palette.bodyFont}),
  ],
});
```

## 13. `moving_average` · Line with moving average overlay

*Narratives*: trajectory, duration.
*Marks*: `Plot.line` × 2 (raw thin + smoothed thick).

```js
Plot.plot({
  x: {label: null, ticks: 4}, y: {label: null, axis: "left", ticks: 2},
  marks: [
    Plot.line(data, {x: "date", y: "raw", stroke: palette.rule, strokeOpacity: 0.6, strokeWidth: 1}),
    Plot.line(data, Plot.windowY({k: 12, anchor: "middle"}, {x: "date", y: "raw", stroke: palette.ink, strokeWidth: 2})),
    Plot.dot(data.slice(-1), {x: "date", y: "raw", fill: palette.accent, r: 6}),
  ],
});
```

## 14. `fan_chart` · Fan chart — central projection + widening bands

*Narratives*: trajectory, distribution.
*Marks*: `Plot.areaY × N` + `Plot.line`.

```js
Plot.plot({
  x: {label: null, ticks: 4}, y: {label: null, axis: "left", ticks: 2},
  marks: [
    Plot.areaY(projection, {x: "year", y1: "p10", y2: "p90", fill: palette.accent, fillOpacity: 0.15}),
    Plot.areaY(projection, {x: "year", y1: "p25", y2: "p75", fill: palette.accent, fillOpacity: 0.3}),
    Plot.line(projection, {x: "year", y: "central", stroke: palette.ink, strokeWidth: 2}),
    Plot.dot(projection.slice(-1), {x: "year", y: "central", fill: palette.accent, r: 7}),
  ],
});
```

## 15. `streamgraph` · Streamgraph — wiggle-stacked organic composition

*Narratives*: composition, trajectory.
*Marks*: `Plot.areaY` with `stackOffset: "wiggle"`.

```js
Plot.plot({
  x: {label: null, ticks: 3}, y: {axis: null},
  color: {range: [palette.ink, palette.accent, palette.rule]},
  marks: [Plot.areaY(data, {x: "year", y: "value", fill: "segment", stackOffset: "wiggle", curve: "monotone-x"})],
});
```

## 16. `stacked_area` · Stacked area — composition with totals

*Narratives*: composition, trajectory.
*Marks*: `Plot.areaY` default stack + `Plot.ruleY([0])`.

```js
Plot.plot({
  x: {label: null, ticks: 4}, y: {label: null, ticks: 2, axis: "left"},
  color: {range: [palette.ink, palette.accent, palette.rule]},
  marks: [
    Plot.areaY(data, {x: "year", y: "value", fill: "segment", fillOpacity: 0.85}),
    Plot.ruleY([0], {stroke: palette.ink}),
  ],
});
```

## 17. `area_line_custom` · Area + line custom mark (impact-of-vaccines style)

*Narratives*: trajectory, named_detail, scale_surprise.
*Marks*: `Plot.areaY` + `Plot.line` + `Plot.ruleX` for an annotation year.

```js
Plot.plot({
  y: {label: null, ticks: 3, axis: "left"}, x: {label: null, ticks: 5},
  marks: [
    Plot.areaY(data, {x: "year", y: "value", fill: palette.rule, fillOpacity: 0.3}),
    Plot.line(data, {x: "year", y: "value", stroke: palette.ink, strokeWidth: 1.5}),
    Plot.ruleX([datasets.event_year], {stroke: palette.accent, strokeWidth: 2, strokeDasharray: "2 3"}),
    Plot.text([{year: datasets.event_year, label: datasets.event_label}], {x: "year", y: () => d3.max(data, d=>d.value)*0.9, text: "label", textAnchor: "start", dx: 6, fontSize: 11, fontFamily: palette.bodyFont}),
  ],
});
```

## 18. `horizon_chart` · Horizon chart — banded time-series, compact

*Narratives*: trajectory, composition, anomaly.
*Marks*: `Plot.areaY` × N with clipped bands, or facet per series.

```js
// Simplified horizon: each series gets its own clipped band, colored by band index
Plot.plot({
  height: 420, width: 1200,
  fy: {label: null, padding: 0.04}, x: {label: null, ticks: 4}, y: {axis: null},
  color: {range: [palette.rule, palette.ink, palette.accent]},
  marks: [
    Plot.areaY(data, {x: "date", y: "value", fill: (d) => d.band, fy: "series", curve: "monotone-x"}),
    Plot.text(series.map(s => ({series: s})), {fy: "series", x: () => xStart, y: () => 0, text: "series", textAnchor: "start", dx: 4, fontSize: 11, fontFamily: palette.bodyFont}),
  ],
});
```

## 19. `sparkline_grid` · Sparkline grid — many tiny lines, one per subject

*Narratives*: trajectory, composition, ranking.
*Marks*: `prim.facetGrid` + `prim.sparkline` per cell.

```js
prim.facetGrid(svg, {
  x: 140, y: 220, width: 1200, height: 440,
  items: series, cols: 4, rows: Math.ceil(series.length/4),
  gapX: 20, gapY: 24, labelKey: "name",
  renderCell: (svg, {x, y, w, h, item}) => {
    prim.sparkline(svg, {x, y, width: w, height: h, values: item.values, accentIndex: item.values.length-1, color: "ink", showDots: false, labelStart: item.values[0], labelEnd: item.values.at(-1)});
  },
});
```

## 20. `small_multiples_area` · Small multiples (faceted areas/lines)

*Narratives*: composition, trajectory, correlation.
*Marks*: `Plot.areaY/lineY` with `fx`.

```js
Plot.plot({
  height: 440, width: 1200,
  fx: {label: null, padding: 0.04, axis: "bottom"}, x: {label: null, ticks: 2}, y: {axis: null},
  marks: [
    Plot.areaY(data, {x: "year", y: "value", fx: "segment", fill: palette.ink, fillOpacity: 0.12}),
    Plot.lineY(data, {x: "year", y: "value", fx: "segment", stroke: palette.ink, strokeWidth: 1.5}),
    Plot.dot(data.filter(d=>d.year===endYear), {x: "year", y: "value", fx: "segment", fill: palette.accent, r: 5}),
  ],
});
```

## 21. `beeswarm` · Beeswarm — distribution along one axis, one accent

*Narratives*: distribution, anomaly, ranking.
*Marks*: `Plot.dot` + `Plot.dodgeY`.

```js
Plot.plot({
  x: {label: null, ticks: 2}, y: {axis: null}, height: 320,
  marks: [
    Plot.dot(peers, Plot.dodgeY({anchor: "middle"}, {x: "value", fill: (d)=> d.accent ? palette.accent : palette.ink, r: (d)=> d.accent ? 8 : 5})),
    Plot.text(peers.filter(d=>d.accent), {x: "value", y: 0, text: "label", dy: -24, fontSize: 11, fontFamily: palette.bodyFont, letterSpacing: 2.4}),
  ],
});
```

## 22. `dot_plot` · Dot plot — one dot per category, ranked

*Narratives*: ranking, distribution.
*Marks*: `Plot.dot`, ordered y.

```js
Plot.plot({
  x: {label: null, ticks: 2}, y: {label: null, axis: "left", domain: d3.sort(rows, d=>-d.value).map(d=>d.label)},
  marks: [
    Plot.ruleY(rows, {y: "label", x1: 0, x2: "value", stroke: palette.rule, strokeOpacity: 0.3}),
    Plot.dot(rows, {x: "value", y: "label", fill: (d)=>d.accent ? palette.accent : palette.ink, r: (d)=>d.accent ? 7 : 5}),
  ],
});
```

## 23. `barcode` · Barcode chart — many ticks along one axis

*Narratives*: distribution, ranking.
*Marks*: `Plot.tickX`.

```js
Plot.plot({
  x: {label: null, ticks: 3}, y: {axis: null}, height: 200,
  marks: [
    Plot.tickX(values, {x: "value", stroke: palette.ink, strokeOpacity: 0.35, strokeWidth: 1}),
    Plot.tickX(values.filter(v=>v.accent), {x: "value", stroke: palette.accent, strokeWidth: 2}),
  ],
});
```

## 24. `strip_plot` · Strip plot (bar + tick overlay) — distribution + summary

*Narratives*: distribution, duration.
*Marks*: `Plot.barY` + `Plot.tickY`.

```js
Plot.plot({
  y: {label: null, ticks: 2, axis: "left"}, x: {label: null, padding: 0.3},
  marks: [
    Plot.barY(bars, {x: "category", y: "value", fill: palette.rule, fillOpacity: 0.25}),
    Plot.tickY(ticks, {x: "category", y: "value", stroke: palette.accent, strokeWidth: 2}),
  ],
});
```

## 25. `histogram` · Normal histogram — distribution, one bin highlighted

*Narratives*: distribution, anomaly, named_detail.
*Marks*: `Plot.rectY` with `Plot.binX`.

```js
Plot.plot({
  x: {label: null, ticks: 4}, y: {axis: null},
  marks: [
    Plot.rectY(values, Plot.binX({y: "count"}, {x: "v", fill: (d, i, bins) => bins && bins[i] && bins[i].x0 <= datasets.highlight && datasets.highlight < bins[i].x1 ? palette.accent : palette.ink, thresholds: 24})),
    Plot.ruleY([0], {stroke: palette.ink}),
  ],
});
```

## 26. `box_plot` · Box plot — quartile + outlier summary per category

*Narratives*: distribution, anomaly, composition.
*Marks*: `Plot.boxX` or `Plot.boxY`.

```js
Plot.plot({
  y: {label: null, axis: "left"}, x: {label: null, ticks: 3},
  marks: [
    Plot.boxX(points, {y: "category", x: "value", stroke: palette.ink, fill: palette.rule, fillOpacity: 0.15}),
    Plot.dot(points.filter(p=>p.accent), {y: "category", x: "value", fill: palette.accent, r: 6}),
  ],
});
```

## 27. `qq_plot` · Quantile-quantile plot — two distributions compared

*Narratives*: distribution, correlation.
*Marks*: `Plot.dot` + `Plot.line` (reference).

```js
Plot.plot({
  x: {label: "reference quantile"}, y: {label: "observed quantile"},
  marks: [
    Plot.line([[xMin, yMin], [xMax, yMax]], {stroke: palette.rule, strokeDasharray: "2 3"}),
    Plot.dot(pairs, {x: "ref", y: "obs", fill: palette.ink, r: 3}),
  ],
});
```

## 28. `ridgeline` · Ridgeline — overlapping density curves per category

*Narratives*: distribution, composition.
*Marks*: raw d3 — one `areaY` per category stacked with overlap.

```js
const rowH = 44, gap = -20; // negative gap = overlap
categories.forEach((cat, i) => {
  const y0 = 220 + i * (rowH + gap);
  const area = d3.area().x(d=>x(d.value)).y0(y0+rowH).y1(d=>y0 + rowH - y(d.density)).curve(d3.curveBasis);
  svg.append("path").attr("d", area(cat.density)).attr("fill", palette.ink).attr("fill-opacity", cat.accent ? 0.9 : 0.25)
    .attr("stroke", cat.accent ? palette.accent : palette.ink).attr("stroke-width", 1);
  svg.append("text").attr("x", 80).attr("y", y0+rowH).attr("font-family", palette.bodyFont).attr("font-size", 11).attr("letter-spacing", 2.4).attr("font-weight", 600).attr("fill", palette.ink).text(cat.label.toUpperCase());
});
```

## 29. `waffle_grid` · Waffle grid — discrete X of 100

*Narratives*: concentration, composition.
*Marks*: `Plot.waffle` (native) or raw d3 rect grid.

```js
Plot.plot({
  marginLeft: 0, marginRight: 0, marginTop: 0, marginBottom: 0,
  color: {type: "categorical", range: [palette.accent, palette.rule]},
  marks: [Plot.waffle(segments, {fill: "segment", x: 0, y: "share", unit: 1})],
});
```

## 30. `survey_waffle` · Survey waffle — grouped waffle per category (grouped responses)

*Narratives*: composition, distribution, ranking.
*Marks*: `Plot.waffleY` / `Plot.cell` grid per group.

```js
Plot.plot({
  height: 440, width: 1200,
  fx: {label: null}, x: {axis: null}, y: {axis: null},
  color: {range: [palette.accent, palette.ink, palette.rule]},
  marks: [Plot.waffleY(responses, {fx: "question", y: "count", fill: "answer", unit: 1})],
});
```

## 31. `warming_stripes` · Warming stripes — one cell per year colored by value

*Narratives*: trajectory, scale_surprise.
*Marks*: `Plot.cell`.

```js
Plot.plot({
  height: 200, width: 1280,
  x: {label: null, ticks: 5}, y: {axis: null},
  color: {scheme: "rdbu", reverse: true, legend: false},
  marks: [Plot.cell(data, {x: "year", y: () => 0, fill: "value", inset: 0.5})],
});
```

## 32. `calendar_heatmap` · Calendar heatmap — day × week cells over a year

*Narratives*: distribution, duration, trajectory.
*Marks*: `Plot.cell` with `x: week, y: dayOfWeek, fill: value`.

```js
Plot.plot({
  height: 200, width: 1200, padding: 0,
  x: {axis: "top", tickFormat: (w) => d3.timeFormat("%b")(d3.timeWeek.offset(weekStart, w)), ticks: 12, label: null},
  y: {tickFormat: (d) => "MTWTFSS"[d], ticks: 7, label: null},
  color: {type: "sqrt", range: ["transparent", palette.accent]},
  marks: [Plot.cell(days, {x: "week", y: "dow", fill: "value", inset: 0.5})],
});
```

## 33. `dot_heatmap` · Dot heatmap — binned 2D density with dots

*Narratives*: distribution, correlation, geography.
*Marks*: `Plot.dot` + `Plot.bin`.

```js
Plot.plot({
  x: {label: null, ticks: 4}, y: {label: null, ticks: 4},
  r: {range: [0, 14]},
  marks: [Plot.dot(points, Plot.bin({r: "count"}, {x: "x", y: "y", thresholds: 40, fill: palette.ink}))],
});
```

## 34. `hex_bin` · Hex-bin heatmap — 2D density in hex cells

*Narratives*: distribution, correlation, geography.
*Marks*: `Plot.hexbin` + `Plot.dot`.

```js
Plot.plot({
  x: {label: null, ticks: 4}, y: {label: null, ticks: 4},
  color: {scheme: "ylorbr"},
  marks: [Plot.dot(points, Plot.hexbin({fill: "count"}, {x: "x", y: "y", binWidth: 14}))],
});
```

## 35. `contour_density` · Contour / density stroke — 2D continuous field

*Narratives*: distribution, correlation.
*Marks*: `Plot.density` or `Plot.contour`.

```js
Plot.plot({
  x: {label: null, ticks: 3}, y: {label: null, ticks: 3},
  marks: [
    Plot.density(points, {x: "x", y: "y", stroke: palette.ink, strokeOpacity: 0.4, strokeWidth: 1}),
    Plot.dot(points.filter(p => p.accent), {x: "x", y: "y", fill: palette.accent, r: 6}),
  ],
});
```

## 36. `treemap` · Treemap — nested rectangles weighted by value

*Narratives*: composition, concentration, hierarchy.
*Marks*: raw d3 `d3.treemap`.

```js
const root = d3.hierarchy(tree).sum(d => d.value).sort((a,b) => b.value - a.value);
d3.treemap().size([1200, 480]).padding(2)(root);
root.leaves().forEach(leaf => {
  svg.append("rect").attr("x", 140 + leaf.x0).attr("y", 220 + leaf.y0).attr("width", leaf.x1-leaf.x0).attr("height", leaf.y1-leaf.y0)
    .attr("fill", leaf.data.accent ? palette.accent : palette.ink).attr("fill-opacity", leaf.data.accent ? 1 : 0.85);
  svg.append("text").attr("x", 140 + leaf.x0 + 8).attr("y", 220 + leaf.y0 + 20).attr("fill", "white").attr("font-family", palette.bodyFont).attr("font-size", 11).attr("letter-spacing", 2.4).attr("font-weight", 600).text(leaf.data.name.toUpperCase());
});
```

## 37. `arc_concentration` · Arc concentration — one share of the ring

*Narratives*: concentration, scale_surprise.
*Marks*: `prim.arc` (thin) or raw d3 `d3.arc`.

```js
prim.arc(svg, {
  cx: 1000, cy: 440, r: 200, thickness: 4,
  value: datasets.share, total: 100, color: "accent",
  centerNumber: fmt.pct(datasets.share), centerLabel: "OF TOTAL",
  numberSize: 96,
});
```

## 38. `arc_diagram` · Arc diagram — nodes on a line, arcs between

*Narratives*: flow, hierarchy.
*Marks*: raw d3 — nodes + arcs as `d3.arc` or Bezier.

```js
const xs = nodes.map((n,i) => 140 + i * (1200/(nodes.length-1)));
edges.forEach(e => {
  const x0 = xs[e.source], x1 = xs[e.target];
  const r = Math.abs(x1 - x0) / 2;
  const cx = (x0 + x1) / 2;
  const path = `M ${x0} 480 A ${r} ${r} 0 0 ${x1 > x0 ? 1 : 0} ${x1} 480`;
  svg.append("path").attr("d", path).attr("fill", "none").attr("stroke", e.accent ? palette.accent : palette.ink).attr("stroke-opacity", e.accent ? 0.9 : 0.25).attr("stroke-width", e.accent ? 2 : 1);
});
nodes.forEach((n, i) => {
  svg.append("circle").attr("cx", xs[i]).attr("cy", 480).attr("r", 4).attr("fill", palette.ink);
  svg.append("text").attr("transform", `translate(${xs[i]}, 500) rotate(45)`).attr("font-family", palette.bodyFont).attr("font-size", 11).attr("letter-spacing", 2.4).attr("font-weight", 600).attr("fill", palette.ink).text(n.label.toUpperCase());
});
```

## 39. `choropleth` · Choropleth — regions colored by value

*Narratives*: geography, composition, ranking.
*Marks*: `Plot.geo` with GeoJSON features in `datasets`.

```js
Plot.plot({
  projection: "mercator", // or "equal-earth", "identity" etc
  color: {scheme: "blues", legend: false},
  marks: [
    Plot.geo(datasets.countries, {fill: (d) => datasets.values[d.properties.id] ?? 0, stroke: "white", strokeWidth: 0.5}),
    Plot.geo(datasets.countries.filter(d => datasets.values[d.properties.id] && d.properties.accent), {stroke: palette.accent, strokeWidth: 2}),
  ],
});
```

## 40. `spike_map` · Spike map — geo with vertical spikes per point

*Narratives*: geography, scale_surprise, ranking.
*Marks*: `Plot.geo` + `Plot.vector` (or `Plot.ruleY`).

```js
Plot.plot({
  projection: "mercator",
  length: {range: [0, 120]},
  marks: [
    Plot.geo(datasets.countries, {fill: palette.rule, fillOpacity: 0.2, stroke: "white"}),
    Plot.vector(datasets.cities, {x: "lon", y: "lat", length: "value", rotate: 0, stroke: palette.ink, strokeWidth: 1.5, anchor: "start"}),
    Plot.dot(datasets.cities.filter(c=>c.accent), {x: "lon", y: "lat", fill: palette.accent, r: 4}),
  ],
});
```

---

## Dense-data encouragement

The Art Director is expected to use **dense visualizations** when the insight supports it. Good models:

- **Impact of Vaccines** (`plot-impact-of-vaccines`) — a `Plot.cell` heatmap with decades × US states as a wall of color showing a single intervention's effect. Every cell is a datum. Use `calendar_heatmap` or `warming_stripes` or custom `Plot.cell` when the insight is "N rows × M years of data, one moment changes everything".
- **Survey Waffle** (`plot-survey-waffle`) — a grid of grouped waffles answering "how did each demographic group respond". Use `survey_waffle` when the insight has 4-6 sub-groups each with a composition.
- **Horizon chart** (`plot-unemployment-horizon-chart`) — 50 US states as 50 horizon bands. When the insight has "many parallel trajectories, one compact view", pick `horizon_chart` or `sparkline_grid` (50+ rows is not too many).

If an insight has 3 data points, use hero_number or slope. If it has 30 data points, use a trajectory recipe. If it has 300 data points, use a density / heatmap / waffle recipe. **Do not under-use the data.** A waffle with 4 cells is a failure; a waffle with 400 cells is a triumph.

## How to use this catalog

1. Insight Hunter feeds the AD a pool of insights (~20–40).
2. For each slide (10–15 total), the AD picks:
   - ONE recipe (usually) or TWO recipes (when two views of the same insight lock together naturally — e.g. choropleth + histogram, or index_chart + connected_scatter).
   - One narrative tag per slide.
   - Headline + optional subhead + optional footnote.
3. Across the deck: each recipe used AT MOST twice (with different data); 10+ recipes distinct overall. The deck should showcase the breadth of the catalog.
4. Slide Designer implements the chosen recipe(s) under Swiss discipline (flush-left, Inter, ink + one accent, negative space).
