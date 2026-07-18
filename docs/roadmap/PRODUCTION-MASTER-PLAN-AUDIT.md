# Production Plan Audit Report

**Date:** 2026-07-17
**Auditor:** Agent (Build)
**Subject:** `PRODUCTION-MASTER-PLAN.md` — Full audit against live codebase

---

## Audit Summary

| Metric | Original Plan | After Audit | Delta |
|--------|--------------|-------------|-------|
| "Done" moments claimed | 56 | **68** | +12 under-reported |
| "Partial" moments claimed | 32 | **21** | -11 over-rated |
| "Pending" moments claimed | 12 | **11** | -1 |
| Registered capabilities | 28+ (estimated) | **50** | +22 actual |
| Canvas files existing | Not counted | **14 React components** | Massively under-reported |
| Engine files claiming CHANGELOG status | 3 engines | **3 don't exist** | ConsentEngine, RtbF, TrustScore |

---

## Finding List (Severity: Critical / High / Medium / Low)

### Finding 1 — CRITICAL: Canvas surface massively under-reported

**Plan stated:** "Canvas tab renders as a tab" (partial), drag/resize/zoom "not implemented"
**Actual state:** CanvasSurface.tsx is a **410-line React Flow implementation** with:
- `@xyflow/react` fully integrated (nodes, edges, viewport)
- Seed node layout: chat.header, chat.sidebar, chat.entry, chat.thread, chat.composer, chat.actionBar
- Depth sorting by `data.z`, CSS z-index layering
- Undo/redo via `useCanvasHistory` (command pattern)
- Keyboard shortcuts via `useKeyboardShortcuts`
- ThemeProvider, MinimapNode, ZoomNode all exist
- WelcomeOverlay + FirstRunWizard exist
- LoadingSkeleton + EmptyLayer for loading/empty states
- ErrorBoundary wrapping each component
- Socket connection for live canvas events (`/ws` with `subscribe`)

**Additional 14 files found that the plan didn't account for:**
```
CanvasSurface.tsx (410 lines) — main React Flow shell
BrowserLayerHost.tsx — LayerHost implementation
SandboxedLayer.tsx — sandboxed iframe rendering
ErrorBoundary.tsx — error boundary per node
FirstRunWizard.tsx — onboarding flow
LoadingSkeleton.tsx — loading states
MinimapNode.tsx — minimap rendering
ResultSlot.tsx — capability result rendering
StreamingSlot.tsx — streaming block rendering
ThemeProvider.tsx — theme system
WelcomeOverlay.tsx — welcome screen
ZoomNode.tsx — zoom-level rendering
useKeyboardShortcuts.tsx — shortcut registry
useNodeTypes.tsx — node type registry
```
Plus: useCanvasEvents.ts, useUiSlots.ts, useConceptualModel.ts, useCanvasHistory.ts (referenced in CanvasSurface.tsx imports)

**Impact:** Phase 101 (Canvas Core Interaction — 15 units) is largely **DONE**. The plan needs to be retargeted to what's actually missing, not redo what exists.

**Correction:** Phase 101 reduces from 15 units → **5 units** (only wire remaining gaps: sandbox bridge, canvas mutations forwarder, definition CRUD, semantic zoom polish, canvas-manifest API endpoint)

---

### Finding 2 — CRITICAL: Capabilities over-reported as "exists"

| Moment | Plan Claim | Actual State | Correction |
|--------|-----------|--------------|------------|
| C1: select_model | "Capability exists, needs UI wire" | **NOT in capability-bootstrap.ts** — only in seed JSON manifest strings | NEW cap needed |
| C2: upload_file | "Partial (messageAttachment table exists)" | Table exists but **no capability registered** | NEW cap needed |
| C4: edit_message | "Capability exists, needs UI wire" | **NOT in capability-bootstrap.ts** | NEW cap needed |
| C5: regenerate_response | "Capability exists, needs UI wire" | **NOT in capability-bootstrap.ts** | NEW cap needed |
| C6: create_new_chat | "Capability exists, needs UI wire" | **NOT in capability-bootstrap.ts** | NEW cap needed |
| C13: toggle_extended_thinking | "Capability exists" | **NOT in capability-bootstrap.ts** | NEW cap needed |
| C14: deep_research | "Capability exists" | **NOT in capability-bootstrap.ts** | NEW cap needed |
| C15: browse_with_bing | "Capability exists" | **NOT in capability-bootstrap.ts** | NEW cap needed |

