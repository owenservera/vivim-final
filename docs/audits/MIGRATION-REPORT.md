# Migration Analysis: Provider Logic → Vivim-Final

**Date:** 2026-07-11
**Purpose:** Comprehensive analysis of what to harvest from cap-store, capability-lab, and original Rust backend into vivim-final
**Status:** Analysis complete, implementation pending

---

## Executive Summary

**vivim-final's Prisma schema already covers everything.** The gap is in engine code, not data models. Every harvested feature maps to an existing Prisma field or model — **zero schema migrations required for the core harvest.**

---

## What's Already Done (Skip — ~3,500+ LOC)

| Component | Status | Location |
|-----------|--------|----------|
| Prisma schema (50+ models) | ✓ Complete | `prisma/schema.prisma` |
| Provider manifest seeds (7 providers) | ✓ Complete | `seeds/providers/*.json` |
| Parser seeds (6 files) | ✓ Complete | `seeds/parsers/` |
| ChromeGovernor (full CDP) | ✓ Complete | `src/engines/chrome-governor.ts` |
| ProviderHealthKernel | ✓ Complete | `src/engines/provider-health.ts` |
| SelectorHealer (5 strategies) | ✓ Complete | `src/engines/selector-healer.ts` |
| StreamParserEngine | ✓ Complete | `src/engines/stream-parser.ts` |
| ContentBlock model (9 types) | ✓ Complete | `src/engines/stream-parser.ts:9-18` |
| TransferAccelerator | ✓ Complete | `src/engines/transfer-accelerator.ts` |
| Auth gate | ✓ Complete | `src/errors.ts` |

---

## What Needs Harvest — Tier 1: Pure Functions (~820 LOC, ~2 hours)

**Zero architectural impact.** Add file, export. No changes to existing engines.

| # | What | Source | Target File | LOC |
|---|------|--------|-------------|-----|
| 1 | Confidence formula | cap-store `confidence.ts` | `src/engines/confidence-score.ts` | 168 |
| 2 | Status ladder + auto-promote | cap-store `lifecycle/index.ts` | `src/engines/lifecycle-ladder.ts` | 169 |
| 3 | Stream completion detector | cap-store `stream-detector.ts` | `src/engines/stream-detector.ts` | 155 |
| 4 | Drift monitor | cap-store `drift.ts` | `src/engines/drift-monitor.ts` | 96 |
| 5 | URL wildcard matcher | backend `provider_protocols.rs` | `src/utils/url-pattern.ts` | 25 |
| 6 | SSE parser (robust) | cap-store `parsers/sse.ts` | `src/parsers/sse.ts` | 50 |
| 7 | Verify gate | cap-store `verify.ts` | `src/engines/verify-gate.ts` | 89 |
| 8 | Error→HTTP mapping | cap-store `errors.ts` | extend `src/errors.ts` | 8/class |
| 9 | Timeout guard | cap-store `lifecycle/index.ts` | add to `lifecycle-ladder.ts` | 60 |

**Key insight:** These are all pure functions with zero dependencies on cap-store's storage layer. The confidence formula is:
```
score = statusWeight(0.35) + successRate(0.25) + recency(0.15) + replayBonus(0.15) + driftPenalty(-0.20) + patternHits(0.10)
```

---

## What Needs Harvest — Tier 2: Wire Into Existing Engines (~150 LOC, ~1 hour)

The schema is ready — just add code to fill existing stub methods:

| # | What | Wire Into | Impact |
|---|------|-----------|--------|
| 10 | Wire confidence → `CapabilityBinding.confidence` | `provider-discovery.ts` | Updates existing DB field |
| 11 | Wire status ladder → `BindingStatusLog` | `capability.ts` | Uses existing model |
| 12 | Wire stream completion → `StreamParserEngine` | `stream-parser.ts` `detectCompletion()` | Adds provider-specific early-resolve |
| 13 | Wire per-provider delta extractors | `parsers/` seed files | Reuses existing seed loader |
| 14 | Wire URL matcher → manifest inference | `manifest-inference.ts` | Reuses existing config |
| 15 | Wire error→HTTP → server response | `src/server/response.ts` | Already has `err()` helper |

---

## What Needs Harvest — Tier 3: Adapt Patterns (~2,036 LOC, ~4 hours)

These need architectural alignment to vivim-final's patterns:

| # | What | Source | Adaptation Required |
|---|------|--------|---------------------|
| 16 | Recipe JSON format | cap-lab `executor.ts` (624 LOC) | Adapt locate→act→observe to vivim's recipe format |
| 17 | Turn executor | cap-store `turn-executor.ts` (171 LOC) | Wire through ChromeGovernor's CDP session |
| 18 | Trusted input dispatch | cap-lab `input.ts` (138 LOC) | Add `Input.insertText` + `Input.dispatchKeyEvent` to CDP |
| 19 | Health check loop | cap-store `probe.ts + loop.ts` (~200 LOC) | Optional engine, config-gated |
| 20 | Drift detection loop | cap-store `loop.ts` (~50 LOC) | Wraps Tier 1 drift monitor |
| 21 | Failure classifier | cap-lab `classifier.ts` (296 LOC) | Use `SelectorHealthHistory` + `BindingEvent` tables |
| 22 | Selector portfolio generator | cap-lab `portfolio.ts` (456 LOC) | Use `SelectorStrategy` model |
| 23 | Parallel healer | cap-lab `healer.ts` (250 LOC) | Wire into existing `SelectorHealer` |

**Critical adaptation:** Cap-lab stores healing data in file-based JSON (`data/healing/patterns.json`). Vivim-final uses Prisma tables (`SelectorHealthHistory`, `SelectorStrategy`, `BindingEvent`). Algorithms are portable, storage layer must be swapped.

---

