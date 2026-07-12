# Provider Logic Migration — Complete Analysis

**Date:** 2026-07-11
**Purpose:** Holistic analysis of provider logic implementation and runtime loading strategy
**Status:** Analysis complete, implementation plan ready

---

## Files Created

| File | Purpose |
|------|---------|
| `docs/audits/MIGRATION-REPORT.md` | What to harvest from original codebases |
| `docs/audits/PROVIDER-LOGIC-STRATEGY.md` | DB-driven runtime loading strategy |

---

## Key Findings

### 1. What's Already Done (Skip)

vivim-final already has:
- Prisma schema with 50+ models
- Provider manifest seeds (7 providers)
- Parser seeds (6 files)
- ChromeGovernor (full CDP)
- ProviderHealthKernel
- SelectorHealer (5 strategies)
- StreamParserEngine with fallback chain

**Total skipped: ~3,500+ LOC**

### 2. What Needs Harvest

**Tier 1: Pure Functions (~820 LOC, ~2 hours)**
- Confidence formula (168 LOC)
- Status ladder (169 LOC)
- Stream completion detector (155 LOC)
- Drift monitor (96 LOC)
- URL wildcard matcher (25 LOC)
- SSE parser (50 LOC)
- Verify gate (89 LOC)
- Error→HTTP mapping (8 LOC/class)
- Timeout guard (60 LOC)

**Tier 2: Wire Into Engines (~150 LOC, ~1 hour)**
- Wire confidence → DB
- Wire status ladder → BindingStatusLog
- Wire stream completion → StreamParserEngine
- Wire per-provider delta extractors
- Wire URL matcher → manifest inference
- Wire error→HTTP → server response

**Tier 3: Adapt Patterns (~2,036 LOC, ~4 hours)**
- Recipe JSON format
- Turn executor
- Trusted input dispatch
- Health check loop
- Drift detection loop
- Failure classifier
- Selector portfolio generator
- Parallel healer

**Tier 4: Production Hardening (~134 LOC, ~30 min)**
- Pre-migration backup
- Crash report handler
- Port lock file
- Graceful shutdown
- Production error scrubbing

### 3. Current Architecture Issues

**Issue 1: Parser Logic Not in DB**
- Parser code lives in `.ts` files, not in DB
- Users can't customize parsers without code changes
- Breaks in serverless/edge environments

**Issue 2: Provider Configurations Duplicated**
- `seeds/providers/*.json`
- `provider-logic/configurations/provider-configurations.ts`
- `provider-logic/providers/*.json`
- Maintenance burden, potential drift

**Issue 3: No Runtime Customization**
- Can't override parser logic per-provider
- Can't A/B test parsers
- Can't deploy custom parsers without redeployment

### 4. Proposed Solution: DB-Driven Runtime Loading

**Phase 1: Extend ProviderParser Model**
```prisma
model ProviderParser {
  // ... existing fields
  parserLogicCode  String? @map("parser_logic_code")  // NEW: inline TypeScript
}
```

**Phase 2: Add ProviderStreamConfig Model**
```prisma
model ProviderStreamConfig {
  id                    String  @id
  providerId            String  @map("provider_id")
  streamTransport       String
  streamTerminalJson    String  @default("[]") @map("stream_terminal_json")
  sseFormat             String? @map("sse_format")
  completionDetectorsJson String @default("[]") @map("completion_detectors_json")
  version               Int     @default(1)
  // ...
}
```

**Phase 3: Inline Parser Compilation**
- Store parser logic as TypeScript string in DB
- Compile to JavaScript at runtime using esbuild
- Cache compiled modules

**Phase 4: Unified Provider Configuration**
- Single source of truth in DB
- Remove duplicate files
- Hot-reload on config change

---

## Summary Statistics

| Category | LOC | Effort |
|----------|-----|--------|
| Already done (skip) | ~3,500+ | 0 |
| Tier 1: Pure functions | ~820 | ~2 hours |
| Tier 2: Wire into engines | ~150 | ~1 hour |
| Tier 3: Adapt patterns | ~2,036 | ~4 hours |
| Tier 4: Production hardening | ~134 | ~30 min |
| Phase 1-4: DB-driven loading | ~400 | ~5 hours |
| **Total to implement** | **~3,740** | **~12.5 hours** |

---

## Recommended Implementation Order

1. **Phase 1:** DB migration (add fields, create models)
2. **Phase 2:** Tier 1 pure functions (confidence, status ladder, stream completion)
3. **Phase 3:** Tier 2 wiring (hook functions into engines)
4. **Phase 4:** StreamParserEngine update (inline loading)
5. **Phase 5:** ProviderRegistrar update (unified config)
6. **Phase 6:** Tier 3 adaptations (turn executor, trusted input, healing)
7. **Phase 7:** Tier 4 production hardening
8. **Phase 8:** Cleanup duplicate files

---

## Design Invariants Preserved

1. **Fallback chain intact** - inline → file → generic → builtin
2. **Cache invalidation works** - hash-based cache keys
3. **Type safety maintained** - ParserModule interface unchanged
4. **Backward compatible** - existing file-based parsers still work
5. **No breaking changes** - additive only
6. **Single source of truth** - DB is authoritative
7. **Hot-reload capable** - no restart required
