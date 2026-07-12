# Parsers Prompt — Streaming / Mirror Decoders

For platform **{{PLATFORM}}** ({{CATEGORY}}), specify the PARSER nodes needed to decode its
responses. Parsers are mostly SHARED (see shared pool), but a platform may need a
platform-specific override. The parser is the tail of the chain:

    method ─parsed_by→ parser  ←  protocol ─decoded_by→ parser

Parsers are DB-driven: inline logic loads from the parser store, with a fallback chain
`provider → generic → system`.

## Output Format (STRICT JSON)

```json
{
  "parsers": [
    {
      "slug": "chatgpt__sse",
      "label": "ChatGPT SSE",
      "parserType": "sse",
      "fallbackSlug": "sse_openai",
      "description": "ChatGPT web UI SSE stream (OpenAI-compatible delta frames)",
      "sourceConfidence": "high",
      "tags": ["streaming"]
    }
  ]
}
```

## Rules
- `parserType`: sse | ndjson | batchexecute | frame | html-diff | json | xml | text
- `fallbackSlug`: a shared parser slug used when this one fails (generic/system chain).
- If the platform reuses a shared parser exactly, OMIT it (do not duplicate).
- Return ONLY valid JSON, no markdown fences, no commentary.


