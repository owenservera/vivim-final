# Methods Prompt — Executable Capability Mechanisms

For platform **{{PLATFORM}}** ({{CATEGORY}}), generate the METHOD nodes that implement its
capabilities. A method is the executable link in the functional chain:

    capability ─implemented_by→ method ─uses_protocol→ protocol
                                  ─targets_tech_stack→ webapp_tech_stack
                                  ─parsed_by→ parser

## Available shared nodes (already generated)
{{PRIOR_NODES}}

## Output Format (STRICT JSON)

```json
{
  "methods": [
    {
      "slug": "chatgpt__send_message",
      "label": "ChatGPT: Send Message",
      "capabilitySlug": "send_message",
      "platformSlug": "chatgpt",
      "protocolSlug": "cdp",
      "techStackSlug": "prosemirror",
      "parserSlug": "sse_openai",
      "selectorType": "css",
      "selectorValue": ".ProseMirror[contenteditable='true']",
      "sendMethod": "both",
      "programConfigJson": "{\"focus\":\"#prompt-textarea\",\"submit\":\"[data-testid='send-button']\"}",
      "recoveryStrategies": ["retry_selector", "navigate_home", "restart_chrome"],
      "sourceConfidence": "high"
    }
  ]
}
```

## Rules
- Reference shared node slugs from {{PRIOR_NODES}} for `capabilitySlug`, `protocolSlug`,
  `techStackSlug`, `parserSlug`. Do NOT redefine them.
- `protocolSlug` MUST be one of: cdp, dom, rest, ws, sse, graphql, mirroring.
- `selectorValue` is the CDP/DOM selector for the capability's primary control.
- If a selector is unknown, emit `"__PLACEHOLDER__"` and `sourceConfidence: "low"`.
- One platform may have multiple methods per capability (e.g. api + cdp variants).
- Return ONLY valid JSON, no markdown fences, no commentary.


