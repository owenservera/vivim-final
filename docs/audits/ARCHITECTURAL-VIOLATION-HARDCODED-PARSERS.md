# Architectural Violation: Hardcoded Parser Logic in Source

**Date:** 2026-07-11
**Status:** RESOLVED — Units 2.17-2.19 implemented
**Severity:** HIGH — violated "engine not a frame" principle

---

## Problem Statement

`StreamParserEngine` contained hardcoded provider-specific parser logic in source code. This violated the core architectural principle that **all provider particulars live in DB, not source**. The engine is a loader/executor, not a parser repository.

---

## Evidence: Hardcoded Logic in `src/engines/stream-parser.ts`

### Hardcoded Parser Implementations

```typescript
// Lines 48-84: HARDCODED Claude parser
function builtinClaude(): ParserModule {
  return {
    name: 'claude/001_streaming_sse',
    version: 1,
    providerId: 'claude',
    parse(rawBody: string): ContentBlock[] {
      // Claude-specific SSE parsing logic
      // delta.thinking, delta.content extraction
    },
    detectCompletion(rawBody: string): boolean {
      return rawBody.includes('[DONE]')
    },
    getConfidence(): number {
      return 0.9
    },
  }
}

// Lines 86-112: HARDCODED generic parser
function builtinGeneric(): ParserModule {
  return {
    name: 'generic/001_sse_frames',
    version: 1,
    providerId: 'generic',
    parse(rawBody: string): ContentBlock[] {
      // Generic SSE frame parsing logic
    },
    detectCompletion(rawBody: string): boolean {
      return rawBody.length > 0
    },
    getConfidence(): number {
      return 0.6
    },
  }
}
```

### Hardcoded Provider→Parser Mapping

```typescript
// Lines 114-119: HARDCODED mapping
const BUILTIN = {
  claude: builtinClaude,
  gemini: builtinGeneric,
  chatgpt: builtinGeneric,
  generic: builtinGeneric,
} as const

// Lines 121-124: HARDCODED fallback
function getBuiltin(key: string): () => ParserModule {
  if (key in BUILTIN) return BUILTIN[key as keyof typeof BUILTIN]
  return BUILTIN.generic
}
```

### Hardcoded Fallback Chain

```typescript
// Lines 144-167: HARDCODED fallback sequence
try {
  module = await this.loadProviderParser(providerId)
} catch {
  try {
    module = await this.loadGenericFallback()  // HARDCODED
  } catch {
    try {
      module = await this.loadSystemFallback()  // HARDCODED
    } catch {
      blocks = errorBlock(providerId, 'all parsers failed')
    }
  }
}
```

---

## Why This Is Wrong

### 1. Violates "Engine Not a Frame"
The engine should be a generic loader/executor. It should not know about Claude, ChatGPT, Gemini, or any specific provider. That knowledge belongs in DB.

### 2. Breaks DB-Driven Architecture
We just implemented `ProviderParser.parserLogicCode` for inline parser storage. But the engine still falls back to hardcoded parsers instead of DB.

### 3. Prevents User Customization
Users cannot override or customize parser logic if it's hardcoded in source. The whole point of DB-driven loading is to enable runtime customization.

### 4. Creates Maintenance Burden
Every time a provider changes their streaming format, we must:
1. Modify source code
2. Redeploy the engine
3. Hope the hardcoded parser matches the new format

With DB-driven loading, we just update the DB row.

---

## Current Fallback Chain (Wrong)

```
1. loadProviderParser(providerId)
   → DB: getActiveParser(providerId)
   → If found: load from file or inline
   → If not found: fall through

2. loadGenericFallback()
   → HARDCODED: import(config.genericFilePath)
   → If fails: fall through

3. loadSystemFallback()
   → HARDCODED: import(config.fallbackFilePath)
   → If fails: fall through

4. errorBlock()
   → Return error
```

**Problem:** Steps 2 and 3 use hardcoded file paths, not DB.

---

## Correct Fallback Chain (DB-Driven)

```
1. loadProviderParser(providerId)
   → DB: getActiveParser(providerId)
   → If found with logicType='inline': compile from logicCode
   → If found with logicType='file': import from filePath
   → If not found: fall through

2. loadGenericParser()
   → DB: getActiveParser('generic')
   → If found: load from DB
   → If not found: fall through

3. loadSystemParser()
   → DB: getActiveParser('system')
   → If found: load from DB
   → If not found: fall through

4. errorBlock()
   → Return error (misconfiguration: no parsers in DB)
```

**Correct:** All parser logic lives in DB. Engine is pure loader.

---

## Required DB State

For the correct fallback chain to work, we need these rows in `provider_parser`:

| providerId | parserName | logicType | logicCode | filePath | isActive |
|------------|------------|-----------|-----------|----------|----------|
| claude | claude/001_streaming_sse | inline | (Claude SSE parser code) | null | 1 |
| chatgpt | chatgpt/001_openai_sse | file | null | chatgpt/001_openai_sse.ts | 1 |
| gemini | gemini/001_batchexecute | file | null | gemini/001_batchexecute.ts | 1 |
| generic | generic/001_sse_frames | inline | (Generic SSE parser code) | null | 1 |
| system | system/001_fallback | inline | (Fallback parser code) | null | 1 |

