# Atomic Unit 2.18 — Parser Seed Migration (TS Files → DB Inline Code)

**Status:** `[~]` In Progress
**Phase:** 2 (Provider Knowledge Graph)
**Depends:** 2.17 (Remove Hardcoded Parsers)
**Effort:** M (2h)

---

## Problem

Parser logic lives in `seeds/parsers/*.ts` files (6 files). These are TypeScript modules imported at runtime. They should be stored as inline code in `ProviderParser.parserLogicCode` in the DB, loaded via `ProviderRegistrar` from provider seed JSON.

---

## What Changes

### Source Files to Migrate

| File | Provider | Parser Name | Logic |
|------|----------|-------------|-------|
| `seeds/parsers/claude/001_streaming_sse.ts` | claude | claude/001_streaming_sse | SSE parser with thinking/content blocks |
| `seeds/parsers/chatgpt/001_openai_sse.ts` | chatgpt | chatgpt/001_openai_sse | OpenAI SSE parser with tool calls |
| `seeds/parsers/gemini/001_batchexecute.ts` | gemini | gemini/001_batchexecute | Nested JSON array parser |
| `seeds/parsers/generic/001_sse_frames.ts` | generic | generic/001_sse_frames | Generic SSE frame parser |
| `seeds/parsers/generic/002_openai_delta.ts` | generic | generic/002_openai_delta | OpenAI delta streaming parser |
| `seeds/parsers/system/001_fallback.ts` | system | system/001_fallback | Universal fallback parser |

### Seed JSON Changes

Each provider seed JSON (`seeds/providers/*.json`) gets a `parsers` array with `logic_type: 'inline'` and `logic_code` containing the parser logic.

**Example: `seeds/providers/claude.json`**
```json
{
  "parsers": [
    {
      "name": "claude/001_streaming_sse",
      "version": 1,
      "is_active": true,
      "logic_type": "inline",
      "logic_code": "parse(rawBody) { ... }"
    }
  ]
}
```

### ProviderManifest Zod Schema (already supports this)

```typescript
const ParserSchema = z.object({
  name: z.string(),
  file: z.string().optional(),  // Optional for inline parsers
  version: z.number().int().positive(),
  is_active: z.boolean().optional().default(true),
  fallback: z.string().optional(),
  logic_type: z.enum(['file', 'inline', 'composed']).optional().default('file'),
  logic_code: z.string().optional(),  // Inline TypeScript/JavaScript for DB-driven loading
})
```

---

## Parser Logic Extraction

Each `.ts` file exports a `ParserModule` with `parse()`, `detectCompletion()`, `getConfidence()`.

**For DB inline storage, we store the full module object:**

```typescript
// Example: Claude parser inline code
{
  name: 'claude/001_streaming_sse',
  version: 1,
  providerId: 'claude',
  parse(rawBody) { ... },
  detectCompletion(rawBody) { ... },
  getConfidence(rawBody) { ... }
}
```

---

## Implementation Plan

### Step 1: Read each parser file
Extract the parser logic as a string.

### Step 2: Update provider seed JSONs
Add `logic_type: 'inline'` and `logic_code` to each parser entry.

### Step 3: Update ProviderRegistrar
Ensure `register()` reads `logic_code` from manifest and stores it in `ProviderParser.parserLogicCode`.

### Step 4: Verify
- All parser logic in DB
- No hardcoded parsers in source
- Seeds load correctly

---

## Test Contract

### Test file: `tests/unit/engines/stream-parser.test.ts`

**Add tests:**
- `parse() loads inline parser from DB`
- `parse() uses logicCode when logicType='inline'`
- `ProviderRegistrar reads logic_code from manifest`

---

## Gate Criteria

- [ ] All 6 parser files migrated to inline code in seed JSONs
- [ ] Provider seed JSONs have `logic_type: 'inline'` and `logic_code`
- [ ] ProviderRegistrar reads and stores inline code
- [ ] StreamParserEngine loads parsers from DB (not files)
- [ ] All tests pass
- [ ] `bun run typecheck` passes