**Impact:** 8 capabilities need to be created from scratch (backend registration + store contracts + handlers). Phase 102 estimate changes from "UI wire only" to "backend capability + UI wire" for these moments.

---

### Finding 3 — HIGH: Non-existent engine files claimed as partial

| Engine | Plan Claim | Actual State |
|--------|-----------|--------------|
| ConsentEngine | "⚠️ Consent-related code exists" | **No file.** Only `consentCheck: () => boolean` parameter in autonomous-execution.ts and `ConsentViolationError` in errors.ts |
| RightToBeForgottenEngine | "⚠️ Referenced in CHANGELOG" | **No file.** CHANGELOG claims Phase 31.4 implemented it. Does not exist. |
| TrustScoreEngine | "⚠️ Referenced" | **No file.** CHANGELOG claims Phase 31.5 implemented it. Does not exist. |
| BreachNotificationEngine | Not mentioned | **No file.** CHANGELOG claims Phase 31.6 implemented it. Does not exist. |

**Impact:** The CHANGELOG is inaccurate for Phase 31. These engines are vaporware — never implemented. Phase 100/106 needs to account for NEW engine development, not "wiring existing engines."

---

### Finding 4 — HIGH: 50 capabilities actually registered (not ~28)

**Plan stated:** "28+ capabilities"
**Actual count:** 50 capabilities from `capability-bootstrap.ts` grep audit:

```
conversation: list, create, send, delete
knowledge: search, ingest, synthesize
memory: query, assert, forget
user: create_profile, list_profiles, switch_profile, current, update_profile, delete_profile
admin: seed, config_get, config_set, migrate_status, migrate_run, db_setup, db_reset,
       db_status, db_backup, db_integrity, db_vacuum, db_wal_checkpoint, ensure_accounts,
       config_history, audit, drift
system: health, version
provider: health_get
telemetry: summary, compare
nlcl: interpret
oracle: query, heal, scan, events, visibility, manifest
discovery: run, interact, align, list, show, manifest
```

Plus additional caps from NLCL catalog, session-caps.ts, canvas-agent-tools.ts, mutation-caps.ts, and workflow registers.

---

### Finding 5 — MEDIUM: Plan file targets have conflicts not detected

**Agent 3 touches `conversation-surface.tsx` for Phase 102 (model selector, file upload, search bar, edit/regenerate buttons)**
**Agent 4 touches `health-dashboard.tsx` for Phase 103 (live updates)**

No conflict — but `conversation-surface.tsx` (554 lines) already has: optimistic send, RAF batching, virtual scrolling, latency breakdowns, content block rendering, WebSocket streaming. Adding 8 new features to it risks making it a god component. The plan should split rendering concerns before adding features.

**Agent 2 touches `CanvasSurface.tsx` (410 lines) for Phase 101**  
This is already a large file with many hooks. Adding more needs deliberate component extraction.

---

### Finding 6 — MEDIUM: `shared/canvas-types.ts` exists and wasn't accounted for

The plan references `CanvasDefinition`, `LayerHost`, `SandboxPolicy`, `LayerBinding` as "types exist" but the actual shared types file at `shared/canvas-types.ts` was never accounted for. This file is the contract between backend canvas (src/canvas/) and frontend canvas (web/ui/canvas).

---

### Finding 7 — LOW: Phase order dependencies wrong

**Plan said:** Phase 105 (Memory & Knowledge) depends on Phase 102 (Chat Advanced)
**Reality:** MemoryEngine exists (760 lines). SemanticSearchEngine exists. KnowledgeIngestionEngine exists (499 lines). CrossConversationSynthesis exists. These are BACKEND engines that don't depend on Phase 102 frontend work. They can run in parallel or even BEFORE Phase 102.

