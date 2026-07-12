# Capabilities Prompt - {{PLATFORM}}

For **{{PLATFORM}}** ({{CATEGORY}}), emit the `exposes` EDGES linking the platform to SHARED
capability nodes. Do NOT redefine capabilities — reference their slugs from the shared pool.

## Shared capabilities available (seed, extend if a capability is genuinely missing)
send_message, select_model, regenerate_response, upload_file, new_chat, edit_message,
delete_chat, rename_chat, navigate_chat, login, logout, search, scroll_feed, react, comment,
follow, post_to_feed, send_media, read_messages, create_group, ...

## Output Format (STRICT JSON)

```json
{
  "edges": [
    { "fromSlug": "{{PLATFORM}}", "fromKind": "platform", "toSlug": "send_message",
      "toKind": "capability", "relation": "exposes", "confidence": "high" },
    { "fromSlug": "{{PLATFORM}}", "fromKind": "platform", "toSlug": "select_model",
      "toKind": "capability", "relation": "exposes", "confidence": "high" }
  ]
}
```

## Rules
- `toSlug` MUST be a shared capability slug. If a capability is missing from the pool,
  still reference the best-matching slug and flag it (we will extend the shared pool).
- One edge per capability the platform exposes.
- This is the "platform exposes capability" link in the functional chain.
- Return ONLY valid JSON, no markdown fences, no commentary.


