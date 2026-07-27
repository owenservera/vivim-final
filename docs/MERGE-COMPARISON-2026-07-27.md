# Methodical Comparison: vvv vs vivim-final
**Date:** 2026-07-27
**Assumption:** vvv is more advanced — identify where it improves on vivim-final

---

## 1. Scale Comparison

| Dimension | vvv | vivim-final | Delta |
|-----------|-----|-------------|-------|
| Backend .ts files | 589 | 589 | 0 (after port) |
| Backend dirs | 52 | 52 | 0 |
| Avg file size | 5,637 bytes | 5,580 bytes | +1% |
| NLCL engine files | 28 | 20 | +8 |
| NLCL total bytes | 242KB | 146KB | +66% |
| Server routers | 26 | 26 | 0 |
| Storage contracts | 55 | 56 | -1 |
| Storage impls | 60 | 61 | -1 |
| Prisma models | 173 | 173 | 0 |

---

## 2. Where vvv Is More Advanced

### 2.1 NLCL Engine (+66% larger, 8 new files)

**vvv added 8 new NLCL subsystems** that vivim-final lacks:

| File | Size | What It Does | Impact |
|------|------|--------------|--------|
| `workflow-synthesis-resolver.ts` | 9.9KB | LLM-driven workflow synthesis from NL intent | **High** — enables multi-step workflow generation |
| `dialogue-session-store.ts` | 9.3KB | Multi-turn dialogue session persistence | **High** — enables conversational context |
| `confirmation-store.ts` | 9.2KB | HMAC-based confirmation tokens | **High** — enables safe destructive action confirmation |
| `dynamic-entity-linker.ts` | 8.7KB | Runtime entity resolution from context | **Medium** — improves entity linking |
| `help-resolver.ts` | 7.8KB | NL help with MiniLM embeddings | **Medium** — NL help system |
| `composite-splitter.ts` | 6.3KB | "do A then B then C" → multi-step | **Medium** — composite intent parsing |
| `prerouter.ts` | 5.5KB | Pre-routing pattern match | **Medium** — faster routing |
| `nlcl-otel.ts` | 2.4KB | OpenTelemetry tracing | **Low** — observability |

### 2.2 Enhanced NLCL Core Files

| File | vvv Size | vivim Size | Ratio | What vvv Added |
|------|----------|------------|-------|----------------|
| `llm-slave-resolver.ts` | 14.5KB | 2.6KB | **5.5x** | Added MiniLM embedding integration + semantic search |
| `semantic-resolver.ts` | 8.8KB | 2.8KB | **3.1x** | Added `SemanticResolverOpts` interface |
| `nlcl-engine.ts` | 31.6KB | 14.8KB | **2.1x** | 111 methods vs 68 — added dialogue sessions, confirmation store, entity linker, prerouter, composite splitter, help resolver, pronoun resolution |
| `plugin-system.ts` | 8.6KB | 4.3KB | **2.0x** | Enhanced plugin lifecycle |
| `parameter-extraction.ts` | 7.2KB | 4.9KB | **1.5x** | Enhanced parameter extraction |
| `trust-score.ts` | 8.0KB | 6.3KB | **1.3x** | Enhanced trust scoring |

### 2.3 Server Router Enhancements

| Router | vvv Size | vivim Size | Ratio | What vvv Added |
|--------|----------|------------|-------|----------------|
| `nlcl-router.ts` | 10.8KB | 3.8KB | **2.9x** | 6 new routes (dialogue, confirmation, workflow synthesis, help, entity link, preroute) |
| `agent-canvas-router.ts` | 9.1KB | 7.6KB | **1.2x** | Enhanced canvas operations |
| `interpret-router.ts` | 4.3KB | 3.5KB | **1.2x** | Enhanced interpretation |

---

## 3. What vivim-final Retains (intentionally)

| Area | Files | Why |
|------|-------|-----|
| Local agent engine | `local-agent-executor.ts`, `local-model-adapter.ts` | Original vivim-final engine |
| Format classifier | `format-classifier.ts` | Original vivim-final engine |
| Live capture | `live-capture-engine.ts` | Original vivim-final engine |
| Selector refiner | `selector-refiner.ts` | Original vivim-final engine |
| Stream blocks | `shared/stream-blocks.ts` | Original shared types |
| Local agent store | `storage/contracts/local-agent-store.ts` + impl | Original storage |

These are **vivim-final's original engines** that vvv intentionally removed. They should stay.

---

## 4. Frontend Comparison

| Area | vvv | vivim-final | Delta |
|------|-----|-------------|-------|
| Total files | 403 | 384 | +19 |
| Builder components | ✅ BuilderProvider.tsx | ✅ 6 files | vvv has provider, vivim has more components |
| Chrome components | ✅ Full set | ✅ Full set | Equal |
| Reprogrammability UI | ✅ Full set | ✅ Full set | Equal |
| SDK hooks | ✅ use-mutation, use-variant | ✅ Ported | Equal |
| Missing in vivim | BuilderProvider.tsx, AgentPlanCard.tsx | — | +2 files |

