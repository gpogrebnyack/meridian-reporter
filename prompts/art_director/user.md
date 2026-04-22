# Shared context (cacheable)

## Report meta
- Company: {{company_short_name}}
- Fiscal year: {{fiscal_year}}
- Thesis: {{report_thesis}}
- Running motif: {{running_motif}}

## Branding palette
```json
{{branding_json}}
```

## Style notes
```json
{{style_notes_json}}
```

## Plot recipes — the closed catalog (pick `recipe` from these slugs)

{{plot_recipes}}

## Narrative tags — the closed vocabulary (pick one `narrative_tag` per slide)

{{narrative_tags}}

## Enriched company JSON
```json
{{enriched_json}}
```

# Insight pool — curate these into a deck (varies per call)

```json
{{insights_json}}
```

Produce the full deck storyboard as a single JSON object matching the response schema. **EXACTLY {{target_slide_count}} slides** — not more, not less. Maximize distinct recipes from the catalog; each recipe used ≤ 2 times. Every slide carries one `narrative_tag` from the closed vocabulary above. Return the JSON object only — no preamble, no code fences, no trailing commentary.
