// Composition primitives for editorial slides.
// Every helper takes an SVG d3-selection (or group) as first arg and returns
// the node it appended so callers can chain further tweaks.

export function createPrimitives(d3, palette) {
  const colorOf = (c) => {
    if (!c) return palette.primary;
    if (c === "primary") return palette.primary;
    if (c === "accent") return palette.accent;
    if (c === "ink") return palette.ink;
    if (c === "rule") return palette.rule;
    if (typeof c === "string" && c.startsWith("secondary:")) {
      const i = parseInt(c.slice("secondary:".length), 10) || 0;
      return palette.secondary[i] || palette.primary;
    }
    return c;
  };

  // ── heroNumber ──────────────────────────────────────────────────────────
  // Giant numeral with an accent rule, small-caps label, italic sub-label.
  // opts: {x, y, size=220, color="accent", align="left",
  //        subLabel, subSubLabel, ruleLength=340}
  function heroNumber(svg, text, opts = {}) {
    const {
      x = 140, y = 260, size = 220,
      color = "accent", align = "left",
      subLabel, subSubLabel, ruleLength = 340,
    } = opts;
    const g = svg.append("g").attr("class", "prim-hero");
    const fill = colorOf(color);
    const anchor = align === "right" ? "end" : align === "center" ? "middle" : "start";

    g.append("text")
      .attr("x", x).attr("y", y)
      .attr("text-anchor", anchor)
      .attr("font-family", palette.headingFont)
      .attr("font-size", size).attr("font-weight", 400)
      .attr("letter-spacing", -Math.max(2, size * 0.03))
      .attr("fill", fill)
      .text(text);

    let cursorY = y + 22;
    if (subLabel) {
      g.append("line")
        .attr("x1", x)
        .attr("x2", align === "right" ? x - ruleLength : x + ruleLength)
        .attr("y1", cursorY).attr("y2", cursorY)
        .attr("stroke", fill).attr("stroke-width", 2);
      g.append("text")
        .attr("x", x).attr("y", cursorY + 30)
        .attr("text-anchor", anchor)
        .attr("font-family", palette.bodyFont).attr("font-size", 13)
        .attr("letter-spacing", 2.8).attr("font-weight", 600)
        .attr("fill", palette.ink)
        .text(String(subLabel).toUpperCase());
      cursorY += 60;
    }
    if (subSubLabel) {
      g.append("text")
        .attr("x", x).attr("y", cursorY + 6)
        .attr("text-anchor", anchor)
        .attr("font-family", palette.headingFont).attr("font-style", "italic")
        .attr("font-size", 22).attr("fill", palette.ink).attr("fill-opacity", 0.7)
        .text(subSubLabel);
    }
    return g;
  }

  // ── bodyCopy ────────────────────────────────────────────────────────────
  // Paragraphs in a foreignObject. `paragraphs` is a string or array of
  // objects {text, italic?, heading?, size?, color?}.
  function bodyCopy(svg, paragraphs, opts = {}) {
    const {
      x = 820, y = 160, width = 640, height = 260,
      size = 21, color = "ink",
    } = opts;
    const paras = Array.isArray(paragraphs)
      ? paragraphs
      : [{ text: String(paragraphs) }];

    const fo = svg.append("foreignObject")
      .attr("x", x).attr("y", y)
      .attr("width", width).attr("height", height);
    const div = fo.append("xhtml:div")
      .attr("xmlns", "http://www.w3.org/1999/xhtml")
      .style("font-family", palette.bodyFont)
      .style("font-size", size + "px")
      .style("line-height", "1.5")
      .style("color", colorOf(color));

    paras.forEach((p, i) => {
      const isStr = typeof p === "string";
      const text = isStr ? p : p.text;
      const italic = !isStr && p.italic;
      const heading = !isStr && p.heading;
      const pSize = !isStr && p.size ? p.size : (heading ? size + 5 : size);
      const pColor = !isStr && p.color ? colorOf(p.color) : null;
      const el = div.append("xhtml:p")
        .style("margin", i === paras.length - 1 ? "0" : "0 0 16px 0")
        .style("font-size", pSize + "px")
        .text(text);
      if (italic) el.style("font-style", "italic");
      if (heading) el.style("font-family", palette.headingFont).style("line-height", "1.3");
      if (pColor) el.style("color", pColor);
    });

    return fo;
  }

  // ── rule ────────────────────────────────────────────────────────────────
  // Editorial horizontal rules. kind: "hairline", "accent", "dashed", "double"
  function rule(svg, opts = {}) {
    const {
      x = 140, y = 400, width = 1320,
      kind = "hairline", color = "ink",
      opacity = 0.35, strokeWidth,
    } = opts;
    const fill = colorOf(color);
    const g = svg.append("g").attr("class", "prim-rule");
    if (kind === "accent") {
      g.append("line")
        .attr("x1", x).attr("x2", x + width).attr("y1", y).attr("y2", y)
        .attr("stroke", colorOf("accent"))
        .attr("stroke-width", strokeWidth ?? 2);
    } else if (kind === "dashed") {
      g.append("line")
        .attr("x1", x).attr("x2", x + width).attr("y1", y).attr("y2", y)
        .attr("stroke", fill).attr("stroke-opacity", opacity)
        .attr("stroke-width", strokeWidth ?? 1)
        .attr("stroke-dasharray", "4 6");
    } else if (kind === "double") {
      g.append("line").attr("x1", x).attr("x2", x + width).attr("y1", y).attr("y2", y)
        .attr("stroke", fill).attr("stroke-opacity", opacity).attr("stroke-width", 1);
      g.append("line").attr("x1", x).attr("x2", x + width).attr("y1", y + 4).attr("y2", y + 4)
        .attr("stroke", fill).attr("stroke-opacity", opacity).attr("stroke-width", 1);
    } else {
      g.append("line")
        .attr("x1", x).attr("x2", x + width).attr("y1", y).attr("y2", y)
        .attr("stroke", fill).attr("stroke-opacity", opacity)
        .attr("stroke-width", strokeWidth ?? 1);
    }
    return g;
  }

  // ── caption ─────────────────────────────────────────────────────────────
  // Small KPI stack: eyebrow (small-caps), big number, label (small-caps).
  function caption(svg, opts = {}) {
    const {
      x = 140, y = 400, eyebrow, number, label, italicSub,
      color = "primary", align = "left", numberSize = 56,
    } = opts;
    const anchor = align === "right" ? "end" : align === "center" ? "middle" : "start";
    const g = svg.append("g").attr("class", "prim-caption");
    let cy = y;
    if (eyebrow) {
      g.append("text")
        .attr("x", x).attr("y", cy).attr("text-anchor", anchor)
        .attr("font-family", palette.bodyFont).attr("font-size", 12)
        .attr("letter-spacing", 2.2).attr("font-weight", 600)
        .attr("fill", palette.ink).attr("fill-opacity", 0.7)
        .text(String(eyebrow).toUpperCase());
      cy += 14;
    }
    if (number != null && number !== "") {
      g.append("text")
        .attr("x", x).attr("y", cy + numberSize * 0.85).attr("text-anchor", anchor)
        .attr("font-family", palette.headingFont)
        .attr("font-size", numberSize).attr("font-weight", 400)
        .attr("fill", colorOf(color))
        .text(number);
      cy += numberSize + 8;
    }
    if (label) {
      g.append("text")
        .attr("x", x).attr("y", cy).attr("text-anchor", anchor)
        .attr("font-family", palette.bodyFont).attr("font-size", 12)
        .attr("letter-spacing", 2.2).attr("font-weight", 600)
        .attr("fill", palette.ink).attr("fill-opacity", 0.7)
        .text(String(label).toUpperCase());
      cy += 18;
    }
    if (italicSub) {
      g.append("text")
        .attr("x", x).attr("y", cy).attr("text-anchor", anchor)
        .attr("font-family", palette.bodyFont).attr("font-size", 14)
        .attr("font-style", "italic")
        .attr("fill", palette.ink).attr("fill-opacity", 0.7)
        .text(italicSub);
    }
    return g;
  }

  // ── leader ──────────────────────────────────────────────────────────────
  // Curved dashed leader with optional italic label near the midpoint.
  // from/to: {x, y}. opts: {curve=0.3, dashed=true, color="accent",
  //                          label, labelOffsetY=-12, strokeWidth=1.25}
  function leader(svg, from, to, opts = {}) {
    const {
      curve = 0.3, dashed = true, color = "accent",
      label, labelOffsetY = -12, strokeWidth = 1.25,
      opacity = 0.75,
    } = opts;
    const fill = colorOf(color);
    const dx = to.x - from.x, dy = to.y - from.y;
    const len = Math.hypot(dx, dy);
    // Perpendicular offset for the control point.
    const nx = -dy / (len || 1), ny = dx / (len || 1);
    const cx = (from.x + to.x) / 2 + nx * len * curve;
    const cy = (from.y + to.y) / 2 + ny * len * curve;
    const d = `M ${from.x} ${from.y} Q ${cx} ${cy} ${to.x} ${to.y}`;

    const g = svg.append("g").attr("class", "prim-leader");
    const path = g.append("path")
      .attr("d", d).attr("fill", "none")
      .attr("stroke", fill).attr("stroke-opacity", opacity)
      .attr("stroke-width", strokeWidth);
    if (dashed) path.attr("stroke-dasharray", "3 5");

    if (label) {
      const midX = 0.25 * from.x + 0.5 * cx + 0.25 * to.x;
      const midY = 0.25 * from.y + 0.5 * cy + 0.25 * to.y;
      g.append("text")
        .attr("x", midX).attr("y", midY + labelOffsetY)
        .attr("text-anchor", "middle")
        .attr("font-family", palette.bodyFont).attr("font-style", "italic")
        .attr("font-size", 13).attr("fill", fill)
        .text(label);
    }
    return g;
  }

  // ── callout ─────────────────────────────────────────────────────────────
  // Anchored editorial block: small-caps label, body sentence, optional rule.
  function callout(svg, opts = {}) {
    const {
      x = 1100, y = 300, width = 320,
      label, body, italic = true,
      color = "primary", showRule = true,
    } = opts;
    const g = svg.append("g").attr("class", "prim-callout");
    const fill = colorOf(color);
    let cy = y;
    if (showRule) {
      g.append("line")
        .attr("x1", x).attr("x2", x + 60).attr("y1", cy).attr("y2", cy)
        .attr("stroke", fill).attr("stroke-width", 2);
      cy += 22;
    }
    if (label) {
      g.append("text")
        .attr("x", x).attr("y", cy)
        .attr("font-family", palette.bodyFont).attr("font-size", 12)
        .attr("letter-spacing", 2.4).attr("font-weight", 600)
        .attr("fill", fill).text(String(label).toUpperCase());
      cy += 22;
    }
    if (body) {
      const fo = g.append("foreignObject")
        .attr("x", x).attr("y", cy).attr("width", width).attr("height", 260);
      const div = fo.append("xhtml:div")
        .attr("xmlns", "http://www.w3.org/1999/xhtml")
        .style("font-family", italic ? palette.headingFont : palette.bodyFont)
        .style("font-style", italic ? "italic" : "normal")
        .style("font-size", italic ? "22px" : "17px")
        .style("line-height", "1.35")
        .style("color", palette.ink);
      div.append("xhtml:p").style("margin", "0").text(body);
    }
    return g;
  }

  // ── timeline ────────────────────────────────────────────────────────────
  // A horizontal year axis. Returns an object with helpers `x(year)`,
  // and draws the base rule + ticks + optional "today" marker.
  function timeline(svg, opts = {}) {
    const {
      x = 140, y = 430, width = 1320,
      fromYear, toYear,
      ticks = [],
      todayYear, todayLabel = "TODAY",
      tickLabels = true,
    } = opts;
    const span = Math.max(1, toYear - fromYear);
    const xFor = (yr) => x + ((yr - fromYear) / span) * width;

    const g = svg.append("g").attr("class", "prim-timeline");
    g.append("line")
      .attr("x1", x).attr("x2", x + width).attr("y1", y).attr("y2", y)
      .attr("stroke", palette.ink).attr("stroke-width", 1);

    ticks.forEach((yr) => {
      g.append("line")
        .attr("x1", xFor(yr)).attr("x2", xFor(yr))
        .attr("y1", y - 5).attr("y2", y + 5)
        .attr("stroke", palette.ink);
      if (tickLabels) {
        g.append("text")
          .attr("x", xFor(yr)).attr("y", y - 16)
          .attr("text-anchor", "middle")
          .attr("font-family", palette.bodyFont).attr("font-size", 13)
          .attr("letter-spacing", 1.6).attr("font-weight", 600)
          .attr("fill", palette.ink).attr("fill-opacity", 0.55)
          .text(yr);
      }
    });

    if (todayYear != null) {
      g.append("rect")
        .attr("x", xFor(todayYear) - 5).attr("y", y - 5)
        .attr("width", 10).attr("height", 10)
        .attr("fill", palette.accent);
      if (todayLabel) {
        g.append("text")
          .attr("x", xFor(todayYear) + 14).attr("y", y + 18)
          .attr("font-family", palette.bodyFont).attr("font-size", 11)
          .attr("letter-spacing", 2.2).attr("font-weight", 600)
          .attr("fill", palette.accent).text(todayLabel);
      }
    }

    return { g, x: xFor, xLeft: x, xRight: x + width, y };
  }

  // ── timelineTrack ───────────────────────────────────────────────────────
  // A single bar/line from fromYear to toYear along a shared axis, with a
  // large end-year numeral + small-caps label + italic caption.
  function timelineTrack(svg, axis, opts = {}) {
    const {
      y, fromYear, toYear,
      kind = "bar", color = "primary",
      label, italicSub, numberSize = 56,
      barHeight = 16, lineOpacity = 1,
    } = opts;
    const fill = colorOf(color);
    const xStart = axis.x(fromYear);
    const xEnd = axis.x(toYear);
    const g = svg.append("g").attr("class", "prim-track");

    if (kind === "bar") {
      g.append("rect")
        .attr("x", xStart).attr("y", y - barHeight / 2)
        .attr("width", xEnd - xStart).attr("height", barHeight)
        .attr("fill", fill);
    } else if (kind === "thin") {
      g.append("rect")
        .attr("x", xStart).attr("y", y - 3)
        .attr("width", xEnd - xStart).attr("height", 6)
        .attr("fill", fill).attr("fill-opacity", 0.45);
    } else {
      g.append("line")
        .attr("x1", xStart).attr("x2", xEnd).attr("y1", y).attr("y2", y)
        .attr("stroke", fill).attr("stroke-width", 3)
        .attr("stroke-opacity", lineOpacity);
    }

    g.append("text")
      .attr("x", xEnd + 14).attr("y", y + numberSize * 0.18)
      .attr("font-family", palette.headingFont)
      .attr("font-size", numberSize).attr("font-weight", 400)
      .attr("fill", palette.primary).text(Math.round(toYear));

    if (label) {
      g.append("text")
        .attr("x", xEnd + 14).attr("y", y + numberSize * 0.18 + 22)
        .attr("font-family", palette.bodyFont).attr("font-size", 12)
        .attr("letter-spacing", 2.2).attr("font-weight", 600)
        .attr("fill", palette.ink).attr("fill-opacity", 0.7)
        .text(String(label).toUpperCase());
    }
    if (italicSub) {
      g.append("text")
        .attr("x", axis.xLeft).attr("y", y + barHeight / 2 + 26)
        .attr("font-family", palette.bodyFont).attr("font-size", 14)
        .attr("font-style", "italic")
        .attr("fill", palette.ink).attr("fill-opacity", 0.75)
        .text(italicSub);
    }
    return g;
  }

  // ── isotype ─────────────────────────────────────────────────────────────
  // Icon-array: n filled icons out of `total`, arranged in `cols` columns.
  // opts: {x, y, total=100, value, cols=20, gap=8, size=24, icon="square",
  //        color="accent", dimColor="rule"}
  function isotype(svg, opts = {}) {
    const {
      x = 160, y = 200, total = 100, value = 0,
      cols = 20, gap = 8, size = 24,
      icon = "square", color = "accent", dimColor = "rule",
      dimOpacity = 0.22,
    } = opts;
    const g = svg.append("g").attr("class", "prim-isotype");
    const filled = Math.round(total * (value / 100));
    for (let i = 0; i < total; i++) {
      const c = i % cols;
      const r = Math.floor(i / cols);
      const ix = x + c * (size + gap);
      const iy = y + r * (size + gap);
      const isOn = i < filled;
      const fill = isOn ? colorOf(color) : colorOf(dimColor);
      const opacity = isOn ? 1 : dimOpacity;
      if (icon === "circle") {
        g.append("circle")
          .attr("cx", ix + size / 2).attr("cy", iy + size / 2)
          .attr("r", size / 2).attr("fill", fill).attr("fill-opacity", opacity);
      } else if (icon === "person") {
        const personG = g.append("g")
          .attr("transform", `translate(${ix},${iy})`)
          .attr("fill", fill).attr("fill-opacity", opacity);
        personG.append("circle").attr("cx", size / 2).attr("cy", size * 0.28).attr("r", size * 0.22);
        personG.append("rect")
          .attr("x", size * 0.22).attr("y", size * 0.52)
          .attr("width", size * 0.56).attr("height", size * 0.48)
          .attr("rx", 2);
      } else {
        g.append("rect")
          .attr("x", ix).attr("y", iy)
          .attr("width", size).attr("height", size)
          .attr("fill", fill).attr("fill-opacity", opacity);
      }
    }
    return g;
  }

  // ── figure ──────────────────────────────────────────────────────────────
  // Simple editorial silhouettes used as anchors along a timeline or axis.
  // kind: "ship", "turbine", "building", "tower", "person", "oil_rig"
  // opts: {x, y, w=60, color="primary"}
  function figure(svg, kind, opts = {}) {
    const { x = 0, y = 0, w = 60, color = "primary" } = opts;
    const fill = colorOf(color);
    const g = svg.append("g")
      .attr("class", "prim-figure")
      .attr("transform", `translate(${x},${y})`)
      .attr("color", fill);

    if (kind === "ship") {
      // Hull, bridge, containers stack.
      const s = w / 76;
      g.append("path")
        .attr("d", `M 0 ${22 * s} L ${76 * s} ${22 * s} L ${72 * s} ${30 * s} L ${4 * s} ${30 * s} Z`)
        .attr("fill", "currentColor");
      g.append("rect")
        .attr("x", 60 * s).attr("y", 10 * s)
        .attr("width", 8 * s).attr("height", 12 * s)
        .attr("fill", "currentColor");
      g.append("line")
        .attr("x1", 66 * s).attr("y1", 10 * s)
        .attr("x2", 66 * s).attr("y2", 2 * s)
        .attr("stroke", "currentColor").attr("stroke-width", 1);
      for (let c = 0; c < 6; c++) {
        for (let r = 0; r < 2; r++) {
          g.append("rect")
            .attr("x", (8 + c * 8) * s).attr("y", (16 - r * 6) * s)
            .attr("width", 7 * s).attr("height", 5 * s)
            .attr("fill", "currentColor");
        }
      }
    } else if (kind === "turbine") {
      const h = w * 0.9;
      g.append("line")
        .attr("x1", 0).attr("y1", 0).attr("x2", 0).attr("y2", -h)
        .attr("stroke", "currentColor").attr("stroke-width", Math.max(1.4, w * 0.05));
      g.append("circle").attr("cx", 0).attr("cy", -h).attr("r", w * 0.08)
        .attr("fill", "currentColor");
      for (let b = 0; b < 3; b++) {
        const ang = (b * 120 - 30) * Math.PI / 180;
        const bladeLen = w * 0.5;
        g.append("line")
          .attr("x1", Math.cos(ang) * w * 0.08)
          .attr("y1", Math.sin(ang) * w * 0.08 - h)
          .attr("x2", Math.cos(ang) * bladeLen)
          .attr("y2", Math.sin(ang) * bladeLen - h)
          .attr("stroke", "currentColor")
          .attr("stroke-width", Math.max(1, w * 0.035));
      }
    } else if (kind === "building") {
      // Stepped skyscraper silhouette.
      const h = w * 1.6;
      g.append("rect")
        .attr("x", -w * 0.25).attr("y", -h * 0.55)
        .attr("width", w * 0.5).attr("height", h * 0.55)
        .attr("fill", "currentColor");
      g.append("rect")
        .attr("x", -w * 0.4).attr("y", -h * 0.35)
        .attr("width", w * 0.22).attr("height", h * 0.35)
        .attr("fill", "currentColor");
      g.append("rect")
        .attr("x", w * 0.18).attr("y", -h * 0.4)
        .attr("width", w * 0.22).attr("height", h * 0.4)
        .attr("fill", "currentColor");
      // Window grid hint.
      for (let r = 0; r < 4; r++) {
        g.append("line")
          .attr("x1", -w * 0.22).attr("x2", w * 0.22)
          .attr("y1", -h * 0.52 + r * (h * 0.1))
          .attr("y2", -h * 0.52 + r * (h * 0.1))
          .attr("stroke", palette.rule).attr("stroke-width", 0.8);
      }
    } else if (kind === "tower") {
      // Transmission/telecom tower.
      const h = w * 1.5;
      g.append("line").attr("x1", -w * 0.25).attr("y1", 0)
        .attr("x2", 0).attr("y2", -h)
        .attr("stroke", "currentColor").attr("stroke-width", 1.4);
      g.append("line").attr("x1", w * 0.25).attr("y1", 0)
        .attr("x2", 0).attr("y2", -h)
        .attr("stroke", "currentColor").attr("stroke-width", 1.4);
      for (let i = 1; i <= 4; i++) {
        const yy = -h + (h * i / 5);
        const half = (w * 0.25) * (i / 5);
        g.append("line")
          .attr("x1", -half).attr("y1", yy)
          .attr("x2", half).attr("y2", yy)
          .attr("stroke", "currentColor").attr("stroke-width", 1);
      }
    } else if (kind === "person") {
      const s = w / 40;
      g.append("circle").attr("cx", 0).attr("cy", -32 * s).attr("r", 8 * s)
        .attr("fill", "currentColor");
      g.append("rect")
        .attr("x", -10 * s).attr("y", -22 * s)
        .attr("width", 20 * s).attr("height", 22 * s)
        .attr("fill", "currentColor");
    } else if (kind === "oil_rig") {
      const s = w / 80;
      // Platform
      g.append("rect")
        .attr("x", 0).attr("y", 0).attr("width", 80 * s).attr("height", 5 * s)
        .attr("fill", "currentColor");
      // Legs into the water
      g.append("line").attr("x1", 10 * s).attr("y1", 5 * s)
        .attr("x2", 10 * s).attr("y2", 28 * s)
        .attr("stroke", "currentColor").attr("stroke-width", 1.4);
      g.append("line").attr("x1", 70 * s).attr("y1", 5 * s)
        .attr("x2", 70 * s).attr("y2", 28 * s)
        .attr("stroke", "currentColor").attr("stroke-width", 1.4);
      // Derrick
      g.append("line").attr("x1", 30 * s).attr("y1", 0)
        .attr("x2", 40 * s).attr("y2", -44 * s)
        .attr("stroke", "currentColor").attr("stroke-width", 1);
      g.append("line").attr("x1", 50 * s).attr("y1", 0)
        .attr("x2", 40 * s).attr("y2", -44 * s)
        .attr("stroke", "currentColor").attr("stroke-width", 1);
      for (let i = 1; i <= 4; i++) {
        const yy = -44 * s * (i / 5);
        const half = 10 * s * ((5 - i) / 5);
        g.append("line")
          .attr("x1", 40 * s - half).attr("y1", yy)
          .attr("x2", 40 * s + half).attr("y2", yy)
          .attr("stroke", "currentColor").attr("stroke-width", 0.8);
      }
    }
    return g;
  }

  // ── figureRow ───────────────────────────────────────────────────────────
  // Evenly-spaced figures along a horizontal span, handy for PPA/turbine
  // or port/crane rows.
  function figureRow(svg, kind, opts = {}) {
    const { xStart, xEnd, y, count = 6, w = 36, color = "primary" } = opts;
    const g = svg.append("g").attr("class", "prim-figure-row");
    const span = xEnd - xStart;
    for (let i = 0; i < count; i++) {
      const tx = xStart + span * ((i + 0.5) / count);
      figure(g, kind, { x: tx, y, w, color });
    }
    return g;
  }

  // ── arc ─────────────────────────────────────────────────────────────────
  // Partial ring / donut for concentration archetype. Draws a "filled"
  // sector proportional to value/total, with the remainder in ghost.
  // opts: {cx, cy, r=180, thickness=40, value, total=100, startAngle=-Math.PI/2,
  //        color="accent", ghostColor="rule", ghostOpacity=0.25,
  //        centerNumber, centerLabel, centerSub, numberSize=96}
  function arc(svg, opts = {}) {
    const {
      cx = 800, cy = 500, r = 180, thickness = 40,
      value = 0, total = 100, startAngle = -Math.PI / 2,
      color = "accent", ghostColor = "rule", ghostOpacity = 0.25,
      centerNumber, centerLabel, centerSub, numberSize = 96,
    } = opts;
    const fill = colorOf(color);
    const g = svg.append("g").attr("class", "prim-arc");
    const frac = Math.max(0, Math.min(1, value / total));
    const endAngle = startAngle + frac * 2 * Math.PI;
    const gen = d3.arc()
      .innerRadius(r - thickness).outerRadius(r);
    g.append("path")
      .attr("transform", `translate(${cx},${cy})`)
      .attr("d", gen({ startAngle, endAngle }))
      .attr("fill", fill);
    g.append("path")
      .attr("transform", `translate(${cx},${cy})`)
      .attr("d", gen({ startAngle: endAngle, endAngle: startAngle + 2 * Math.PI }))
      .attr("fill", colorOf(ghostColor)).attr("fill-opacity", ghostOpacity);
    if (centerNumber != null) {
      g.append("text")
        .attr("x", cx).attr("y", cy + numberSize * 0.1)
        .attr("text-anchor", "middle")
        .attr("font-family", palette.headingFont)
        .attr("font-size", numberSize).attr("font-weight", 400)
        .attr("fill", fill).text(centerNumber);
    }
    if (centerLabel) {
      g.append("text")
        .attr("x", cx).attr("y", cy + numberSize * 0.55)
        .attr("text-anchor", "middle")
        .attr("font-family", palette.bodyFont).attr("font-size", 12)
        .attr("letter-spacing", 2.4).attr("font-weight", 600)
        .attr("fill", palette.ink).attr("fill-opacity", 0.7)
        .text(String(centerLabel).toUpperCase());
    }
    if (centerSub) {
      g.append("text")
        .attr("x", cx).attr("y", cy + numberSize * 0.85)
        .attr("text-anchor", "middle")
        .attr("font-family", palette.bodyFont).attr("font-size", 14)
        .attr("font-style", "italic")
        .attr("fill", palette.ink).attr("fill-opacity", 0.7)
        .text(centerSub);
    }
    return g;
  }

  // ── slopeLine ───────────────────────────────────────────────────────────
  // Two-point slope chart. Two labelled endpoints joined by a line; the
  // slope carries the argument. opts: {xLeft, xRight, yTop, yBottom,
  //   valueLeft, valueRight, minValue, maxValue,
  //   labelLeft, labelRight, numberLeft, numberRight,
  //   color="primary", accentRight=true, dotRadius=6}
  function slopeLine(svg, opts = {}) {
    const {
      xLeft = 320, xRight = 1280, yTop = 460, yBottom = 760,
      valueLeft, valueRight,
      minValue, maxValue,
      labelLeft, labelRight, numberLeft, numberRight,
      color = "primary", accentRight = true, dotRadius = 6,
      labelLeftSub, labelRightSub,
    } = opts;
    const span = yBottom - yTop;
    const vMin = minValue != null ? minValue : Math.min(valueLeft, valueRight);
    const vMax = maxValue != null ? maxValue : Math.max(valueLeft, valueRight);
    const vSpan = Math.max(1e-9, vMax - vMin);
    const yFor = (v) => yBottom - ((v - vMin) / vSpan) * span;
    const yL = yFor(valueLeft), yR = yFor(valueRight);
    const lineColor = colorOf(color);
    const endColor = accentRight ? colorOf("accent") : lineColor;

    const g = svg.append("g").attr("class", "prim-slope");
    // Ghost reference rules at each pole.
    g.append("line").attr("x1", xLeft).attr("x2", xLeft)
      .attr("y1", yTop - 20).attr("y2", yBottom + 20)
      .attr("stroke", palette.rule).attr("stroke-opacity", 0.4)
      .attr("stroke-dasharray", "2 4");
    g.append("line").attr("x1", xRight).attr("x2", xRight)
      .attr("y1", yTop - 20).attr("y2", yBottom + 20)
      .attr("stroke", palette.rule).attr("stroke-opacity", 0.4)
      .attr("stroke-dasharray", "2 4");

    g.append("line")
      .attr("x1", xLeft).attr("y1", yL)
      .attr("x2", xRight).attr("y2", yR)
      .attr("stroke", lineColor).attr("stroke-width", 2);

    g.append("circle").attr("cx", xLeft).attr("cy", yL).attr("r", dotRadius)
      .attr("fill", lineColor);
    g.append("circle").attr("cx", xRight).attr("cy", yR).attr("r", dotRadius + 2)
      .attr("fill", endColor);

    const writeStack = (x, y, anchor, number, label, sub) => {
      if (number != null) {
        svg.append("text")
          .attr("x", x).attr("y", y - 22).attr("text-anchor", anchor)
          .attr("font-family", palette.headingFont).attr("font-size", 44)
          .attr("fill", anchor === "end" ? endColor : lineColor)
          .text(number);
      }
      if (label) {
        svg.append("text")
          .attr("x", x).attr("y", y + 24).attr("text-anchor", anchor)
          .attr("font-family", palette.bodyFont).attr("font-size", 12)
          .attr("letter-spacing", 2.2).attr("font-weight", 600)
          .attr("fill", palette.ink).attr("fill-opacity", 0.7)
          .text(String(label).toUpperCase());
      }
      if (sub) {
        svg.append("text")
          .attr("x", x).attr("y", y + 44).attr("text-anchor", anchor)
          .attr("font-family", palette.bodyFont).attr("font-size", 13)
          .attr("font-style", "italic")
          .attr("fill", palette.ink).attr("fill-opacity", 0.65)
          .text(sub);
      }
    };
    writeStack(xLeft - 16, yL, "end", numberLeft, labelLeft, labelLeftSub);
    writeStack(xRight + 16, yR, "start", numberRight, labelRight, labelRightSub);
    return g;
  }

  // ── sparkline ───────────────────────────────────────────────────────────
  // Multi-point trajectory inside a tight band. Good for a path with a
  // single accented turning point. opts: {x, y, width, height, values,
  //   accentIndex, color="primary", showDots=false, labelStart, labelEnd,
  //   numberStart, numberEnd}
  function sparkline(svg, opts = {}) {
    const {
      x = 160, y = 480, width = 1280, height = 220,
      values = [], accentIndex = -1,
      color = "primary", showDots = false,
      labelStart, labelEnd, numberStart, numberEnd,
    } = opts;
    if (!values.length) return svg.append("g");
    const vMin = Math.min(...values), vMax = Math.max(...values);
    const vSpan = Math.max(1e-9, vMax - vMin);
    const n = values.length;
    const xFor = (i) => x + (i / Math.max(1, n - 1)) * width;
    const yFor = (v) => y + height - ((v - vMin) / vSpan) * height;
    const g = svg.append("g").attr("class", "prim-sparkline");

    // Baseline
    g.append("line")
      .attr("x1", x).attr("x2", x + width)
      .attr("y1", y + height).attr("y2", y + height)
      .attr("stroke", palette.rule).attr("stroke-opacity", 0.45);

    const lineGen = d3.line().x((_, i) => xFor(i)).y((v) => yFor(v)).curve(d3.curveMonotoneX);
    g.append("path")
      .attr("d", lineGen(values)).attr("fill", "none")
      .attr("stroke", colorOf(color)).attr("stroke-width", 2.5);

    if (showDots) {
      values.forEach((v, i) => {
        g.append("circle")
          .attr("cx", xFor(i)).attr("cy", yFor(v)).attr("r", 3)
          .attr("fill", colorOf(color));
      });
    }
    if (accentIndex >= 0 && accentIndex < n) {
      g.append("circle")
        .attr("cx", xFor(accentIndex)).attr("cy", yFor(values[accentIndex]))
        .attr("r", 8).attr("fill", colorOf("accent"));
    }

    const writeEnd = (xp, yp, anchor, number, label) => {
      if (number != null) {
        g.append("text")
          .attr("x", xp).attr("y", yp - 14).attr("text-anchor", anchor)
          .attr("font-family", palette.headingFont).attr("font-size", 36)
          .attr("fill", palette.primary).text(number);
      }
      if (label) {
        g.append("text")
          .attr("x", xp).attr("y", yp + 22).attr("text-anchor", anchor)
          .attr("font-family", palette.bodyFont).attr("font-size", 11)
          .attr("letter-spacing", 2.2).attr("font-weight", 600)
          .attr("fill", palette.ink).attr("fill-opacity", 0.7)
          .text(String(label).toUpperCase());
      }
    };
    writeEnd(xFor(0) - 10, yFor(values[0]), "end", numberStart, labelStart);
    writeEnd(xFor(n - 1) + 10, yFor(values[n - 1]), "start", numberEnd, labelEnd);
    return g;
  }

  // ── rankedDots ──────────────────────────────────────────────────────────
  // Ranked dot plot: a family of peers, one visibly different. Each item
  // gets a small-caps label, a horizontal lane, and one dot at its value.
  // opts: {x, y, width, items:[{label, value, accent?, italicSub?}],
  //   maxValue, minValue=0, color="primary", rowHeight=44, dotRadius=8,
  //   valueFormatter, showAxis=true}
  function rankedDots(svg, opts = {}) {
    const {
      x = 180, y = 460, width = 1240,
      items = [], maxValue, minValue = 0,
      color = "primary", rowHeight = 44,
      dotRadius = 8, valueFormatter,
      showAxis = true,
    } = opts;
    const vMax = maxValue != null ? maxValue : Math.max(...items.map((i) => i.value), 1);
    const xFor = (v) => x + ((v - minValue) / Math.max(1e-9, vMax - minValue)) * width;
    const g = svg.append("g").attr("class", "prim-ranked");
    const fmtValue = valueFormatter || ((v) => String(v));

    items.forEach((it, idx) => {
      const ry = y + idx * rowHeight;
      // Row baseline.
      g.append("line")
        .attr("x1", x).attr("x2", x + width)
        .attr("y1", ry).attr("y2", ry)
        .attr("stroke", palette.rule).attr("stroke-opacity", 0.35);
      // Label.
      g.append("text")
        .attr("x", x - 16).attr("y", ry + 4).attr("text-anchor", "end")
        .attr("font-family", palette.bodyFont).attr("font-size", 12)
        .attr("letter-spacing", 2.2).attr("font-weight", 600)
        .attr("fill", palette.ink).attr("fill-opacity", it.accent ? 1 : 0.7)
        .text(String(it.label).toUpperCase());
      // Dot.
      const dotColor = it.accent ? colorOf("accent") : colorOf(color);
      const dotR = it.accent ? dotRadius + 2 : dotRadius;
      g.append("circle")
        .attr("cx", xFor(it.value)).attr("cy", ry)
        .attr("r", dotR).attr("fill", dotColor);
      // Value label past the dot.
      g.append("text")
        .attr("x", xFor(it.value) + dotR + 10).attr("y", ry + 5)
        .attr("font-family", palette.headingFont).attr("font-size", it.accent ? 24 : 18)
        .attr("fill", it.accent ? colorOf("accent") : palette.ink)
        .text(fmtValue(it.value));
      if (it.italicSub) {
        g.append("text")
          .attr("x", xFor(it.value) + dotR + 10).attr("y", ry + 22)
          .attr("font-family", palette.bodyFont).attr("font-size", 12)
          .attr("font-style", "italic")
          .attr("fill", palette.ink).attr("fill-opacity", 0.6)
          .text(it.italicSub);
      }
    });

    if (showAxis) {
      const axisY = y + items.length * rowHeight + 4;
      g.append("line")
        .attr("x1", x).attr("x2", x + width)
        .attr("y1", axisY).attr("y2", axisY)
        .attr("stroke", palette.ink).attr("stroke-opacity", 0.4);
      [minValue, (minValue + vMax) / 2, vMax].forEach((v) => {
        g.append("text")
          .attr("x", xFor(v)).attr("y", axisY + 18).attr("text-anchor", "middle")
          .attr("font-family", palette.bodyFont).attr("font-size", 11)
          .attr("letter-spacing", 1.6).attr("fill", palette.ink).attr("fill-opacity", 0.55)
          .text(fmtValue(v));
      });
    }
    return g;
  }

  // ── facetGrid ───────────────────────────────────────────────────────────
  // Small-multiples grid: divides a bbox into cells, calls renderCell per
  // item with {x, y, w, h, item, index}. Optional small-caps label per cell.
  // opts: {x, y, width, height, items, cols, rows, gapX=24, gapY=40,
  //        labelKey, sublabelKey, renderCell}
  function facetGrid(svg, opts = {}) {
    const {
      x = 160, y = 460, width = 1280, height = 360,
      items = [], cols, rows,
      gapX = 24, gapY = 40,
      labelKey, sublabelKey, renderCell,
    } = opts;
    const n = items.length;
    if (!n || typeof renderCell !== "function") return svg.append("g");
    const ncols = cols || Math.ceil(Math.sqrt(n));
    const nrows = rows || Math.ceil(n / ncols);
    const cellW = (width - gapX * (ncols - 1)) / ncols;
    const cellH = (height - gapY * (nrows - 1)) / nrows;
    const labelOffset = labelKey ? 40 : 0;
    const g = svg.append("g").attr("class", "prim-facet");

    items.forEach((it, i) => {
      const c = i % ncols, r = Math.floor(i / ncols);
      const cx = x + c * (cellW + gapX);
      const cy = y + r * (cellH + gapY);
      if (labelKey && it && it[labelKey] != null) {
        g.append("text")
          .attr("x", cx).attr("y", cy + 14)
          .attr("font-family", palette.bodyFont).attr("font-size", 12)
          .attr("letter-spacing", 2.2).attr("font-weight", 600)
          .attr("fill", palette.ink).attr("fill-opacity", 0.7)
          .text(String(it[labelKey]).toUpperCase());
      }
      if (sublabelKey && it && it[sublabelKey] != null) {
        g.append("text")
          .attr("x", cx).attr("y", cy + 30)
          .attr("font-family", palette.bodyFont).attr("font-size", 13)
          .attr("font-style", "italic")
          .attr("fill", palette.ink).attr("fill-opacity", 0.6)
          .text(it[sublabelKey]);
      }
      renderCell(svg, {
        x: cx, y: cy + labelOffset,
        w: cellW, h: cellH - labelOffset,
        item: it, index: i,
      });
    });
    return g;
  }

  // ── scatter ─────────────────────────────────────────────────────────────
  // Two-axis scatter with optional per-point labels, accent subset, and
  // quadrant annotations. opts: {x, y, width, height, items, xKey, yKey,
  //   labelKey, xDomain, yDomain, xLabel, yLabel, xFormatter, yFormatter,
  //   accentWhere, quadrantLabels:{tl,tr,bl,br}, dotRadius=6, color="primary"}
  function scatter(svg, opts = {}) {
    const {
      x = 180, y = 460, width = 1240, height = 320,
      items = [], xKey = "x", yKey = "y",
      labelKey, xDomain, yDomain,
      xLabel, yLabel,
      xFormatter = (v) => String(v), yFormatter = (v) => String(v),
      accentWhere, dotRadius = 6, color = "primary",
      quadrantLabels,
    } = opts;
    if (!items.length) return svg.append("g");
    const xs = items.map((i) => +i[xKey]);
    const ys = items.map((i) => +i[yKey]);
    const xD = xDomain || [Math.min(...xs), Math.max(...xs)];
    const yD = yDomain || [Math.min(...ys), Math.max(...ys)];
    const xSpan = Math.max(1e-9, xD[1] - xD[0]);
    const ySpan = Math.max(1e-9, yD[1] - yD[0]);
    const xFor = (v) => x + ((v - xD[0]) / xSpan) * width;
    const yFor = (v) => y + height - ((v - yD[0]) / ySpan) * height;
    const g = svg.append("g").attr("class", "prim-scatter");

    // Frame: single L-shape axis in hairline.
    g.append("line").attr("x1", x).attr("x2", x + width)
      .attr("y1", y + height).attr("y2", y + height)
      .attr("stroke", palette.rule).attr("stroke-opacity", 0.5);
    g.append("line").attr("x1", x).attr("x2", x)
      .attr("y1", y).attr("y2", y + height)
      .attr("stroke", palette.rule).attr("stroke-opacity", 0.5);

    // Tick labels at extremes only.
    [xD[0], xD[1]].forEach((v, i) => {
      g.append("text")
        .attr("x", xFor(v)).attr("y", y + height + 20)
        .attr("text-anchor", i === 0 ? "start" : "end")
        .attr("font-family", palette.bodyFont).attr("font-size", 11)
        .attr("letter-spacing", 1.8).attr("fill", palette.ink).attr("fill-opacity", 0.6)
        .text(xFormatter(v));
    });
    [yD[0], yD[1]].forEach((v, i) => {
      g.append("text")
        .attr("x", x - 8).attr("y", yFor(v) + (i === 0 ? 0 : 4))
        .attr("text-anchor", "end")
        .attr("font-family", palette.bodyFont).attr("font-size", 11)
        .attr("letter-spacing", 1.8).attr("fill", palette.ink).attr("fill-opacity", 0.6)
        .text(yFormatter(v));
    });

    if (xLabel) {
      g.append("text")
        .attr("x", x + width).attr("y", y + height + 38)
        .attr("text-anchor", "end")
        .attr("font-family", palette.bodyFont).attr("font-size", 12)
        .attr("letter-spacing", 2.2).attr("font-weight", 600)
        .attr("fill", palette.ink).attr("fill-opacity", 0.7)
        .text(String(xLabel).toUpperCase());
    }
    if (yLabel) {
      g.append("text")
        .attr("x", x - 8).attr("y", y - 10)
        .attr("text-anchor", "end")
        .attr("font-family", palette.bodyFont).attr("font-size", 12)
        .attr("letter-spacing", 2.2).attr("font-weight", 600)
        .attr("fill", palette.ink).attr("fill-opacity", 0.7)
        .text(String(yLabel).toUpperCase());
    }

    if (quadrantLabels) {
      const places = {
        tl: { x: x + 14, y: y + 20, anchor: "start" },
        tr: { x: x + width - 14, y: y + 20, anchor: "end" },
        bl: { x: x + 14, y: y + height - 14, anchor: "start" },
        br: { x: x + width - 14, y: y + height - 14, anchor: "end" },
      };
      Object.entries(quadrantLabels).forEach(([k, label]) => {
        if (!places[k] || !label) return;
        g.append("text")
          .attr("x", places[k].x).attr("y", places[k].y)
          .attr("text-anchor", places[k].anchor)
          .attr("font-family", palette.bodyFont).attr("font-style", "italic")
          .attr("font-size", 13).attr("fill", palette.ink).attr("fill-opacity", 0.55)
          .text(label);
      });
    }

    items.forEach((it) => {
      const accent = typeof accentWhere === "function" && accentWhere(it);
      const fill = accent ? colorOf("accent") : colorOf(color);
      const r = accent ? dotRadius + 3 : dotRadius;
      g.append("circle")
        .attr("cx", xFor(+it[xKey])).attr("cy", yFor(+it[yKey]))
        .attr("r", r).attr("fill", fill);
      if (labelKey && it[labelKey] != null) {
        g.append("text")
          .attr("x", xFor(+it[xKey]) + r + 6).attr("y", yFor(+it[yKey]) + 4)
          .attr("font-family", palette.bodyFont).attr("font-size", accent ? 14 : 12)
          .attr("font-weight", accent ? 600 : 400)
          .attr("fill", accent ? colorOf("accent") : palette.ink)
          .attr("fill-opacity", accent ? 1 : 0.8)
          .text(it[labelKey]);
      }
    });
    return g;
  }

  // ── waterfall ───────────────────────────────────────────────────────────
  // Decomposition bridge. items: [{label, value, kind}] where kind ∈
  // {"start","add","sub","end"}. Draws vertical bars on a shared baseline,
  // connected by dotted connectors. opts: {x, y, width, height, items,
  //   valueFormatter, barWidth, addColor="primary", subColor="accent",
  //   totalColor="primary"}
  function waterfall(svg, opts = {}) {
    const {
      x = 180, y = 460, width = 1240, height = 320,
      items = [], valueFormatter = (v) => String(v),
      barWidth, addColor = "primary", subColor = "accent",
      totalColor = "primary",
    } = opts;
    if (!items.length) return svg.append("g");
    const n = items.length;
    const slotW = width / n;
    const bw = barWidth || Math.min(80, slotW * 0.55);

    // Compute running totals to size bars.
    let running = 0;
    const records = items.map((it, i) => {
      const v = +it.value;
      let y0, y1, tops;
      if (it.kind === "start" || i === 0) {
        y0 = 0; y1 = v; running = v;
      } else if (it.kind === "end") {
        y0 = 0; y1 = v; running = v;
      } else if (it.kind === "sub") {
        y0 = running; y1 = running - Math.abs(v); running = y1;
      } else {
        y0 = running; y1 = running + Math.abs(v); running = y1;
      }
      return { ...it, v, y0, y1 };
    });
    const yMin = Math.min(0, ...records.map((r) => Math.min(r.y0, r.y1)));
    const yMax = Math.max(...records.map((r) => Math.max(r.y0, r.y1)));
    const vSpan = Math.max(1e-9, yMax - yMin);
    const yFor = (v) => y + height - ((v - yMin) / vSpan) * height;
    const g = svg.append("g").attr("class", "prim-waterfall");

    // Baseline at zero.
    g.append("line")
      .attr("x1", x).attr("x2", x + width)
      .attr("y1", yFor(0)).attr("y2", yFor(0))
      .attr("stroke", palette.rule).attr("stroke-opacity", 0.45);

    records.forEach((r, i) => {
      const cx = x + (i + 0.5) * slotW;
      const isTotal = r.kind === "start" || r.kind === "end";
      const fill = isTotal ? colorOf(totalColor)
        : (r.kind === "sub" ? colorOf(subColor) : colorOf(addColor));
      const barTop = yFor(Math.max(r.y0, r.y1));
      const barBot = yFor(Math.min(r.y0, r.y1));
      g.append("rect")
        .attr("x", cx - bw / 2).attr("y", barTop)
        .attr("width", bw).attr("height", Math.max(2, barBot - barTop))
        .attr("fill", fill);
      // Value numeral above/below bar.
      const goesUp = r.y1 >= r.y0;
      g.append("text")
        .attr("x", cx).attr("y", barTop - 10)
        .attr("text-anchor", "middle")
        .attr("font-family", palette.headingFont)
        .attr("font-size", isTotal ? 28 : 20)
        .attr("fill", isTotal ? palette.primary : fill)
        .text((r.kind === "sub" ? "−" : (isTotal ? "" : "+")) + valueFormatter(Math.abs(r.v)));
      // Label below baseline area.
      g.append("text")
        .attr("x", cx).attr("y", y + height + 22)
        .attr("text-anchor", "middle")
        .attr("font-family", palette.bodyFont).attr("font-size", 11)
        .attr("letter-spacing", 2).attr("font-weight", 600)
        .attr("fill", palette.ink).attr("fill-opacity", 0.7)
        .text(String(r.label || "").toUpperCase());
      // Dotted connector from this bar's top to next bar's base.
      if (i < n - 1 && !(records[i + 1].kind === "start" || records[i + 1].kind === "end")) {
        const nx = x + (i + 1.5) * slotW;
        g.append("line")
          .attr("x1", cx + bw / 2).attr("x2", nx - bw / 2)
          .attr("y1", yFor(r.y1)).attr("y2", yFor(r.y1))
          .attr("stroke", palette.ink).attr("stroke-opacity", 0.35)
          .attr("stroke-dasharray", "2 4");
      }
    });
    return g;
  }

  // ── dumbbell ────────────────────────────────────────────────────────────
  // N rows, each with two dots (left/right) joined by a line — before/after
  // across many categories at once. items: [{label, left, right, accent?}].
  // opts: {x, y, width, items, minValue, maxValue, valueFormatter,
  //   leftLabel, rightLabel, rowHeight=40, dotRadius=7, leftColor="rule",
  //   rightColor="primary", accentColor="accent"}
  function dumbbell(svg, opts = {}) {
    const {
      x = 260, y = 460, width = 1160,
      items = [], minValue, maxValue,
      valueFormatter = (v) => String(v),
      leftLabel = "Before", rightLabel = "After",
      rowHeight = 40, dotRadius = 7,
      leftColor = "rule", rightColor = "primary",
      accentColor = "accent", showValues = true,
    } = opts;
    if (!items.length) return svg.append("g");
    const vMin = minValue != null ? minValue
      : Math.min(...items.flatMap((i) => [+i.left, +i.right]));
    const vMax = maxValue != null ? maxValue
      : Math.max(...items.flatMap((i) => [+i.left, +i.right]));
    const vSpan = Math.max(1e-9, vMax - vMin);
    const xFor = (v) => x + ((v - vMin) / vSpan) * width;
    const g = svg.append("g").attr("class", "prim-dumbbell");

    // Legend row at the top.
    g.append("circle").attr("cx", x).attr("cy", y - 28).attr("r", 5)
      .attr("fill", colorOf(leftColor)).attr("fill-opacity", 0.6);
    g.append("text").attr("x", x + 10).attr("y", y - 24)
      .attr("font-family", palette.bodyFont).attr("font-size", 11)
      .attr("letter-spacing", 2).attr("font-weight", 600)
      .attr("fill", palette.ink).attr("fill-opacity", 0.7)
      .text(String(leftLabel).toUpperCase());
    g.append("circle").attr("cx", x + 140).attr("cy", y - 28).attr("r", 5)
      .attr("fill", colorOf(rightColor));
    g.append("text").attr("x", x + 150).attr("y", y - 24)
      .attr("font-family", palette.bodyFont).attr("font-size", 11)
      .attr("letter-spacing", 2).attr("font-weight", 600)
      .attr("fill", palette.ink).attr("fill-opacity", 0.7)
      .text(String(rightLabel).toUpperCase());

    items.forEach((it, i) => {
      const ry = y + i * rowHeight;
      const accent = !!it.accent;
      // Category label.
      g.append("text")
        .attr("x", x - 16).attr("y", ry + 5).attr("text-anchor", "end")
        .attr("font-family", palette.bodyFont).attr("font-size", 12)
        .attr("letter-spacing", 2.2).attr("font-weight", 600)
        .attr("fill", palette.ink).attr("fill-opacity", accent ? 1 : 0.75)
        .text(String(it.label || "").toUpperCase());
      const xL = xFor(+it.left), xR = xFor(+it.right);
      const rFill = accent ? colorOf(accentColor) : colorOf(rightColor);
      // Connector line.
      g.append("line")
        .attr("x1", xL).attr("x2", xR).attr("y1", ry).attr("y2", ry)
        .attr("stroke", rFill).attr("stroke-width", accent ? 2.5 : 1.5)
        .attr("stroke-opacity", accent ? 1 : 0.6);
      // Left dot (ghost).
      g.append("circle").attr("cx", xL).attr("cy", ry)
        .attr("r", dotRadius - 1).attr("fill", colorOf(leftColor))
        .attr("fill-opacity", 0.7);
      // Right dot (solid / accent).
      g.append("circle").attr("cx", xR).attr("cy", ry)
        .attr("r", accent ? dotRadius + 1 : dotRadius).attr("fill", rFill);
      if (showValues) {
        g.append("text")
          .attr("x", xR + dotRadius + 6).attr("y", ry + 4)
          .attr("font-family", palette.headingFont)
          .attr("font-size", accent ? 18 : 14)
          .attr("fill", accent ? colorOf(accentColor) : palette.ink)
          .attr("fill-opacity", accent ? 1 : 0.8)
          .text(valueFormatter(+it.right));
      }
    });
    return g;
  }

  // ── Text measurement (Canvas 2D — works without DOM attach) ─────────────
  let _measureCtx = null;
  function measureText(text, fontSize, fontFamily, fontWeight) {
    if (!_measureCtx) {
      const c = document.createElement("canvas");
      _measureCtx = c.getContext("2d");
    }
    _measureCtx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
    return _measureCtx.measureText(text).width;
  }

  function wrapLines(text, maxWidth, fontSize, fontFamily, fontWeight) {
    const words = String(text).split(/\s+/).filter(Boolean);
    const lines = [];
    let line = "";
    for (const w of words) {
      const probe = line ? line + " " + w : w;
      if (measureText(probe, fontSize, fontFamily, fontWeight) <= maxWidth || !line) {
        line = probe;
      } else {
        lines.push(line);
        line = w;
      }
    }
    if (line) lines.push(line);
    return lines;
  }

  // ── eyebrow ─────────────────────────────────────────────────────────────
  // Uniform all-caps label at canvas top. Use on every slide.
  function eyebrow(svg, text, opts = {}) {
    const { x = 80, y = 64, color = "ink", opacity = 1 } = opts;
    return svg.append("text")
      .attr("x", x).attr("y", y)
      .attr("font-family", palette.bodyFont)
      .attr("font-size", palette.type.eyebrow)
      .attr("font-weight", 600)
      .attr("letter-spacing", 2.6)
      .attr("fill", colorOf(color))
      .attr("fill-opacity", opacity)
      .text(String(text).toUpperCase());
  }

  // ── headline ────────────────────────────────────────────────────────────
  // Editorial headline with automatic word-wrap to fit maxWidth. Always use
  // this — never hand-roll headline text with svg.append("text").
  // Returns {node, bottomY} so callers can lay out the subhead below it.
  function headline(svg, text, opts = {}) {
    const {
      x = 80, y = 134, maxWidth = 1440,
      color = "primary", lineHeight = 1.05,
    } = opts;
    const size = palette.type.headline;
    const weight = 500;
    const lines = wrapLines(text, maxWidth, size, palette.headingFont, weight);
    const t = svg.append("text")
      .attr("x", x).attr("y", y)
      .attr("font-family", palette.headingFont)
      .attr("font-size", size)
      .attr("font-weight", weight)
      .attr("letter-spacing", -0.7)
      .attr("fill", colorOf(color));
    lines.forEach((line, i) => {
      t.append("tspan")
        .attr("x", x)
        .attr("dy", i === 0 ? 0 : size * lineHeight)
        .text(line);
    });
    const bottomY = y + (lines.length - 1) * size * lineHeight;
    return { node: t, bottomY, lines: lines.length };
  }

  // ── subhead ─────────────────────────────────────────────────────────────
  // Supporting line beneath the headline. Sentence case, letter-spacing 0.
  // `y` should be set to headline.bottomY + 38 for single-line headlines.
  function subhead(svg, text, opts = {}) {
    const {
      x = 80, y = 172, maxWidth = 1440,
      color = "ink", opacity = 0.6,
    } = opts;
    const size = palette.type.subhead;
    const lines = wrapLines(text, maxWidth, size, palette.bodyFont, 400);
    const t = svg.append("text")
      .attr("x", x).attr("y", y)
      .attr("font-family", palette.bodyFont)
      .attr("font-size", size).attr("font-weight", 400)
      .attr("fill", colorOf(color)).attr("fill-opacity", opacity);
    lines.forEach((line, i) => {
      t.append("tspan")
        .attr("x", x)
        .attr("dy", i === 0 ? 0 : size * 1.25)
        .text(line);
    });
    return { node: t, bottomY: y + (lines.length - 1) * size * 1.25 };
  }

  // ── kpiRow ──────────────────────────────────────────────────────────────
  // Evenly distributes 2-5 KPIs in a horizontal band. Each item:
  //   {label, value, sub?, accent?}
  // Positions: label on top (eyebrow), big numeral below, optional sub-line.
  function kpiRow(svg, items, opts = {}) {
    const {
      x = 80, y = 440, width = 1440,
      valueSize = palette.type.kpi_m,
      valueFont = palette.headingFont,
      accentColor = palette.accent,
    } = opts;
    const n = items.length;
    const gap = 24;
    const colW = (width - gap * (n - 1)) / n;
    const g = svg.append("g").attr("class", "prim-kpi-row");
    items.forEach((it, i) => {
      const cx = x + i * (colW + gap);
      g.append("text")
        .attr("x", cx).attr("y", y)
        .attr("font-family", palette.bodyFont)
        .attr("font-size", palette.type.eyebrow)
        .attr("font-weight", 600).attr("letter-spacing", 2.6)
        .attr("fill", palette.ink)
        .text(String(it.label).toUpperCase());
      g.append("text")
        .attr("x", cx).attr("y", y + valueSize + 12)
        .attr("font-family", valueFont)
        .attr("font-size", valueSize).attr("font-weight", 400)
        .attr("letter-spacing", -1.2)
        .attr("fill", it.accent ? accentColor : palette.primary)
        .text(String(it.value));
      if (it.sub) {
        g.append("text")
          .attr("x", cx).attr("y", y + valueSize + 38)
          .attr("font-family", palette.bodyFont)
          .attr("font-size", palette.type.body).attr("font-weight", 400)
          .attr("fill", palette.ink).attr("fill-opacity", 0.6)
          .text(it.sub);
      }
    });
    return g;
  }

  // ── rightFlushHero ──────────────────────────────────────────────────────
  // Full-bleed hero numeral in the right column with a flush-right anchor so
  // the glyphs CANNOT overflow the canvas, whatever the string length.
  // Eyebrow goes ABOVE the numeral; optional subline goes BELOW.
  // opts: {rightX=1520, y=360, eyebrowText, subText, color="accent"}
  function rightFlushHero(svg, text, opts = {}) {
    const {
      rightX = 1520, y = 360,
      eyebrowText, subText,
      color = "accent",
    } = opts;
    const g = svg.append("g").attr("class", "prim-right-hero");
    const fill = colorOf(color);
    if (eyebrowText) {
      g.append("text")
        .attr("x", rightX).attr("y", y - palette.type.hero * 0.78)
        .attr("text-anchor", "end")
        .attr("font-family", palette.bodyFont).attr("font-size", palette.type.eyebrow)
        .attr("font-weight", 600).attr("letter-spacing", 2.6)
        .attr("fill", palette.ink).attr("fill-opacity", 0.7)
        .text(String(eyebrowText).toUpperCase());
    }
    g.append("text")
      .attr("x", rightX).attr("y", y)
      .attr("text-anchor", "end")
      .attr("font-family", palette.headingFont)
      .attr("font-size", palette.type.hero).attr("font-weight", 400)
      .attr("letter-spacing", -6).attr("fill", fill)
      .text(text);
    if (subText) {
      g.append("text")
        .attr("x", rightX).attr("y", y + palette.type.body * 2.2)
        .attr("text-anchor", "end")
        .attr("font-family", palette.bodyFont).attr("font-size", palette.type.body)
        .attr("fill", palette.ink).attr("fill-opacity", 0.6)
        .text(subText);
    }
    return g;
  }

  // ── marimekkoBar ────────────────────────────────────────────────────────
  // Single marimekko column. Margin value label sits ABOVE the bar top, never
  // inside. Segment name + sub-caption sit BELOW the stage baseline.
  // opts: {x, y0, colW, barH, name, sub, color="primary", valueLabel, eyebrowText="EBITDA MARGIN"}
  // (x, y0) is the TOP-LEFT of the bar; barH must already be scaled to margin.
  function marimekkoBar(svg, opts = {}) {
    const {
      x, y0, colW, barH,
      stageBottomY,
      name, sub, color = "primary",
      valueLabel, eyebrowText = "EBITDA MARGIN",
    } = opts;
    const g = svg.append("g").attr("class", "prim-marimekko");
    g.append("rect")
      .attr("x", x).attr("y", y0)
      .attr("width", colW).attr("height", barH)
      .attr("fill", colorOf(color));
    // Value label ABOVE the bar — stacked eyebrow then value.
    const eyebrowY = y0 - 34;
    const valueY = y0 - 10;
    g.append("text")
      .attr("x", x + 8).attr("y", eyebrowY)
      .attr("font-family", palette.bodyFont).attr("font-size", palette.type.eyebrow)
      .attr("font-weight", 600).attr("letter-spacing", 2.6)
      .attr("fill", palette.ink).attr("fill-opacity", 0.6)
      .text(String(eyebrowText).toUpperCase());
    g.append("text")
      .attr("x", x + 8).attr("y", valueY)
      .attr("font-family", palette.headingFont).attr("font-size", palette.type.kpi_s)
      .attr("font-weight", 400).attr("letter-spacing", -0.6)
      .attr("fill", palette.primary)
      .text(valueLabel);
    // Segment name BELOW stage baseline.
    const baseY = stageBottomY != null ? stageBottomY : y0 + barH;
    g.append("text")
      .attr("x", x + 8).attr("y", baseY + 28)
      .attr("font-family", palette.bodyFont).attr("font-size", palette.type.eyebrow)
      .attr("font-weight", 600).attr("letter-spacing", 2.6)
      .attr("fill", palette.ink)
      .text(String(name).toUpperCase());
    if (sub) {
      g.append("text")
        .attr("x", x + 8).attr("y", baseY + 50)
        .attr("font-family", palette.bodyFont).attr("font-size", palette.type.body)
        .attr("fill", palette.ink).attr("fill-opacity", 0.6)
        .text(sub);
    }
    return g;
  }

  // ── endpointLabels ──────────────────────────────────────────────────────
  // Place N labels at the right end of a series. Labels are force-stacked so
  // their Y positions don't collide (min vertical gap). Each item:
  //   {eyebrow, value, y, color?}
  // Eyebrow sits on top of value within each block; blocks are spaced so
  // bottom-of-block[i] < top-of-block[i+1].
  function endpointLabels(svg, items, opts = {}) {
    const { x = 1480, minGap = 8 } = opts;
    const eH = palette.type.eyebrow;
    const vH = palette.type.kpi_s;
    const blockH = eH + 6 + vH + minGap;
    const sorted = items.map((it, i) => ({ ...it, i })).sort((a, b) => a.y - b.y);
    // Simple top-down sweep: each block's top must be >= prev.top + blockH.
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i].y < sorted[i - 1].y + blockH) {
        sorted[i].y = sorted[i - 1].y + blockH;
      }
    }
    const g = svg.append("g").attr("class", "prim-endpoint-labels");
    sorted.forEach((it) => {
      const fill = colorOf(it.color || "primary");
      g.append("text")
        .attr("x", x).attr("y", it.y)
        .attr("font-family", palette.bodyFont).attr("font-size", eH)
        .attr("font-weight", 600).attr("letter-spacing", 2.6)
        .attr("fill", fill).attr("fill-opacity", 0.85)
        .text(String(it.eyebrow).toUpperCase());
      g.append("text")
        .attr("x", x).attr("y", it.y + eH + 6 + vH * 0.82)
        .attr("font-family", palette.headingFont).attr("font-size", vH)
        .attr("font-weight", 400).attr("letter-spacing", -0.5)
        .attr("fill", fill)
        .text(String(it.value));
    });
    return g;
  }

  // ── eventAnnotation ─────────────────────────────────────────────────────
  // Structured annotation block for a chart event. Date → value → note stack,
  // all flush-left at `x`, guaranteed vertical spacing.
  // opts: {x, y, date, value, note, color="accent", side="below"}
  // side="above" reverses stack so block sits ABOVE y.
  function eventAnnotation(svg, opts = {}) {
    const {
      x, y, date, value, note,
      color = "accent", side = "below",
    } = opts;
    const g = svg.append("g").attr("class", "prim-event-ann");
    const fill = colorOf(color);
    const rows = [];
    if (date) rows.push({ kind: "eyebrow", text: date, color: fill });
    if (value) rows.push({ kind: "value", text: value, color: fill });
    if (note) rows.push({ kind: "note", text: note, color: palette.ink });
    const heights = rows.map((r) =>
      r.kind === "eyebrow" ? palette.type.eyebrow
      : r.kind === "value" ? palette.type.kpi_s
      : palette.type.body
    );
    const gaps = rows.map((r) => (r.kind === "value" ? 6 : 10));
    let cursor = side === "above"
      ? y - heights.reduce((s, h, i) => s + h + gaps[i], 0)
      : y;
    rows.forEach((r, i) => {
      cursor += heights[i];
      const isEyebrow = r.kind === "eyebrow";
      const isValue = r.kind === "value";
      g.append("text")
        .attr("x", x).attr("y", cursor)
        .attr("font-family", isValue ? palette.headingFont : palette.bodyFont)
        .attr("font-size", heights[i])
        .attr("font-weight", isEyebrow ? 600 : (isValue ? 400 : 400))
        .attr("letter-spacing", isEyebrow ? 2.6 : (isValue ? -0.4 : 0))
        .attr("fill", r.color)
        .attr("fill-opacity", r.kind === "note" ? 0.65 : 1)
        .text(isEyebrow ? String(r.text).toUpperCase() : r.text);
      cursor += gaps[i];
    });
    return g;
  }

  // ── donutCenter ─────────────────────────────────────────────────────────
  // Center two lines inside a donut: big value line, small label line below.
  // Lines are stacked with a guaranteed gap; the whole block is vertically
  // centered around (cx, cy).
  function donutCenter(svg, opts = {}) {
    const { cx, cy, value, label } = opts;
    const vH = palette.type.kpi_m;
    const lH = palette.type.eyebrow;
    const gap = 12;
    const totalH = vH + gap + lH;
    const startY = cy - totalH / 2;
    const g = svg.append("g").attr("class", "prim-donut-center");
    g.append("text")
      .attr("x", cx).attr("y", startY + vH * 0.82)
      .attr("text-anchor", "middle")
      .attr("font-family", palette.headingFont).attr("font-size", vH)
      .attr("font-weight", 400).attr("letter-spacing", -0.8)
      .attr("fill", palette.primary)
      .text(String(value));
    if (label) {
      g.append("text")
        .attr("x", cx).attr("y", startY + vH + gap + lH * 0.82)
        .attr("text-anchor", "middle")
        .attr("font-family", palette.bodyFont).attr("font-size", lH)
        .attr("font-weight", 600).attr("letter-spacing", 2.6)
        .attr("fill", palette.ink).attr("fill-opacity", 0.7)
        .text(String(label).toUpperCase());
    }
    return g;
  }

  // ── bulletRow ───────────────────────────────────────────────────────────
  // One row of a bullet chart. Pillar name + sub on the LEFT, bar in the
  // MIDDLE, numeric % value at bar end, target NOTE on its OWN row below the
  // bar (never on it). Caller passes rowY as the Y-center of the bar.
  // opts: {rowY, name, sub, progress (0..1), stageX=520, stageW=680, color="primary", targetNote}
  function bulletRow(svg, opts = {}) {
    const {
      rowY, name, sub, progress = 0,
      stageX = 520, stageW = 680,
      color = "primary", targetNote,
    } = opts;
    const barH = 22;
    const g = svg.append("g").attr("class", "prim-bullet-row");
    g.append("text")
      .attr("x", 80).attr("y", rowY - 4)
      .attr("font-family", palette.headingFont).attr("font-size", palette.type.subhead)
      .attr("font-weight", 500).attr("fill", palette.primary)
      .text(name);
    if (sub) {
      g.append("text")
        .attr("x", 80).attr("y", rowY + 18)
        .attr("font-family", palette.bodyFont).attr("font-size", palette.type.body)
        .attr("fill", palette.ink).attr("fill-opacity", 0.55)
        .text(sub);
    }
    // Ghost track + filled bar
    g.append("rect")
      .attr("x", stageX).attr("y", rowY - barH / 2)
      .attr("width", stageW).attr("height", barH)
      .attr("fill", palette.rule).attr("fill-opacity", 0.25);
    g.append("rect")
      .attr("x", stageX).attr("y", rowY - barH / 2)
      .attr("width", stageW * Math.max(0, Math.min(1, progress)))
      .attr("height", barH).attr("fill", colorOf(color));
    // Value at bar end
    g.append("text")
      .attr("x", stageX + stageW * progress + 10).attr("y", rowY + 6)
      .attr("font-family", palette.headingFont).attr("font-size", palette.type.kpi_s)
      .attr("font-weight", 400).attr("letter-spacing", -0.4)
      .attr("fill", colorOf(color))
      .text(`${(progress * 100).toFixed(1)}%`);
    // Target note — OWN row below the bar, not on it.
    if (targetNote) {
      g.append("text")
        .attr("x", stageX + stageW + 16).attr("y", rowY + barH / 2 + palette.type.body + 6)
        .attr("font-family", palette.bodyFont).attr("font-size", palette.type.body)
        .attr("fill", palette.ink).attr("fill-opacity", 0.55)
        .text(targetNote);
    }
    return g;
  }

  return {
    eyebrow, headline, subhead, kpiRow,
    heroNumber, rightFlushHero, bodyCopy, rule, caption,
    leader, callout, timeline, timelineTrack,
    isotype, figure, figureRow,
    arc, slopeLine, sparkline, rankedDots,
    facetGrid, scatter, waterfall, dumbbell,
    marimekkoBar, endpointLabels, eventAnnotation,
    donutCenter, bulletRow,
    // low-level helpers exposed for convenience
    color: colorOf,
    measureText, wrapLines,
  };
}
