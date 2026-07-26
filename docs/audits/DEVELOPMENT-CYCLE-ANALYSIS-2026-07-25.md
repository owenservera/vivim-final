# Development Cycle Analysis — 2026-07-25

## Executive Summary

**Phase:** Late-stage development (Phase 13-14 of 14)
**Health:** 102/132 units done (77%), 0 blocked, 30 pending
**Critical:** 2 invariant violations fixed today (B7, B8)
**Next:** v3 release (unit 13.8)

---

## Tracker Status

| Phase | Name | Done | Total | Status |
|-------|------|------|-------|--------|
| 1 | Stabilization & Cleanup | 12 | 12 | ✅ COMPLETE |
| 2 | Kernel Foundation | 9 | 9 | ✅ COMPLETE |
| 3 | Agentic Core | 15 | 15 | ✅ COMPLETE |
| 4 | HTML Canvas System | 13 | 13 | ✅ COMPLETE |
| 5 | Workspace & Agent UI | 11 | 11 | ✅ COMPLETE |
| 6 | Provider & Capability Expansion | 10 | 10 | ✅ COMPLETE |
| 7 | Memory & Knowledge Graph | 10 | 10 | ✅ COMPLETE |
| 8 | Autonomous Orchestration | 1 | 12 | ⚠️ 11 remaining |
| 9 | Observability & Audit | 2 | 8 | ⚠️ 6 remaining |
| 10 | Sovereign Data & Local-First | 3 | 9 | ⚠️ 6 remaining |
| 11 | Kernel Oracle | 4 | 4 | ✅ COMPLETE |
| 12 | Kernel Surfaces | 3 | 6 | ⚠️ 3 remaining |
| 13 | Polish, SDK & Documentation | 4 | 8 | ⚠️ 4 remaining |
| 14 | LLM-as-Human Testing | 6 | 6 | ✅ COMPLETE |
| **Total** | | **102** | **132** | **77%** |

---

## What's DONE (Phases 1-7, 11, 14)

### Core Architecture ✅
- All 13 engines implemented
- Kernel foundation (registry, context, tracer, provenance, bootstrap)
- CapabilityEventBus with error isolation, envelopes, wildcards, DLQ
- UnifiedCapabilityRegistry with CLI/API/MCP/UI surfaces
- NLCL engine with intent resolution, pattern matching, fuzzy matching
- Store Contracts (56 contracts in `src/storage/contracts/`)

### Provider System ✅
- ProviderRegistrar with seed knowledge graph
- ProviderHealthKernel with weighted health scores
- Provider selectors (Gemini, ChatGPT, Claude)
- Parser system (DB-only, inline logic_code, fallback chains)
- 6 providers seeded: chatgpt, claude, gemini, deepseek, qwen, grok

### Canvas & UI ✅
- HTML Canvas System (13/13 units)
- Workspace & Agent UI (11/11 units)
- Hot-swappable slot system (13 slots)
- UIComponentRegistry with runtime hot-swap
- ActionRegistry with Zod validation
- Canvas surface with React-Flow nodes

### Memory & Knowledge ✅
- MemoryEngine with FSRS-6
- SemanticSearchEngine
- KnowledgeIngestion with continuous indexing
- Cross-conversation synthesis
- Memory visualization API

### Testing ✅
- LLM-as-Human Testing (6/6 units)
- Cross-surface parity verifier
- 165+ unit tests in `tests/unit/engines/`
- Provider stream validation tests

---

## What's MISSING (Critical Gaps)

### 1. Autonomous Orchestration (Phase 8) — 11 units pending

| Unit | Name | Status | Impact |
|------|------|--------|--------|
| 8.1 | LLM-backed planner | ❌ pending | Core agentic capability |
| 8.3 | HITL v2 proactive clarification | ❌ pending | User experience |
| 8.4 | HITL v2 pause/resume | ❌ pending | User experience |
| 8.5 | Replay with branching | ❌ pending | Debugging capability |
| 8.8 | Provider failover mid-task | ❌ pending | Reliability |

**Gap:** The autonomous loop exists (`agentic-loop.ts`) but lacks LLM planning, HITL controls, and failover.

### 2. Observability & Audit (Phase 9) — 6 units pending

| Unit | Name | Status | Impact |
|------|------|--------|--------|
| 9.2 | Provenance visualization surface | ⚠️ partial | No frontend component |
| 9.8 | System health daily digest | ❌ pending | Operations |

**Gap:** Backend provenance exists but no UI. No automated health digest.

### 3. Sovereign Data (Phase 10) — 6 units pending

| Unit | Name | Status | Impact |
|------|------|--------|--------|
| 10.2 | Database-level encryption | ❌ pending | Security |
| 10.5 | Offline-capable autonomous | ❌ pending | Local-first |
| 10.7 | Backup scheduling | ❌ pending | Data safety |
| 10.8 | Device pairing UX | ❌ pending | Multi-device |

**Gap:** Encryption-at-rest exists but no DB-level encryption. No backup system.

### 4. Kernel Surfaces (Phase 12) — 3 units pending

| Unit | Name | Status | Impact |
|------|------|--------|--------|
| 12.2 | Kernel MCP Tools | ⚠️ partial | Partial coverage |
| 12.4 | Kernel Frontend Surface | ⚠️ partial | No OracleDashboard UI |
| 12.5 | MCP Server Integration | ⚠️ partial | Partial |

