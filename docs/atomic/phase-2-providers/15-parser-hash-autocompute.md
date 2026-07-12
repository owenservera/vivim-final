# Unit 2.15: ProviderParser Hash Auto-computation

**Phase:** 2 | **File:** `src/engines/provider-registrar.ts`
**Depends:** 2.1 ProviderRegistrar | **Produces:** Automatic parser hash computation
**Source:** `docs/audits/ARCHITECTURAL-ADJUSTMENTS.md` §Adjustment 3

## Purpose
Automatically compute `parserHash` when upserting a parser, ensuring cache invalidation works correctly. Currently, `parserHash` is set to `null` manually, which breaks the `StreamParserEngine`'s hash-based cache invalidation.

## Interface

### Hash Computation
```typescript
// In src/engines/provider-registrar.ts
import { createHash } from 'node:crypto'

function computeParserHash(logicCode: string | null, filePath: string | null): string {
  const content = logicCode ?? filePath ?? ''
  return createHash('sha256').update(content).digest('hex').slice(0, 16)
}
```

### Registrar Update
```typescript
// In src/engines/provider-registrar.ts
// Update upsertParser to compute hash
const parserRow: ProviderParserRow = {
  // ... existing fields ...
  parser_hash: computeParserHash(parser.logic_code ?? null, parser.file ?? null),
}
```

## Store Contract
```typescript
// No new store methods needed — hash is computed in Registrar
```

## Tests
- Hash is computed correctly for inline parser
- Hash is computed correctly for file-based parser
- Hash changes when parser code changes
- Hash is stable for same content

## Effort
**XS** (30 min) — Add hash computation function + update Registrar
