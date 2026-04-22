// Resolves a slide's `data_refs` map into real arrays/values by dereferencing
// dotted paths (e.g. "financials.revenue_by_year") against the enriched JSON.
// Literal arrays pass through unchanged.

function deepGet(obj, path) {
  if (obj == null) return undefined;
  const parts = String(path).match(/[A-Za-z0-9_]+|\[-?\d+\]/g) || [];
  let cur = obj;
  for (const p of parts) {
    if (cur == null) return undefined;
    if (p.startsWith("[")) {
      const idx = parseInt(p.slice(1, -1), 10);
      cur = Array.isArray(cur) ? cur.at(idx) : undefined;
    } else {
      cur = cur[p];
    }
  }
  return cur;
}

export function resolveDatasets(dataRefs, enriched) {
  const out = {};
  for (const [name, ref] of Object.entries(dataRefs || {})) {
    if (Array.isArray(ref)) {
      out[name] = ref;
      continue;
    }
    out[name] = deepGet(enriched, ref);
  }
  return out;
}
