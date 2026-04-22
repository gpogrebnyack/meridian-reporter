import * as Plot from "https://cdn.jsdelivr.net/npm/@observablehq/plot@0.6.17/+esm";
import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7/+esm";
import * as topojson from "https://cdn.jsdelivr.net/npm/topojson-client@3/+esm";
import { resolveDatasets } from "./data_refs.js";
import { createPrimitives } from "./slides_primitives.js";

// ── World basemap (TopoJSON shipped alongside this module) ───────────────
// Exposes a `basemap` object to every render_code with:
//   basemap.land       — GeoJSON Feature (continental outlines, one MultiPolygon)
//   basemap.countries  — GeoJSON FeatureCollection (176 country polygons)
// Use with Plot.geo(basemap.land, {...}) for a light continental silhouette,
// or Plot.geo(basemap.countries, {...}) when you need per-country shapes.
let basemap = { land: null, countries: null };
try {
  const topo = await fetch(new URL("./world-countries-110m.json", import.meta.url)).then(r => r.json());
  basemap = {
    land: topojson.feature(topo, topo.objects.land),
    countries: topojson.feature(topo, topo.objects.countries),
  };
} catch (err) {
  console.warn("basemap load failed:", err);
}

// ── format helpers mirror Python placeholder formatters ──────────────────
const aed = (v, scale, label, decimals = 1) =>
  `AED ${(v / scale).toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}${label}`;

const fmt = {
  aed_bn: (v) => aed(+v, 1_000_000, "bn", 2),
  aed_mn: (v) => aed(+v, 1_000, "mn", 0),
  aed_k: (v) => `AED ${(+v).toLocaleString("en-US", { maximumFractionDigits: 0 })}k`,
  pct: (v) => `${(+v).toFixed(1)}%`,
  pct_pp: (v) => `${+v >= 0 ? "+" : ""}${(+v).toFixed(1)}pp`,
  signed_pct: (v) => `${+v >= 0 ? "+" : ""}${(+v).toFixed(1)}%`,
  x: (v) => `${(+v).toFixed(1)}x`,
  int: (v) => Math.round(+v).toLocaleString("en-US"),
  num: (v) => (Number.isInteger(+v) ? (+v).toLocaleString("en-US") : (+v).toFixed(2)),
  usc_kwh: (v) => `${(+v).toFixed(1)} US¢/kWh`,
  year: (v) => String(parseInt(v, 10)),
  date_long: (v) => new Date(v).toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" }),
  date_short: (v) => new Date(v).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }),
  string: (v) => String(v),
};

const BRAND = (window.__MERIDIAN__ || {}).branding || {};
const palette = {
  primary: BRAND.primary_color || "#0D1B2E",
  accent: BRAND.accent_color || "#C9A96E",
  ink: "#1A1A1A",
  rule: "#B8B0A4",
  bodyFont: `"${BRAND.font_body || "Inter"}", -apple-system, BlinkMacSystemFont, sans-serif`,
  headingFont: `"${BRAND.font_heading || "Inter Tight"}", -apple-system, BlinkMacSystemFont, sans-serif`,
  secondary: BRAND.secondary_colors || [],
  segment: (id) => {
    const map = {
      real_estate: BRAND.primary_color || "#0D1B2E",
      clean_energy: (BRAND.secondary_colors || [])[0] || "#3E9A8F",
      logistics_maritime: (BRAND.secondary_colors || [])[1] || "#4B80BF",
      default: BRAND.accent_color || "#C9A96E",
    };
    return map[id] || map.default;
  },
  // Typographic scale — all text in slides MUST use these named sizes.
  // Never invent in-between values (no 42, 43, 45, 47 ... 19, 21 ...).
  type: {
    micro:     11,  // source line, axis ticks, footnotes
    body:      12,  // chart labels, small captions
    eyebrow:   14,  // ALL-CAPS section label above headline
    subhead:   18,  // deck-style subtitle under headline
    headline:  40,  // main slide title
    kpi_s:     32,  // secondary KPI numeral
    kpi_m:     44,  // medium KPI numeral
    kpi_l:     60,  // primary KPI / hero numeral (small KPI slide)
    hero:     160,  // full-bleed hero numeral (covers the right column)
  },
  weight: {
    regular: 400,
    medium:  500,
    semibold: 600,
    bold:    700,
  },
};

const enriched = (window.__MERIDIAN__ || {}).enriched || {};

function renderError(host, message) {
  const div = document.createElement("div");
  div.className = "slide-error";
  div.textContent = message;
  host.appendChild(div);
}

const prim = createPrimitives(d3, palette);

function runRenderCode(code, datasets, host) {
  // render_code is a function body executed as
  //   (svg, d3, Plot, datasets, fmt, palette, prim) => { ... }
  // where `svg` is a d3 selection on a pre-created <svg> with viewBox 0 0 1600 900.
  const svgEl = d3
    .create("svg")
    .attr("viewBox", "0 0 1600 900")
    .attr("preserveAspectRatio", "xMidYMid meet")
    .attr("width", "100%")
    .attr("height", "100%")
    .attr("role", "img")
    .style("display", "block");

  // Note: intentionally sloppy mode — LLM output sometimes drops a `const`
  // keyword, and one missing declaration shouldn't brick the whole slide.
  const fn = new Function(
    "svg", "d3", "Plot", "datasets", "fmt", "palette", "prim", "basemap",
    code
  );
  fn(svgEl, d3, Plot, datasets, fmt, palette, prim, basemap);
  host.appendChild(svgEl.node());

  // Fixed viewBox across the deck: every slide maps 1600×900 into the stage
  // via preserveAspectRatio="xMidYMid meet". Margins declared inside the SVG
  // (x=80 left, y=64 eyebrow, y≤800 bottom) thus land at the same pixel
  // positions on every slide — a stable safe-area.
}

document.querySelectorAll("[data-slide-plot]").forEach((host) => {
  try {
    const spec = JSON.parse(host.getAttribute("data-spec") || "{}");
    const datasets = resolveDatasets(spec.data_refs || {}, enriched);
    const code = spec.render_code || spec.plot_code; // backward-compat
    if (!code) {
      renderError(host, "no render_code");
      return;
    }
    runRenderCode(code, datasets, host);
  } catch (err) {
    console.error("slide render failed:", err);
    renderError(host, String(err && err.stack ? err.stack : err));
  }
});

// ── Keyboard navigation (arrow keys, PgUp/PgDn) ──────────────────────────
const deck = document.querySelector(".deck");
if (deck) {
  const slides = () => Array.from(deck.querySelectorAll(".slide"));
  const currentIndex = () => {
    const top = deck.scrollTop;
    const h = window.innerHeight;
    return Math.round(top / h);
  };
  const go = (delta) => {
    const list = slides();
    const i = Math.max(0, Math.min(list.length - 1, currentIndex() + delta));
    list[i].scrollIntoView({ behavior: "smooth" });
  };
  window.addEventListener("keydown", (e) => {
    if (["ArrowDown", "PageDown", " "].includes(e.key)) {
      e.preventDefault();
      go(+1);
    } else if (["ArrowUp", "PageUp"].includes(e.key)) {
      e.preventDefault();
      go(-1);
    } else if (e.key === "Home") {
      e.preventDefault();
      slides()[0]?.scrollIntoView({ behavior: "smooth" });
    } else if (e.key === "End") {
      e.preventDefault();
      const list = slides();
      list[list.length - 1]?.scrollIntoView({ behavior: "smooth" });
    }
  });
}