## What Needs Harvest — Tier 4: Production Hardening (~134 LOC, ~30 min)

| # | What | Source | LOC |
|---|------|--------|-----|
| 24 | Pre-migration backup | cap-store `backup.ts` | 36 |
| 25 | Crash report handler | cap-store `crash-report.ts` | 39 |
| 26 | Port lock file | cap-store `port-lock.ts` | 22 |
| 27 | Graceful shutdown with checkpoint | cap-store `graceful-shutdown.ts` | 24 |
| 28 | Production error scrubbing | cap-store `errors.ts` | 5 |

---

## Provider-Specific Intelligence

### Transport Matrix

| Provider | Transport | SSE Format | Completion Signal | Composer Type | CDP Methods |
|----------|-----------|------------|-------------------|---------------|-------------|
| Claude | SSE | Anthropic | `message_stop` | ProseMirror contenteditable | 18 |
| ChatGPT | SSE | OpenAI | `[DONE]` | Standard textarea | 15 |
| Gemini | batchexecute | WrbFrame | JSON array markers | Quill `.ql-editor` | 15 |
| DeepSeek | SSE | OpenAI | `[DONE]` | Standard textarea | 10 |
| Qwen | SSE | OpenAI | `[DONE]` | Standard textarea | 10-15 |
| Z-AI | SSE | OpenAI | `[DONE]` | Standard textarea | 10-15 |
| Studio-AI | SSE | OpenAI | `[DONE]` | Standard textarea | 10-15 |

### Gemini-Specific: Backend Protocol Specs

The Rust backend has full Gemini protocol specs that need porting:
- **RPC IDs:** `BardSettings`, `RateLimit`, `UserStatus`, `ConversationList`, `SendMessage`, `ModelSwitchAck`, `DeleteConversation1`, `DeepResearchCaps`, `QuotaPlan`
- **Model registry:** `mode_id → model_num → api_name` mapping
- **Recipes:** Full interaction patterns

---

## New Schema Models Required (2 tables)

Before ingestion can work, add these Prisma models:

### `CdpMethodRegistry`
```prisma
model CdpMethodRegistry {
  id              String  @id
  providerId      String? @map("provider_id")
  method          String
  domain          String
  paramsJson      String  @default("[]") @map("params_json")
  usedForJson     String  @default("[]") @map("used_for_json")
  sourceCodebase  String
  sourceFile      String? @map("source_file")
  chromeVersion   String? @map("chrome_version")
  isActive        Int     @default(1) @map("is_active")
  createdAt       Int     @map("created_at")
  updatedAt       Int     @map("updated_at")
  @@unique([providerId, method, chromeVersion])
  @@map("cdp_method_registry")
}
```

### `ProviderStreamConfig`
```prisma
model ProviderStreamConfig {
  id                    String  @id
  providerId            String  @map("provider_id")
  streamTransport       String
  streamTerminalJson    String  @default("[]") @map("stream_terminal_json")
  sseFormat             String? @map("sse_format")
  deltaPathJson         String? @map("delta_path_json")
  completionDetectorsJson String @default("[]") @map("completion_detectors_json")
  version               Int     @default(1)
  supersededById        String? @map("superseded_by")
  createdAt             Int     @map("created_at")
  @@unique([providerId, streamTransport, version])
  @@map("provider_stream_config")
}
```

---

## What NOT to Harvest (Breaks Design)

| Original Pattern | Why It Breaks |
|-----------------|---------------|
| bun:sqlite | Vivim-final uses Prisma + PostgreSQL |
| File-based JSON/JSONL | Prisma is single source of truth |
| Batch v02 routing | Fragile dynamic imports |
| Per-provider Fleet Supervisor | ChromeGovernor is different abstraction |
| In-memory session maps | Use Prisma (`discovery_session` table) |
| setInterval polling | Use CDP `Page.frameNavigated` event |
| `Arc<RwLock<HashMap>>` | Prisma handles concurrency |

---

## Extraction Pipeline

The pipeline design is already documented in `docs/audits/extraction-plan.md`:

```
1. Extract scripts (Bun) → scan original codebases
2. Manifest format (Zod-validated JSON)
3. Ingestion pipeline → Prisma upsert (idempotent)
4. Assessment queries → coverage comparison
```

**Execution order:**
1. Create extraction scripts
2. Create manifest format schema
3. Run extraction → `data/extracted/*.json`
4. Create ingestion script
5. Run ingestion → Prisma DB
6. Create assessment script
7. Run assessment → coverage report
8. Review → identify gaps → iterate

---

## Summary Statistics

| Category | Items | LOC | Effort | Tier |
|----------|-------|-----|--------|------|
| Already done (skip) | 10 | ~3,500+ | 0 | Tier 0 |
| Pure functions | 9 | ~820 | ~2 hours | Tier 1 |
| Schema-aligned hooks | 6 | ~150 | ~1 hour | Tier 2 |
| Adapt patterns | 8 | ~2,036 | ~4 hours | Tier 3 |
| Production hardening | 5 | ~134 | ~30 min | Tier 4 |
| **Total** | **38** | **~6,640** | **~7.5 hours** | |

**Design invariant preserved:** All harvested code is additive. No existing engine, store contract, or Prisma model is modified.

---

## Recommended Migration Order

1. **Phase 1:** Tier 1 pure functions (confidence, status ladder, stream completion, drift)
2. **Phase 2:** Tier 2 wiring (hook pure functions into existing engines)
3. **Phase 3:** New Prisma models (`CdpMethodRegistry`, `ProviderStreamConfig`)
4. **Phase 4:** Extraction pipeline (scripts, manifest, ingestion)
5. **Phase 5:** Tier 3 adaptations (turn executor, trusted input, healing system)
6. **Phase 6:** Tier 4 production hardening
