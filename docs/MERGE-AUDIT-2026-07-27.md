# Merge Audit Report — vvv → vivim-final
**Date:** 2026-07-27
**Source:** vvv (https://github.com/owenservera/vvv)
**Target:** vivim-final

---

## Executive Summary

| Dimension | vvv | vivim-final | Delta |
|-----------|-----|-------------|-------|
| Backend .ts files | 589 | 266 | +323 |
| Frontend .ts/.tsx files | 403 | 384 | +19 |
| Prisma models | 173 | 173 | 0 |
| Backend test files | 5 | 360+ | -355 |

**vvv is a frontend-heavy restructure** with 2.25x backend files and slightly more frontend files, but **zero tests**. vivim-final retains all infrastructure.

---

## Backend Gap Analysis

### Files in vvv but NOT in vivim-final (8 gaps)

All 8 are **NLCL (Natural Language Command Layer)** enhancements:

| File | Size | Purpose | Priority |
|------|------|---------|----------|
| `engines/nlcl/composite-splitter.ts` | 6.3KB | Parses "do A then B then C" into multi-step intents | Medium |
| `engines/nlcl/confirmation-store.ts` | 9.2KB | HMAC-based confirmation tokens for destructive actions | High |
| `engines/nlcl/dialogue-session-store.ts` | 9.3KB | Multi-turn dialogue session persistence | Medium |
| `engines/nlcl/dynamic-entity-linker.ts` | 8.7KB | Runtime entity resolution from context | Medium |
| `engines/nlcl/help-resolver.ts` | 7.8KB | NL help system with MiniLM embeddings | Low |
| `engines/nlcl/nlcl-otel.ts` | 2.4KB | OpenTelemetry tracing for NLCL | Low |
| `engines/nlcl/prerouter.ts` | 5.5KB | Pre-routing pattern matching before full intent resolution | Medium |
| `engines/nlcl/workflow-synthesis-resolver.ts` | 9.9KB | LLM-driven workflow synthesis from NL intent | High |

**Dependencies:** These import from `./nl-parser.js`, `./types.js`, `./command-registry.js`, `./pattern-match.js` — all of which exist in vivim-final. The `confirmation-store.ts` uses `node:crypto` (no external deps). The `help-resolver.ts` imports `MiniLmEmbeddingProvider` from `../embedding-minilm.js` — need to verify this exists.

### Files unique to vivim-final (8 files, intentionally kept)

| File | Purpose | Keep? |
|------|---------|-------|
| `engines/format-classifier.ts` | Content format detection | ✅ Yes — original engine |
| `engines/live-capture-engine.ts` | Real-time DOM capture | ✅ Yes — original engine |
| `engines/local-agent/local-agent-executor.ts` | Local LLM agent | ✅ Yes — original engine |
| `engines/local-model-adapter.ts` | Local model integration | ✅ Yes — original engine |
| `engines/selector-refiner.ts` | CDP selector refinement | ✅ Yes — original engine |
| `shared/stream-blocks.ts` | Stream block types | ✅ Yes — original shared types |
| `storage/contracts/local-agent-store.ts` | Local agent storage contract | ✅ Yes — original contract |
| `storage/impl/local-agent-store-impl.ts` | Local agent storage impl | ✅ Yes — original impl |

**These are vivim-final's original engines that vvv intentionally removed.** They should stay.

---

## Frontend Gap Analysis

### Files in vvv but NOT in vivim-final (2 gaps)

| File | Size | Purpose | Priority |
|------|------|---------|----------|
| `components/canvas/BuilderProvider.tsx` | 8.4KB | Canvas builder context provider with mutation history | High |
| `components/chat/AgentPlanCard.tsx` | 9.9KB | Agent plan display card in chat | Medium |

**BuilderProvider.tsx** depends on:
- `@/sdk/web/use-mutation` (already ported in Phase 8)
- `../../../mini-services/backend/src/reprogrammability/mutation-schema.js` — **path reference to vvv**, needs rewiring to vivim-final's `@/reprogrammability/mutation-schema`

**AgentPlanCard.tsx** depends on:
- `@/components/canvas/UnifiedIOProvider` — need to verify exists
- `@/components/canvas/Icon` — need to verify exists
- Same mutation-schema path reference

### Files unique to vivim-final frontend (4 files, intentionally kept)

| File | Purpose | Keep? |
|------|---------|-------|
| `lib/prisma-write-guard.ts` | DB write protection | ✅ Yes |
| `shared/api-config.ts` | API configuration | ✅ Yes |
| `shared/canvas-manifest.ts` | Canvas manifest | ✅ Yes |
| `shared/stream-blocks.ts` | Stream block types | ✅ Yes |

---

## Prisma Schema

**Both schemas have exactly 173 models.** The 10 new models were successfully ported in Phase 6. No gaps.

---

## Seeds & Config

### vvv has additional seeds not in vivim-final:

| Seed | Purpose | Port? |
|------|---------|-------|
| `adapters/*.adapter.ts` | Provider adapter definitions (7 files) | ❌ No — vivim-final uses different adapter pattern |
| `automation/automation.seed.ts` | Automation seed data | ⚠️ Maybe |
| `chrome/canonical-chrome.json` | Chrome CDP selectors | ⚠️ Maybe — vivim-final has `src/engine/provider-selectors.ts` |
| `command-descriptions/seed.ts` | NL command descriptions | ⚠️ Maybe — vivim-final has `seeds/command-descriptions/` |
| `conceptual-model/seed.ts` | Conceptual model seed | ⚠️ Maybe |
| `harness/*.module.ts` | Harness modules (7 files) | ❌ No — vivim-final has `seeds/harness/` |
| `intent-templates/catalog.json` | Intent template catalog | ⚠️ Maybe |
| `parsers/harvested/*.ts` | Parser definitions (6 files) | ❌ No — vivim-final has `seeds/parsers/harvested/` |
| `providers/*.json` | Provider manifests (3 files) | ❌ No — vivim-final has `seeds/providers/` |
| `taxonomy/*.json` | Taxonomy data (5 files) | ⚠️ Maybe |
| `taxonomy/*.ts` | Taxonomy seed scripts | ⚠️ Maybe |

### vvv has worklog.md (233KB)
Full development history — **do not port** (historical artifact).

---

## Completion Status ✅ (2026-07-27)

### All HIGH-Priority Items Ported

| Item | Status | Notes |
|------|--------|-------|
| 8 NLCL files | ✅ Done | composite-splitter, confirmation-store, dialogue-session-store, dynamic-entity-linker, help-resolver, nlcl-otel, prerouter, workflow-synthesis-resolver |
| BuilderProvider.tsx | ✅ Done | Ported with fixed `@/reprogrammability/mutation-schema` imports |
| AgentPlanCard.tsx | ✅ Done | Ported with fixed import paths |
| api-types.ts types | ✅ Done | AsyncCapabilityResult, isAsyncCapabilityResult, GenerativeTaskStatusResponse |
| agent-canvas.ts types | ✅ Done | AgentCanvasOpStatus, AgentCanvasOpAction, AgentCanvasNodeSpec, AgentCanvasPlanStatus + snapshot types |
| canvas-engine.ts DI | ✅ Done | imageGen dependency injection (G.1 audit fix) |
| interpret-router.ts | ✅ Done | wrapCommandResultAsInterpretResponse() (A.2 audit fix) |
| agent-canvas-router.ts | ✅ Done | EventBus emission + NLCL plan interpretation |
| pattern-match.ts fix | ✅ Done | capabilityId propagation in HelpResolver (golden test root cause fix) |

### MEDIUM Priority (evaluated, skip)

| Item | Decision | Reason |
|------|----------|--------|
| `automation/automation.seed.ts` | ❌ Skip | vivim-final has its own automation infrastructure |
| `command-descriptions/seed.ts` | ❌ Skip | vivim-final has own NLCL command registry |
| `conceptual-model/seed.ts` | ❌ Skip | vivim-final has own conceptual model |
| `intent-templates/catalog.json` | ❌ Skip | NLCL patterns already in catalog.ts |

### LOW Priority (skip — confirmed)

| Item | Reason |
|------|--------|
| vvv adapter seeds | Different adapter pattern |
| vvv harness modules | vivim-final has its own |
| vvv parser seeds | vivim-final has its own |
| vvv provider manifests | vivim-final has its own |
| worklog.md | Historical artifact |

### Remaining Gap Audit Status

| Category | Original | Remaining | Action |
|----------|----------|-----------|--------|
| vvv enhancements | 9 | 4 | All 4 skipped intentionally (stubs/formatting) |
| vvv regressions | 3 | 3 | All expected (vvv stripped infrastructure) |
| vvv-only .ts files | 2 | 2 | Test files for vvv-specific features — skip |
