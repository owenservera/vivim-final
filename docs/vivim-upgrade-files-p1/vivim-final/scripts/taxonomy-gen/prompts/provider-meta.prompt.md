# Provider Meta Prompt - {{PLATFORM}}

Generate the metadata block for **{{PLATFORM}}** ({{CATEGORY}}) as a TAXONOMY NODE. This node
is the root of the platform's functional chain.

## Output Format (STRICT JSON)

```json
{
  "nodes": [
    {
      "kind": "platform",
      "slug": "{{PLATFORM}}",
      "label": "Human Readable Name",
      "description": "One-line description",
      "category": "{{CATEGORY}}",
      "url": "https://...",
      "authType": "browser|api_key|oauth|none|bot_token",
      "interactionPattern": "feed|message|story|thread|editor|terminal|browser",
      "techStackSlugs": ["prosemirror", "react"],
      "sourceConfidence": "high"
    }
  ],
  "edges": [
     { "fromSlug": "{{PLATFORM}}", "fromKind": "platform", "toSlug": "prosemirror",
      "toKind": "webapp_tech_stack", "relation": "uses", "confidence": "high" }
  ]
}
```

## Rules
- `authType`: browser (CDP login) | api_key | oauth | none | bot_token
- `interactionPattern`: primary UI pattern
- `techStackSlugs`: the webapp tech stacks this platform is rendered on (see shared pool).
  Emit a `uses` edge for each.
- Return ONLY valid JSON, no markdown fences, no commentary.


