# Probability-Harvest Prompt — LLM Insight Harvesting

GOAL: Given a controlled vocabulary, use the LLM's latent knowledge to HARVEST protocol /
capability insights and express them as a PROBABILITY TABLE. Example: feed the official
SSE (Server-Sent Events) taxonomy + synonym map; ask the LLM which platforms/protocols/
capabilities each term implies, with a confidence-weighted probability.

## Controlled vocabulary (seed this from the real spec)
{{VOCAB}}

## Task
1. For each term in the vocabulary, emit a `taxonomy_term` node. If the term is a synonym
   of a canonical term, set `canonicalSlug` (synonym_of edge implied).
2. Build a `probability_table` of `P(target | conditions)` where target is a protocol slug
   (cdp|dom|rest|ws|sse|graphql|mirroring) or capability slug, conditioned on the term.
   `n` = support (how many platforms you judged). `evidence` = one-line rationale.

## Output Format (STRICT JSON)

```json
{
  "taxonomyTerms": [
    { "slug": "sse_event_stream", "label": "event-stream", "vocabulary": "sse-official",
      "description": "text/event-stream push of named events", "canonicalSlug": null,
      "sourceConfidence": "high", "tags": ["sse"] }
  ],
  "probabilityTable": {
    "slug": "sse_term__protocol",
    "label": "SSE term → protocol probability",
    "targetKind": "protocol",
    "conditionKind": "taxonomy_term",
    "rows": [
      { "conditions": { "term": "sse_event_stream" }, "target": "sse", "p": 0.95,
        "n": 12, "evidence": "text/event-stream is the SSE transport" },
      { "conditions": { "term": "sse_data_field" }, "target": "sse", "p": 0.9,
        "n": 10, "evidence": "'data:' lines are SSE payloads" }
    ]
  }
}
```

## Rules
- `p` ∈ [0,1]; `n` ≥ 1. Probabilities need not sum to 1 across a condition (they are
  independent beliefs), but should be calibrated (0.95 means near-certain).
- Prefer real protocol slugs from: cdp, dom, rest, ws, sse, graphql, mirroring.
- `sourceConfidence` reflects how sure the LLM is (treat as harvested, unverified = medium/low).
- This is a HARVEST artifact: it will be CROSS-CHECKED against known nodes, CLEANED UP
  (synonyms merged to canonical, p clamped), and TESTED (spot-checked against a live platform).
- Return ONLY valid JSON, no markdown fences, no commentary.