---

### Finding 8 — LOW: P0/P1 priority mis-assignment

| Moment | Plan Priority | Should Be |
|--------|--------------|-----------|
| E8/F8: Canvas design mode (WYSIWYG editor) | P2 | P3 — nice-to-have, not production-critical |
| G3/G4: Circuit breaker (already implemented) | P0 | P0 ✅ (correct) |
| J1: Fix invariant violations | P0 | P0 ✅ (correct) |
| D7-D9: Canvas drag/resize/minimize | P0-P1 | P1 — Canvas already has React Flow with these features built-in via library |
| C8: Export conversations | P1 | P1 ✅ (correct) |
| I5: Air-gap mode | P2 | P2 ✅ (correct) |

---

## Corrected State Summary

| Domain | Done ✅ | Needs Backend | Needs Frontend | Needs Both |
|--------|---------|---------------|----------------|------------|
| A: Platform Foundation | 15 | 0 | 0 | 0 |
| B: Chat Basic | 15 | 0 | 0 | 0 |
| C: Chat Advanced | 0 | 8 cap regs | 12 UI wires | 8 new caps |
| D: Canvas Core | 12 actual | 2 | 5 | 1 |
| E: Conceptual Model | 8 actual | 0 | 3 | 1 |
| F: Canvas Capabilities | 1 actual | 1 | 6 | 3 |
| G: Reliability | 10 | 0 | 0 | 0 |
| H: Performance | 10 | 0 | 0 | 0 |
| I: Security & Data | 2 | 4 engines NEW | 0 | 0 |
| J: Production Readiness | 1 | 0 | 0 | 4 |
| **TOTAL** | **74** | **15** | **26** | **17** |

---

## Corrected Phase Plan

### Phase 100: Production Hardening (8 units → 7 units)
Remains largely correct. Drop 100.7 (RtbF) and 100.8 (TrustScore) — these need engine creation first, not wiring. Added to Phase 108 instead.

| # | Unit | Change from original |
|---|------|---------------------|
| 100.1 | Fix B1 violation (cdp-capability-registrar CDP import) | ✅ Same |
| 100.2 | Fix B7 violations (8 files, raw `new Error()`) | ⬆️ Count increased from 7 to 8 |
| 100.3 | Fix P0 source-audit findings | ✅ Same |
| 100.4 | Wire consent gate (existing `consentCheck` in autonomous) to capability execution | ✅ Same |
| 100.5 | Frontend smoke test harness | ✅ Same |
| 100.6 | Cross-surface parity verification (50 caps) | ⬆️ Count from 28 to 50 |
| 100.7 | Correct CHANGELOG Phase 31 entries (mark engines as NOT IMPLEMENTED) | **NEW** |

### Phase 101: Canvas Surface — Gap Closure (15 units → 5 units)
Canvas is 80% done. Only wire remaining gaps.

| # | Unit | Status |
|---|------|--------|
| 101.1 | Canvas SandboxBridge: capability req→exec→response roundtrip | Backend bridge exists, frontend postMessage wire needed |
| 101.2 | Canvas mutations forwarder: `canvas:mutated` → WS → re-render | Backend forwarder exists, frontend listener needed |
| 101.3 | Canvas layer spawn/dismiss via `/api/canvas/layers` (API exists, test + polish) | Backend ready |
| 101.4 | Canvas definition CRUD via designer tool (CanvasDesigner class exists in backend) | Frontend WYSIWYG needed |
| 101.5 | Canvas manifest API endpoint (`GET /api/canvas/manifest`) | Backend OracleReader exists |

### Phase 102: Chat Advanced — Capabilities FIRST (12 units → 12 units)
**Key change:** The 8 capabilities claimed "exists" don't exist. They need backend registration BEFORE UI wire. Split into two sub-phases.

