# Validate Prompt — {{PLATFORM}}

Validate and finalize the complete taxonomy document for **{{PLATFORM}}**. You are given the
accumulated nodes + edges from all prior sections. Enforce the master-schema invariant:
**every taxonomy node must chain-link to a protocol.**

## Accumulated TaxonomyDocument
{{PRIOR_NODES}}

## Validation Checklist
1. Platform node exists with `uses` edge(s) to ≥1 webapp_tech_stack.
2. Platform has ≥1 `exposes` edge to a capability.
3. For every `method` node: a `uses_protocol` edge exists (links to a protocol node).
4. For every `method` node: a `targets_tech_stack` edge exists when selectorType is cdp/dom.
5. Every `protocol` referenced has a `decoded_by` edge to a `parser` (or reuses a shared parser).
6. No duplicate slugs; no dangling edge endpoints.
7. Selectors marked `__PLACEHOLDER__` are flagged (confidence low) — acceptable for a
   generated placeholder, but noted.

## Output Format (STRICT JSON)

```json
{
  "ok": true,
  "nodes": [ ...the validated nodes... ],
  "edges": [ ...the validated edges... ],
  "validationNotes": "any caveats, duplicates fixed, placeholders flagged"
}
```

## Rules
- Merge/fix all sections into one TaxonomyDocument (nodes + edges).
- Drop or repair dangling edges; de-duplicate slugs.
- Set `ok: false` only if a structural invariant is violated and cannot be repaired.
- Return ONLY valid JSON, no markdown fences, no commentary.


