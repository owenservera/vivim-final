# Webapp Tech Stack Prompt — DOM/UI Surface Taxonomy

Build the **webapp_tech_stack** taxonomy: the DOM/UI frameworks that determine HOW a
platform is automated via CDP/DOM. Every platform runs on one or more tech stacks; every
selector/method targets a tech stack. This node type is the bridge between a capability and
the actual CDP interaction.

## Known stacks (seed, extend as needed)
prosemirror, quill, contenteditable, textarea, react, vue, svelte, vanilla-dom, codemirror,
lexical, tiptap, canvas, webgl.

## Output Format (STRICT JSON)

```json
{
  "webappTechStacks": [
    {
      "slug": "prosemirror",
      "label": "ProseMirror",
      "family": "editor",
      "description": "Schema-driven rich-text editor; composer is a contenteditable .ProseMirror",
      "composerHint": ".ProseMirror[contenteditable='true']",
      "sendHint": "[data-testid='send-button'], button[aria-label='Send']",
      "sourceConfidence": "high",
      "tags": ["rich-text", "contenteditable"]
    }
  ]
}
```

## Rules
- `family`: editor | framework | dom
- `composerHint` / `sendHint`: best-known CSS selectors for the composer surface + send control.
- Include the canonical selection/input mechanism (how text is entered: contenteditable,
  textarea, or input event dispatch).
- Mark selectors you are unsure of with `sourceConfidence: "low"` — they become PLACEHOLDERS
  the runtime falls back to generic selectors for.
- Return ONLY valid JSON, no markdown fences, no commentary.