**Gap:** Kernel tools exist but frontend dashboard missing.

### 5. Polish & Release (Phase 13) — 4 units pending

| Unit | Name | Status | Impact |
|------|------|--------|--------|
| 13.5 | ADR sweep | ⚠️ partial | 13 ADRs exist |
| 13.6 | API documentation (OpenAPI) | ❌ pending | Developer experience |
| 13.7 | User manual | ❌ pending | User experience |
| 13.8 | v3 release | ❌ pending | **BLOCKED by above** |

**Gap:** No OpenAPI docs, no user manual. Release blocked.

---

## Invariant Status

### Hard Blocks (B1-B8) — ALL PASSING ✅

| ID | Check | Status |
|----|-------|--------|
| B1 | Governor Canon | ✅ Only ChromeGovernor touches CDP |
| B2 | Store Contract Isolation | ✅ No engine imports impl |
| B3 | Seeds Not Code | ✅ No hardcoded provider config |
| B5 | Config Authority | ✅ No direct env/config reads |
| B6 | Server-Side Harness | ✅ No script injection |
| B7 | Error Classes | ✅ Fixed: provider-discovery.ts now uses EngineError |
| B8 | Agent-Addressable UI | ✅ Fixed: path corrected to frontend/src/actions/registry.ts |

### Quality Warnings (D1-D4) — 80+ warnings

| ID | Check | Count | Priority |
|----|-------|-------|----------|
| D1 | Missing engine tests | 11 | Medium |
| D2 | `any` type usage | 30+ | Low |
| D4 | Missing barrel exports | 50+ | Low |

---

## Provider Status

| Provider | Seeded | Registered | Parser | Capability | Profile |
|----------|--------|------------|--------|------------|---------|
| claude | ✅ | ✅ | ✅ inline | send_message, select_model | ✅ |
| gemini | ✅ | ✅ | ✅ inline | send_message, select_model | ✅ |
| chatgpt | ✅ | ✅ | ✅ inline | send_message | ✅ |
| deepseek | ✅ | ❌ | ❌ none | send_message | ⚠️ |
| qwen | ✅ | ❌ | ❌ none | send_message | ⚠️ |
| grok | ✅ | ❌ | ❌ none | send_message | ⚠️ |

**Gap:** 3 providers (deepseek, qwen, grok) have no parser rows and are not fully registered.

---

## Frontend Status

### Completed ✅
- Hot-swappable slot system (13 slots)
- UIComponentRegistry with runtime hot-swap
- ActionRegistry with Zod validation
- Canvas surface with React-Flow nodes
- Chat surface (Composer, MessageBlock, ConversationList)
- Capability catalog (searchable grid)
- Dev console (WS event firehose)
- Health dashboard
- Provider manager
- Workspace settings
- Onboarding wizard
- Command palette

### Missing ❌
- Virtual scrolling for large lists
- Theme system (light/dark/auto)
- Responsive layout (mobile breakpoints)
- Accessibility (aria labels, focus trapping)
- Loading skeletons
- Error recovery (retry buttons)
- Undo/redo for destructive actions

---

## Recommended Next Steps

### Immediate (This Session)
1. ✅ Fix B7 invariant (provider-discovery.ts) — DONE
2. ✅ Fix B8 invariant (path correction) — DONE
3. ✅ Fix vivim-runtime stale references — DONE

### Short Term (Next 1-2 Sessions)
4. **Complete Phase 8** — Autonomous Orchestration (11 units)
   - LLM-backed planner (8.1) — highest impact
   - HITL v2 controls (8.3, 8.4) — user experience
   - Provider failover (8.8) — reliability

5. **Complete Phase 9** — Observability (6 units)
   - Provenance UI (9.2) — visualization
   - Health digest (9.8) — operations

### Medium Term (Next 3-5 Sessions)
6. **Complete Phase 10** — Sovereign Data (6 units)
   - DB encryption (10.2) — security
   - Backup scheduling (10.7) — data safety

7. **Complete Phase 12** — Kernel Surfaces (3 units)
   - Kernel frontend (12.4) — OracleDashboard

### Long Term (Release Preparation)
8. **Complete Phase 13** — Polish & Release (4 units)
   - API documentation (13.6) — OpenAPI
   - User manual (13.7)
   - v3 release (13.8)

9. **Register remaining providers** — deepseek, qwen, grok need parsers

10. **Quality debt** — Address D1 (missing tests) and D2 (`any` types)

---

## Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|------------|
| Autonomous orchestration incomplete | HIGH | Phase 8 is core agentic capability |
| No DB encryption | MEDIUM | Phase 10.2 |
| No backup system | MEDIUM | Phase 10.7 |
| 3 providers unregistered | LOW | Can be done post-release |
| 80+ quality warnings | LOW | Non-blocking, address incrementally |

---

## Conclusion

**The project is 77% complete with all core architecture done.** The remaining work is:
- **Autonomous orchestration** (Phase 8) — the biggest gap
- **Observability UI** (Phase 9, 12) — frontend visualization
- **Sovereign data** (Phase 10) — security and backup
- **Polish & release** (Phase 13) — documentation and release

**All invariant violations are now fixed.** The codebase is architecturally sound.
