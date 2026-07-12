# Edges Prompt — Functional Chain Links

For platform **{{PLATFORM}}** ({{CATEGORY}}), generate the TYPED EDGES that wire its nodes into
the functional chain. Every taxonomy node must chain-link to a protocol. Relations:

    platform ─uses→ webapp_tech_stack
    platform ─exposes→ capability
    capability ─implemented_by→ method
    method ─uses_protocol→ protocol
    method ─targets_tech_stack→ webapp_tech_stack
    method ─parsed_by→ parser
    protocol ─decoded_by→ parser

## Output Format (STRICT JSON)

```json
{
  "edges": [
    { "fromSlug": "chatgpt", "fromKind": "platform", "toSlug": "prosemirror",
      "toKind": "webapp_tech_stack", "relation": "uses", "confidence": "high" },
    { "fromSlug": "chatgpt", "fromKind": "platform", "toSlug": "send_message",
      "toKind": "capability", "relation": "exposes", "confidence": "high" },
    { "fromSlug": "send_message", "fromKind": "capability", "toSlug": "chatgpt__send_message",
      "toKind": "method", "relation": "implemented_by", "confidence": "high" },
    { "fromSlug": "chatgpt__send_message", "fromKind": "method", "toSlug": "cdp",
      "toKind": "protocol", "relation": "uses_protocol", "confidence": "high" },
    { "fromSlug": "chatgpt__send_message", "fromKind": "method", "toSlug": "prosemirror",
      "toKind": "webapp_tech_stack", "relation": "targets_tech_stack", "confidence": "high" },
    { "fromSlug": "chatgpt__send_message", "fromKind": "method", "toSlug": "chatgpt__sse",
      "toKind": "parser", "relation": "parsed_by", "confidence": "high" }
  ]
}
```

## Rules
- `relation` ∈ {uses, exposes, implemented_by, uses_protocol, targets_tech_stack,
  parsed_by, decoded_by, synonym_of, implies_protocol, has_probability}
- Every `method` MUST have a `uses_protocol` edge. Every platform MUST have at least one
  `uses` (tech stack) and one `exposes` (capability) edge. This is the "each word chains to
  a protocol" invariant.
- `confidence` mirrors the linked node's confidence.
- Return ONLY valid JSON, no markdown fences, no commentary.


