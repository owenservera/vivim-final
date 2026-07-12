# Atomic Unit 2.19 — DB-Only Fallback Chain

**Status:** `[~]` In Progress
**Phase:** 2 (Provider Knowledge Graph)
**Depends:** 2.17 (Remove Hardcoded Parsers), 2.18 (Parser Seed Migration)
**Effort:** S (1h)

---

## Problem

The fallback chain in `StreamParserEngine` currently uses hardcoded file paths for generic and system fallback parsers. We need a pure DB-driven fallback chain.

---

## Fallback Chain Architecture

### Current (Wrong)
```
1. DB: getActiveParser(providerId)
2. HARDCODED: loadGenericFallback() → import(config.genericFilePath)
3. HARDCODED: loadSystemFallback() → import(config.fallbackFilePath)
4. errorBlock()
```

### New (Correct)
```
1. DB: getActiveParser(providerId)
   → If found: load from inline code or file
   → If not found: fall through

2. DB: getGenericParser()
   → If found: load from DB
   → If not found: fall through

3. DB: getSystemFallbackParser()
   → If found: load from DB
   → If not found: fall through

4. errorBlock()
   → Return error (misconfiguration: no parsers in DB)
```

---

## Implementation

### StreamParserEngine.parse()

```typescript
async parse(rawBody: string, providerId: string): Promise<ParseResult> {
  const start = Date.now()
  let module: ParserModule
  let blocks: ContentBlock[]

  try {
    module = await this.loadProviderParser(providerId)
    blocks = module.parse(rawBody)
  } catch {
    try {
      module = await this.loadGenericParser()
      blocks = module.parse(rawBody)
    } catch {
      try {
        module = await this.loadSystemFallbackParser()
        blocks = module.parse(rawBody)
      } catch {
        blocks = errorBlock(providerId, 'all parsers failed — check provider_parser table')
        module = {
          name: 'error',
          version: 0,
          providerId,
          parse: () => blocks,
          detectCompletion: () => true,
          getConfidence: () => 0,
        }
      }
    }
  }

  const confidence =
    typeof module.getConfidence === 'function' ? module.getConfidence(rawBody) : 0.5

  return {
    blocks,
    confidence,
    parserName: module.name,
    parserVersion: module.version,
    durationMs: Date.now() - start,
  }
}
```

### StreamParserEngine.loadGenericParser()

```typescript
private async loadGenericParser(): Promise<ParserModule> {
  const row = await this.store.getGenericParser()
  if (!row) throw new EngineError('No generic parser in DB')
  
  const cached = this.parserCache.get('generic')
  if (cached && cached.hash === row.hash) return cached.module
  
  let module: ParserModule
  if (row.logicType === 'inline' && row.logicCode) {
    module = await this.loadInlineParser(row.logicCode, row.hash)
  } else if (row.logicType === 'file' && row.filePath) {
    module = await this.loadFileParser(row.filePath, 'generic')
  } else {
    throw new EngineError('Generic parser has no logic')
  }
  
  this.parserCache.set('generic', { module, hash: row.hash })
  return module
}
```

### StreamParserEngine.loadSystemFallbackParser()

```typescript
private async loadSystemFallbackParser(): Promise<ParserModule> {
  const row = await this.store.getSystemFallbackParser()
  if (!row) throw new EngineError('No system fallback parser in DB')
  
  const cached = this.parserCache.get('system')
  if (cached && cached.hash === row.hash) return cached.module
  
  let module: ParserModule
  if (row.logicType === 'inline' && row.logicCode) {
    module = await this.loadInlineParser(row.logicCode, row.hash)
  } else if (row.logicType === 'file' && row.filePath) {
    module = await this.loadFileParser(row.filePath, 'system')
  } else {
    throw new EngineError('System fallback parser has no logic')
  }
  
  this.parserCache.set('system', { module, hash: row.hash })
  return module
}
```

---

## Test Contract

### Test file: `tests/unit/engines/stream-parser.test.ts`

**Add tests:**
- `parse() falls back to generic parser from DB when provider parser fails`
- `parse() falls back to system parser from DB when generic fails`
- `parse() returns error when no parsers exist in DB`
- `detectCompletion() uses fallback chain`

---

## Gate Criteria

- [ ] `loadGenericParser()` reads from DB only
- [ ] `loadSystemFallbackParser()` reads from DB only
- [ ] No hardcoded file paths in engine
- [ ] Fallback chain: provider → generic → system → error
- [ ] All tests pass
- [ ] `bun run typecheck` passes