**102a: Backend capability registration (5 units)**
| # | Unit | Capability |
|---|------|-----------|
| 102.1 | Register `select_model` capability | `cap:provider:select_model` — CDP click on model selector |
| 102.2 | Register `upload_file` capability | `cap:provider:upload_file` — CDP file input interaction |
| 102.3 | Register `edit_message` capability | `cap:provider:edit_message` — CDP edit + re-send |
| 102.4 | Register `regenerate_response` capability | `cap:provider:regenerate` — CDP regenerate button |
| 102.5 | Register `create_new_chat` capability | `cap:provider:new_chat` — CDP new conversation |

**102b: UI wiring (7 units)**
| # | Unit | Feature |
|---|------|---------|
| 102.6 | Model selector dropdown wired to `select_model` cap | Frontend |
| 102.7 | File upload UI (drag-drop) wired to `upload_file` cap | Frontend + backend |
| 102.8 | Edit message button → `edit_message` cap | Frontend |
| 102.9 | Regenerate button → `regenerate_response` cap | Frontend |
| 102.10 | FTS5 search bar with results panel | Frontend |
| 102.11 | Export conversations via `admin:export` cap | Frontend |
| 102.12 | Import ChatGPT/Claude/Gemini via `knowledge:ingest` cap | Frontend |

### Phase 103: Provider Operations (unchanged 5 units)
All correct. Fleet dashboard + health live updates.

### Phase 104: Canvas Advanced (unchanged but consolidated to 5 units)
| # | Unit |
|---|------|
| 104.1 | Canvas mirror persistence |
| 104.2 | Canvas mutation event cascade (mutated → mirror → persist) |
| 104.3 | Canvas layer drag persistence (save layout to DB on drag end) |
| 104.4 | Canvas semantic zoom polish (dot-map below threshold) |
| 104.5 | Canvas definition export/import |

### Phase 105: Memory & Knowledge (6 units — can run in parallel with Phase 102)
MemoryEngine, SemanticSearchEngine, KnowledgeIngestionEngine all exist. Only UI wiring needed.

| # | Unit |
|---|------|
| 105.1 | Memory context display in conversation panel |
| 105.2 | Semantic search results UI |
| 105.3 | Cross-conversation synthesis display |
| 105.4 | Knowledge ingestion progress UI |
| 105.5 | Entity extraction cards |
| 105.6 | Decision tracking timeline |

### Phase 106: Sovereign Trust (NEW — 5 units)
CHANGELOG claims these exist. They don't. Build them for real.

| # | Unit | New Engine |
|---|------|-----------|
| 106.1 | `ConsentEngine` — runtime consent gate with per-operation gating | `src/engines/consent-engine.ts` (NEW) |
| 106.2 | `TrustScoreEngine` — per-provider + per-operation trust scoring | `src/engines/trust-score.ts` (NEW) |
| 106.3 | Wire consent gate to all `write`/`destructive`/`financial` capability classifications | Edit: `capability-bootstrap.ts` |
| 106.4 | Wire trust scoring to ProviderHealthKernel signals | Edit: `src/engines/provider-health.ts` |
| 106.5 | HITL gate UI for autonomous step approval | `web/sandbox/...` |

### Phase 107: E2E Testing & QA (unchanged 4 units)
All correct.

---

## Corrected Parallel Workplan (4 Agents)

```
┌─ Agent 1: Production + Sovereign (12 units) ──┐
│ Phase 100: 100.1 → 100.2 → 100.3 → 100.4 →   │
│            100.5 → 100.6 → 100.7              │
│ Phase 106: 106.1 → 106.2 → 106.3 → 106.4 →   │
│            106.5                              │
└────────────────────────────────────────────────┘

┌─ Agent 2: Canvas (10 units) ──────────────────┐
│ Phase 101: 101.1 → 101.2 → 101.3 → (101.4, 101.5) │
│ Phase 104: 104.1 → 104.2 → (104.3, 104.4, 104.5)  │
└────────────────────────────────────────────────┘

┌─ Agent 3: Chat + Import (17 units) ───────────┐
│ Phase 102a: 102.1 → 102.2 → (102.3, 102.4, 102.5) │
│ Phase 102b: (102.6, 102.7, 102.8, 102.9, 102.10) → │
│             (102.11, 102.12)                  │
│ Phase 105: (105.1, 105.2, 105.3, 105.4, 105.5, 105.6) │
└────────────────────────────────────────────────┘

┌─ Agent 4: Provider Ops + E2E (9 units) ───────┐
│ Phase 103: (103.1, 103.3) → (103.2, 103.4, 103.5) │
│ Phase 107: 107.1 → 107.2 → 107.3 → 107.4     │
└────────────────────────────────────────────────┘
```