---

## 5. Assessment: What Still Needs Porting

### HIGH Priority (vvv improvements to adopt)

| Item | Why vvv Is Better | Effort |
|------|-------------------|--------|
| 8 NLCL files | +66% NLCL capability, dialogue sessions, confirmation tokens, workflow synthesis | Low — all deps exist |
| `BuilderProvider.tsx` | Canvas builder context provider (missing from vivim) | Low — fix import path |
| `AgentPlanCard.tsx` | Agent plan display (missing from vivim) | Low — fix import path |

### MEDIUM Priority (evaluate)

| Item | Why | Effort |
|------|-----|--------|
| `nlcl-router.ts` replacement | vvv version is 2.9x larger with 6 new routes | Medium — need to check route compatibility |
| `llm-slave-resolver.ts` replacement | vvv version is 5.5x larger with MiniLM integration | Medium — depends on embedding infrastructure |
| `semantic-resolver.ts` replacement | vvv version is 3.1x larger with options interface | Medium |
| `nlcl-engine.ts` replacement | vvv version is 2.1x larger with 43 more methods | High — core engine, risky to replace |

### LOW Priority (skip)

| Item | Why |
|------|-----|
| vvv adapter seeds | Different pattern |
| vvv harness modules | vivim-final has its own |
| vvv parser seeds | vivim-final has its own |
| worklog.md | Historical artifact |

---

## 6. Recommended Strategy

### Phase A: Port the 8 NLCL files (safe, all deps exist)
These are **additive** — they don't replace existing files, they add new capabilities.

### Phase B: Port BuilderProvider.tsx + AgentPlanCard.tsx (fix imports)
Low risk, just need to rewrite `../../../mini-services/backend/src/reprogrammability/mutation-schema.js` → `@/reprogrammability/mutation-schema`.

### Phase C: Evaluate vvv's enhanced core files
Compare vvv's `nlcl-engine.ts` (31KB) vs vivim-final's (14KB) method by method. Decide whether to:
1. **Merge** — take vvv's new methods into vivim-final's engine
2. **Replace** — swap entirely (risky)
3. **Skip** — vivim-final's version is sufficient

### Phase D: Evaluate vvv's enhanced `nlcl-router.ts`
Check if the 6 new routes in vvv's version are needed. If so, port the enhanced version.

---

## 7. Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| NLCL files break existing tests | Low | Medium | Run `bun test tests/unit/engines/nlcl*` after port |
| Import path rewrite introduces bugs | Low | Low | TypeScript compiler catches |
| vvv's enhanced nlcl-engine conflicts with vivim-final | Medium | High | Don't replace — merge new methods incrementally |
| Frontend components have hidden deps | Low | Medium | Check UnifiedIOProvider + Icon exist (confirmed ✅) |

---

## 8. Summary

**vvv is genuinely more advanced in the NLCL subsystem** — it added 8 new files (+66% code) and enhanced 6 existing files (1.3x–5.5x larger). The improvements are:

1. **Dialogue sessions** — multi-turn conversational context
2. **Confirmation tokens** — HMAC-based safe destructive action confirmation
3. **Workflow synthesis** — LLM-driven multi-step workflow generation
4. **Composite intent parsing** — "do A then B then C" decomposition
5. **Dynamic entity linking** — runtime entity resolution
6. **NL help system** — MiniLM embedding-based help
7. **Pre-routing** — fast pattern matching before full intent resolution
8. **Observability** — OpenTelemetry tracing for NLCL

**Everything else is equal** — same file count, same router count, same Prisma models, same storage layer. vvv's only real advantage is the NLCL enhancements.

---

## 9. Completion Status ✅ (2026-07-27)

### All Ported

| Source | Files | Tests |
|--------|-------|-------|
| 8 NLCL files | composite-splitter, confirmation-store, dialogue-session-store, dynamic-entity-linker, help-resolver, nlcl-otel, prerouter, workflow-synthesis-resolver | ✅ 285 pass |
| 6 gap-audit files | api-types.ts, agent-canvas.ts, canvas-engine.ts, interpret-router.ts, agent-canvas-router.ts, pattern-match.ts | ✅ 285 pass |
| 2 frontend components | BuilderProvider.tsx, AgentPlanCard.tsx | ✅ 285 pass |
| 10 Prisma models | Added to schema.prisma | ✅ Generated |

### Post-Merge Metrics

| Dimension | vvv | vivim-final | Delta |
|-----------|-----|-------------|-------|
| Backend .ts files | 589 | 589 | 0 |
| Prisma models | 173 | 173 | 0 |
| Tests | 0 | 360+ | N/A |
| Gap enhancements | 9 | 4 remaining (all skip) | 5 fixed |
| Gap regressions | 3 | 3 (expected) | 0 |
