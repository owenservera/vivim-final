# Atomic Unit 2.17 — Remove Hardcoded Parsers from StreamParserEngine

**Status:** `[~]` In Progress
**Phase:** 2 (Provider Knowledge Graph)
**Depends:** 4.1 (StreamParserEngine), 2.12 (ProviderManifest Zod)
**Effort:** M (3h)

---

## Problem

`StreamParserEngine` contains hardcoded provider-specific parser logic:
- `builtinClaude()` — Claude SSE parser (lines 48-84)
- `builtinGeneric()` — Generic SSE parser (lines 86-112)
- `BUILTIN` map — provider→parser mapping (lines 114-119)
- `getBuiltin()` — hardcoded fallback (lines 121-124)
- `loadGenericFallback()` — hardcoded generic file path (lines 288-290)
- `loadSystemFallback()` — hardcoded system file path (lines 292-294)

This violates the principle that all provider particulars live in DB, not source.

---

## Interface Changes

### StreamParserEngine (modify)

**Remove:**
```typescript
function builtinClaude(): ParserModule { ... }
function builtinGeneric(): ParserModule { ... }
const BUILTIN = { claude: builtinClaude, ... }
function getBuiltin(key: string): () => ParserModule { ... }
private async loadGenericFallback(): Promise<ParserModule> { ... }
private async loadSystemFallback(): Promise<ParserModule> { ... }
```

**Keep:**
```typescript
private async loadProviderParser(providerId: string): Promise<ParserModule>
private async loadInlineParser(code: string, hash: string): Promise<ParserModule>
private async loadFileParser(filePath: string, providerId: string): Promise<ParserModule>
```

**Add:**
```typescript
private async loadGenericParser(): Promise<ParserModule>
private async loadSystemFallbackParser(): Promise<ParserModule>
```

### ParserStore (modify)

**Add:**
```typescript
getGenericParser(): Promise<ProviderParserRow | null>
getSystemFallbackParser(): Promise<ProviderParserRow | null>
```

---

## Store Contract Changes

### ParserStore contract (`src/storage/contracts/parser-store.ts`)

```typescript
export interface ParserStore {
  // existing
  getParser(providerId: string): Promise<ProviderParserRow | null>
  getActiveParser(providerId: string): Promise<ProviderParserRow | null>
  upsertParser(parser: ProviderParserRow): Promise<void>
  listParsers(providerId: string): Promise<ProviderParserRow[]>
  getParserByFile(filePath: string): Promise<ProviderParserRow | null>
  getParserByHash(hash: string): Promise<ProviderParserRow | null>
  
  // NEW: DB-only fallback chain
  getGenericParser(): Promise<ProviderParserRow | null>
  getSystemFallbackParser(): Promise<ProviderParserRow | null>
}
```

### ParserStoreImpl (`src/storage/impl/parser-store-impl.ts`)

```typescript
async getGenericParser(): Promise<ProviderParserRow | null> {
  const r = await this.p.providerParser.findFirst({
    where: { providerId: 'generic', isActive: 1 },
  })
  return r ? toParserRow(r as PrismaParserRow) : null
}

async getSystemFallbackParser(): Promise<ProviderParserRow | null> {
  const r = await this.p.providerParser.findFirst({
    where: { providerId: 'system', isActive: 1 },
  })
  return r ? toParserRow(r as PrismaParserRow) : null
}
```

---

## Fallback Chain (New)

```
1. loadProviderParser(providerId)
   → DB: getActiveParser(providerId)
   → If found with logicType='inline': compile from logicCode
   → If found with logicType='file': import from filePath
   → If not found: fall through

2. loadGenericParser()
   → DB: getGenericParser()
   → If found: load from DB
   → If not found: fall through

3. loadSystemFallbackParser()
   → DB: getSystemFallbackParser()
   → If found: load from DB
   → If not found: fall through

4. errorBlock()
   → Return error (misconfiguration: no parsers in DB)
```

---

## Test Contract

### Test file: `tests/unit/engines/stream-parser.test.ts`

**Update existing tests:**
- Remove tests that rely on hardcoded fallback (line 51-56)
- Update `parse() returns error block when every parser fails` to verify DB-only fallback

**Add new tests:**
- `parse() falls back to generic parser from DB`
- `parse() falls back to system parser from DB`
- `parse() returns error when DB has no parsers`
- `loadProviderParser() uses inline code when logicType='inline'`

---

## Gate Criteria

- [ ] All hardcoded parser functions removed from `stream-parser.ts`
- [ ] `BUILTIN` map and `getBuiltin()` removed
- [ ] `loadGenericFallback()` and `loadSystemFallback()` removed
- [ ] `ParserStore` contract has `getGenericParser()` and `getSystemFallbackParser()`
- [ ] `ParserStoreImpl` implements new methods
- [ ] `parse()` fallback chain uses DB-only lookups
- [ ] All tests pass
- [ ] `bun run typecheck` passes