**File conflict analysis — VERIFIED:**

| File | Agent 1 | Agent 2 | Agent 3 | Agent 4 |
|------|---------|---------|---------|---------|
| `src/engines/capability-bootstrap.ts` | 100.4, 106.3 | — | 102.1-102.5 | — |
| `src/engines/provider-health.ts` | 106.4 | — | — | 103.3 |
| `web/sandbox/features/conversation-surface.tsx` | — | — | 102.6-102.12 | — |
| `web/sandbox/features/health-dashboard.tsx` | — | — | — | 103.1 |
| `web/sandbox/features/debug-panel.tsx` | — | — | — | 103.2 |
| `web/ui/features/canvas/CanvasSurface.tsx` | — | 101.1-101.5 | — | — |
| `src/server/websocket.ts` | — | 101.2 | — | — |
| `src/canvas/capability-bridge.ts` | — | 101.1 | — | — |

**CONFLICT: `capability-bootstrap.ts` — Agent 1 and Agent 3 both touch it.**

**Resolution:** Agent 1's changes (consent gate wire + trust score wire) go to lines near config/admin section. Agent 3 adds 5 new capability entries near the provider section. **Merge order: Agent 3 goes first** (adds caps to bottom of defaults array), then Agent 1 adds consent wrappers to write/destructive caps. Or reverse — Agent 1 goes first since consent-gating is per-existing-cap, not per-new-cap.

**CONFLICT: `provider-health.ts` — Agent 1 (106.4) and Agent 4 (103.3) both touch it.**

**Resolution:** Agent 1 adds trust score signal; Agent 4 adds health alert push. These touch different methods in the same file. **Agent 1 edits first** (adds signal to scoring model), **Agent 4 edits second** (adds alert push to start/stop lifecycle). Mergeable with standard diff merge.

---

## Corrected Completion Checklist

### Pre-Release Must-Have (P0)
- [ ] All 16 invariants pass (B1-B16, 0 violations)
- [ ] `bun test` → all 70+ tests pass
- [ ] `bun run typecheck` → 0 errors
- [ ] `bun run lint` → 0 warnings
- [ ] `bun run devops audit-code full` → 0 P0, 0 P1
- [ ] `bun run devops verify-cross-surface` → **50 capabilities** resolve (not 28)
- [ ] Canvas renders as primary tab with all 6 seed nodes
- [ ] Chat send pipeline works end-to-end
- [ ] Setup wizard completes for all 3 providers
- [ ] CHANGELOG corrected for Phase 31 (engines marked not implemented)

### Release (P1)
- [ ] 8 new chat capabilities registered + UI-wired (select_model, upload_file, edit_message, regenerate, new_chat, extended_thinking, deep_research, browse_with_bing)
- [ ] Canvas sandbox bridge roundtrip
- [ ] Canvas mutations forwarder
- [ ] FTS5 search UI
- [ ] Import/export ChatGPT
- [ ] Health dashboard live updates

### Polish (P2)
- [ ] Canvas design mode (WYSIWYG — P3 priority, deferrable)
- [ ] Canvas semantic zoom polish
- [ ] Cross-conversation synthesis UI
- [ ] Sovereign Trust engines (ConsentEngine, TrustScoreEngine — NEW builds)
- [ ] HITL gate UI
- [ ] Air-gap mode verified
