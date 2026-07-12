# Shared-Pool Prompt — Global Taxonomy Nodes

Generate the SHARED node pool for the vivim-final provider taxonomy library. These nodes
are defined ONCE and referenced by many platforms (taxonomies are shared). Focus on the
cross-cutting concepts: capabilities (actions), protocols (transports), webapp tech stacks
(the DOM/UI surface), and parsers (streaming/mirror decoders).

## Output Format (STRICT JSON)

```json
{
  "capabilities": [
    { "slug": "send_message", "label": "Send Message", "capabilityKind": "action",
      "description": "Compose and dispatch a message in the composer", "sourceConfidence": "high",
      "tags": ["compose"] }
  ],
  "protocols": [
    { "slug": "cdp", "label": "Chrome DevTools Protocol", "transport": "cdp",
      "description": "Browser automation via CDP (selectors, DOM)", "sourceConfidence": "high" }
  ],
  "webappTechStacks": [
    { "slug": "prosemirror", "label": "ProseMirror", "family": "editor",
      "description": "Structured rich-text editor used by ChatGPT/Claude web UIs",
      "composerHint": ".ProseMirror[contenteditable='true']", "sendHint": "[data-testid='send-button']",
      "sourceConfidence": "high" }
  ],
  "parsers": [
    { "slug": "sse_openai", "label": "OpenAI SSE", "parserType": "sse",
      "fallbackSlug": "sse_generic", "description": "SSE delta stream for OpenAI-compatible APIs",
      "sourceConfidence": "high" }
  ]
}
```

## Rules
- `capabilities`: the action vocabulary every platform may expose (send_message, select_model,
  regenerate_response, upload_file, new_chat, navigate, edit_message, delete_chat, rename_chat, login,
  logout, search, scroll_feed, react, comment, follow, ...). Aim for 40-80 shared capabilities.
- `protocols`: transports — cdp, dom, rest, ws, sse, graphql, mirroring. ~7 nodes.
- `webappTechStacks`: DOM/UI frameworks — prosemirror, quill, contenteditable, textarea, react,
  vue, svelte, vanilla-dom, codemirror, lexical, tiptap. Give composerHint/sendHint selectors
  where known. ~10 nodes.
- `parsers`: streaming/mirror decoders — sse_openai, sse_generic, ndjson, batchexecute
  (Gemini), frame, html-diff, text. ~6-10 nodes. `fallbackSlug` points to a more generic parser.
- `slug` = snake_case. `sourceConfidence` = high|medium|low.
- Return ONLY valid JSON, no markdown fences, no commentary.