---

## Seed Data Migration

The current seed files in `seeds/parsers/` contain parser logic as TypeScript files. We need to:

1. **Read each parser file** and extract the logic
2. **Store as inline code** in `ProviderParser.parserLogicCode`
3. **Remove hardcoded parsers** from `StreamParserEngine`
4. **Update seeds** to include inline logic

### Parser Files to Migrate

| File | Provider | Parser |
|------|----------|--------|
| `seeds/parsers/claude/001_streaming_sse.ts` | claude | Claude SSE |
| `seeds/parsers/chatgpt/001_openai_sse.ts` | chatgpt | OpenAI SSE |
| `seeds/parsers/gemini/001_batchexecute.ts` | gemini | Gemini batchexecute |
| `seeds/parsers/generic/001_sse_frames.ts` | generic | Generic SSE frames |
| `seeds/parsers/generic/002_openai_delta.ts` | generic | OpenAI delta |
| `seeds/parsers/system/001_fallback.ts` | system | System fallback |

---

## Implementation Plan

### Step 1: Create Atomic Spec (2.17)
- Title: Remove Hardcoded Parsers from StreamParserEngine
- File: `src/engines/stream-parser.ts`
- Effort: M (3 hours)

### Step 2: Migrate Parser Logic to DB
- Read each parser file from `seeds/parsers/`
- Store logic as `parserLogicCode` in seed data
- Update seed JSON to include inline code

### Step 3: Update StreamParserEngine
- Remove `builtinClaude()`, `builtinGeneric()`, `BUILTIN` map
- Update `loadProviderParser()` to only read from DB
- Update fallback chain to use DB-only lookups
- Remove `loadGenericFallback()` and `loadSystemFallback()` hardcoded paths

### Step 4: Update Seed Schema
- Add `logic_code` field to parser entries in seed JSON
- Ensure `ProviderRegistrar` reads and stores inline code

### Step 5: Verify
- All parsers loaded from DB
- No hardcoded parser logic in source
- Fallback chain works via DB lookups only

---

## Design Invariants Restored

1. **Engine is a loader/executor** — no provider-specific knowledge
2. **All particulars in DB** — parser logic, selectors, configs
3. **Runtime customizable** — users can override parsers via DB
4. **No source changes for provider updates** — just update DB rows
5. **Single source of truth** — DB is authoritative

---

## Related Units

- 2.1: ProviderRegistrar (creates parser rows)
- 2.13: ProviderEndpoint DOM Interaction Config
- 2.15: ProviderParser Hash Auto-computation
- **2.17: Remove Hardcoded Parsers** (this unit)

---

## Next Steps

1. Create atomic spec for unit 2.17
2. Add to tracker
3. Migrate parser logic to DB
4. Remove hardcoded parsers from engine
5. Verify DB-only loading

---

## Resolution (2026-07-11)

### Units Implemented
- **2.17:** Removed hardcoded parsers from `StreamParserEngine`
- **2.18:** Migrated parser logic from `seeds/parsers/*.ts` to `seeds/providers/*.json` as inline code
- **2.19:** Implemented DB-only fallback chain

### Changes Made

#### StreamParserEngine (`src/engines/stream-parser.ts`)
- Removed `builtinClaude()`, `builtinGeneric()`, `BUILTIN` map, `getBuiltin()`
- Removed `loadGenericFallback()` and `loadSystemFallback()` hardcoded paths
- Added `loadGenericParser()` — reads from DB via `store.getGenericParser()`
- Added `loadSystemFallbackParser()` — reads from DB via `store.getSystemFallbackParser()`
- Updated `loadProviderParser()` to throw when no parser found (no builtin fallback)
- Updated `loadInlineParser()` to use `new Function('module', 'exports', code)` pattern

#### ParserStore (`src/storage/contracts/parser-store.ts`)
- Added `getGenericParser()` method
- Added `getSystemFallbackParser()` method

#### ParserStoreImpl (`src/storage/impl/parser-store-impl.ts`)
- Implemented `getGenericParser()` — queries DB for `providerId='generic'`
- Implemented `getSystemFallbackParser()` — queries DB for `providerId='system'`

#### Provider Seeds (`seeds/providers/*.json`)
- Updated 7 provider seeds with inline parser logic (`logic_type: 'inline'`, `logic_code`)
- Created new `seeds/providers/system.json` with system fallback + generic parsers

#### Tests (`tests/unit/engines/stream-parser.test.ts`)
- Removed tests relying on hardcoded fallback
- Added tests for DB-only fallback chain
- All 8 tests pass

#### Tests (`tests/unit/engines/provider-registrar.test.ts`)
- Updated to expect 8 providers (added system.json)
- All 11 tests pass

### Verification
- `bun run typecheck` — passes
- `bun test tests/unit/engines/stream-parser.test.ts` — 8/8 pass
- `bun test tests/unit/engines/provider-registrar.test.ts` — 11/11 pass
- `bun test tests/unit/engines/registration-auditor.test.ts` — 12/12 pass
