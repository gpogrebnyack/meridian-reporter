# Target

- Company: {{company_short_name}}
- Fiscal year: {{fiscal_year}}

# Enriched company JSON

```json
{{enriched_json}}
```

# Task

Comb this JSON end to end. Prioritize `_derived.summary` — many of the richest contrasts are already computed. Surface **15–20 editorially charged facts**, each one worthy of a full-screen infographic in a premium annual report.

Every number in text fields must be a `{{data:...}}` or `{{fmt:...|style}}` placeholder — never a raw digit.

Return a single JSON object per the response schema. No preamble, no code fences, no trailing commentary.
