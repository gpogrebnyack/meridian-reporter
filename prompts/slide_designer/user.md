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

## Plot recipes — the closed catalog (reference the sketch for this slide's `recipe`)

{{plot_recipes}}

## Narrative tags — reference vocabulary (the AD has already chosen one; use it to set tone/emphasis)

{{narrative_tags}}

## Enriched company JSON
```json
{{enriched_json}}
```

# Storyboard entry — realize this one slide (varies per call)

The Art Director has already chosen the `recipe` (and possibly `secondary_recipe`), written the headline, and listed the `required_data_paths`. **This entry is binding.** Your job is to implement it in `render_code` + `data_refs`.

```json
{{storyboard_entry_json}}
```

Produce one slide JSON per the response schema. `recipe` MUST equal the storyboard entry's `recipe`. `id` MUST equal the storyboard entry's `id`. `headline` must preserve the editorial intent (light polish only; do not rewrite). `data_refs` must cover every path used in `render_code` and in placeholder fields. Return the JSON object only — no preamble, no code fences, no trailing commentary.
