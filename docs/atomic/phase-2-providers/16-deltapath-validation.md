# Unit 2.16: ProviderStreamConfig Delta Path Validation

**Phase:** 2 | **File:** `src/schema/provider-manifest.ts`
**Depends:** 2.12 ProviderManifest Zod schema | **Produces:** Validated delta path format
**Source:** `docs/audits/ARCHITECTURAL-ADJUSTMENTS.md` §Adjustment 4

## Purpose
Add Zod validation for `deltaPathJson` to ensure it follows the correct JSON path format. Invalid delta paths cause silent failures in `StreamParserEngine`.

## Interface

### Zod Schema Update
```typescript
// In src/schema/provider-manifest.ts
const StreamConfigSchema = z.object({
  transport: z.enum(['sse', 'batchexecute', 'websocket', 'sse-patch']),
  sse_format: z.enum(['openai', 'anthropic', 'gemini', 'generic']).optional(),
  content_type: z.string().optional(),
  terminal: z.array(z.object({
    type: z.enum(['data-value', 'event-type', 'data-suffix', 'data-prefix']),
    value: z.string(),
  })).optional().default([]),
  completion_detectors: z.array(z.object({
    type: z.enum(['event-type', 'data-value', 'finish-reason']),
    pattern: z.string(),
  })).optional().default([]),
  delta_path: z.string()
    .regex(/^(choices\[\d+\]\.delta\.\w+|delta\.\w+)$/, 'Invalid delta path format')
    .optional(),
  harness_js: z.string().optional(),
})
```

### Delta Path Format
```typescript
// Valid formats:
// "choices[0].delta.content" — OpenAI format
// "delta.text" — Anthropic format
// "delta.thinking" — Anthropic thinking format

// Invalid formats:
// "choices.delta.content" — Missing index
// "choices[0].delta." — Trailing dot
// "choices[0].delta" — Missing field
```

### ProviderManifestSchema Update
```typescript
// In src/schema/provider-manifest.ts
export const ProviderManifestSchema = z.object({
  // ... existing fields ...
  stream_config: StreamConfigSchema.optional(),
})
```

## Store Contract
```typescript
// No new store methods needed — validation is in Zod schema
```

## Tests
- Valid delta paths pass validation
- Invalid delta paths fail validation
- Missing delta_path is allowed (optional)
- All provider formats are supported

## Effort
**XS** (30 min) — Add Zod validation regex
