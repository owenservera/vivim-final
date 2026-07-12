# Constraints Prompt - {{PLATFORM}}

Generate constraints + auth requirements for **{{PLATFORM}}** ({{CATEGORY}}). These enrich the
platform node (merged by the orchestrator) and inform capability gating.

## Output Format (STRICT JSON)

```json
{
  "platformPatch": {
    "authRequirements": ["OAuth 2.0", "User Context Token"],
    "rateLimits": { "requests": 300, "window": "15min" },
    "maxMessageLength": 280,
    "supportedMediaTypes": ["image/jpeg", "image/png", "video/mp4", "gif"]
  }
}
```

## Rules
- `rateLimits.window` = second|minute|hour|day|15min
- `maxMessageLength` = char limit (0 = unlimited)
- `supportedMediaTypes` = accepted MIME types
- `authRequirements` = human-readable auth needs
- Web-search "<platform> API rate limits" / "max message length" if unsure; mark confidence low.
- Return ONLY valid JSON, no markdown fences, no commentary.


