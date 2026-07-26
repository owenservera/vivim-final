# PRD — vivim-home: Unified Infinite-Canvas Hot-Swappable UI System

**Status:** Draft PRD (built core + conceptual model; C6/C7 live wires + family seeding + mount pending)
**Author:** devops (synthesis)
**Source of truth:** `docs/vivim-canvas/00-vision-and-philosophy.md`, `01-sota-2026-notes.md`, `implementation/09-conceptual-model-plan.md`, `10-conceptual-matrix.md`
**Scope:** The primary user UI shell — a single React Flow canvas rendering every UI region as a swappable, data-driven node.

---

## 1. Purpose & Vision

Redesign the primary user UI as an **infinite, programmable HTML canvas** where layers (chat, system, automation, agents, projects, knowledge, designer) are **swapped in on demand**. The shell is pure HTML — **re-programmable by design** — shipping with a robust closed set of core primitives. The canvas is an **oracle**: global access, global visibility, agentic-native, configurable by primitives.

The first concrete realization of this vision is the **modular UI system**: a DB-backed **ProviderType (family)** conceptual model + a **UiComponent** node storing hot-swappable UI code, resolved through a 4-tier precedence and rendered as canvas nodes.

---

## 2. Goals

| # | Goal | Principle |
|---|------|-----------|
| G1 | One React Flow canvas renders every UI region as a node | P2 (dumb shell) |
| G2 | `UIComponentRegistry` IS the `nodeTypes` map — no second registry | P1/P2 |
| G3 | UI code is **data**, not code: `UiComponent` rows store html/css/js + sandbox, hot-swapped without rebuild | P1, P8 |
| G4 | 4-tier resolution: `provider(+variant) > provider > family(+variant) > family > cross-type > system` | modularity |
| G5 | Family-driven surfaces: ai-chat / email / messenger / social evolve gracefully with no per-provider migration | P6 |
| G6 | Live EventBus-driven node spawn/dismiss + progressive streaming | P3, SOTA-5.6 |
| G7 | Frontend = Backend: every surface resolves the same endpoints/shapes | One-Entry-Point |

## 3. Non-Goals

- Full Phase-03 canvas engine (3.1–3.13) rewrite — out of scope; this PRD closes the C1–C7 units + conceptual model.
- Multiplayer/oracle-in-a-team shared knowledge (vision Q7) — future pass.
- Designer-layer authoring UX (visual DSL) — future pass; only the data model + capability path is in scope.

---

## 4. Principles → Mechanisms (traceability)

| Principle | Mechanism in this system |
|-----------|--------------------------|
| P1 Frontend is data | `UiComponent` rows (html/css/sandboxJson), published not compiled |
| P2 Dumb shell | `CanvasSurface` = thin React Flow host; richness in `registry.resolve()` |
| P3 On-demand | Nodes lazy-mounted; `useConceptualModel` fetches surface per provider |
| P4 Oracle | Conceptual router exposes all families/surfaces; reads across stores |
| P5 Agentic-native | Canvas ops are `UnifiedCapability` → CLI/UI/API/MCP (existing plane) |
| P6 Primitives | Closed `Primitive` vocabulary; families compose, never reinvent |
| P7 Governor Canon | No engine touches CDP; canvas events flow through `CapabilityEventBus` |
| P8 Sandboxed | `SandboxedLayer` iframe + CSP; no inline `<script>` at def/render time |
| P9 Self-describing | `useManifest` derives live manifest; `CanvasNode.data` carries resolution metadata |

---

## 5. Architecture

```
┌──────────────────────────────────────────────────────────────┐
│  BACKEND (Bun + Prisma)                                        │
│                                                                │
│  ConceptualModelService (4-tier resolution brain)              │
│    ProviderDefinition.providerTypeId → ProviderType (family)    │
│    Primitive[] (family slot catalog)                            │
│    UiComponentStore.resolve(provider+family+primitive+variant)  │
│        │  GET /api/conceptual/{families,surface,provider-types/ │
│        │                            :slug,resolve}              │
│        ▼                                                        │
│  CapabilityEventBus ── canvas:mutated ──▶ WS forwarder         │
│  (canvas:layer:spawned/dismissed ──▶ forwarder [PENDING])      │
│                                                                │
│  ConversationStore ──▶ GET /api/conversations/:id/stream-blocks│
│                         [PENDING endpoint]                     │
└──────────────────────────────────────────────────────────────┘
                         │ HTTP + WS
                         ▼
┌──────────────────────────────────────────────────────────────┐
│  FRONTEND (Vite + React + @xyflow/react)                       │
│                                                                │
│  CanvasSurface                                                 │
│   ├─ useConceptualModel(providerId) ─▶ /api/conceptual/surface │
│   │    └─ registerUiComponent(slot, family, payload) ─▶ registry│
│   │    └─ toNodes() → family-driven CanvasNode[]               │
│   ├─ useUiSlots() ──▶ applyClaim(slot, slug, claim)            │
│   ├─ useCanvasEvents() ──▶ WS /ws/canvas (spawn/dismiss)        │
│   └─ ReactFlow ── nodeTypes = useNodeTypes()                   │
│        └─ SLOT_IDS/conceptual → SlotNode → ZoomNode             │
│             └─ registry.resolve() / catalogResolve()           │
│                  └─ Component (default or bespoke)              │
│  SandboxedLayer ── iframe + MessageChannel bridge              │
│  StreamingSlot / ResultSlot ── useStreamBlocks()               │
└──────────────────────────────────────────────────────────────┘
```

---

## 6. Data Model (already implemented in `prisma/schema.prisma`)

### 6.1 `ProviderType` (family)
`id, slug, displayName, description, slotCatalogJson, regionLayoutJson, interactionGrammarJson, basePrimitive, version, timestamps`
Families: `ai-chat`, `email`, `messenger`, `social`, `custom`.

### 6.2 `Primitive` (closed vocabulary)
`id, scope ('cross-type'|'family'|'provider'), familyId?, providerId?, label, description?, defaultRegionJson, version`
Each primitive declared once; families/providers reference existing primitives.

### 6.3 `UiComponent` (DB code node)
`id, primitiveId, scope, ownerId, variant?, componentKey, displayName, html, css, scriptUrl?, sandboxJson, version, status ('draft'|'published'|'deprecated'), author ('system'|'user'|'agent'), tagsJson, defaultRegionJson, timestamps`
Unique: `(primitiveId, scope, ownerId, variant)` — **one table encodes all four tiers.**

### 6.4 `ProviderDefinition.providerTypeId` (FK)
Links each provider to its family. Legacy `provider_type` string column retained for backward compat.

### 6.5 Resolution precedence (encoded in `UiComponentStore.resolve`)
```
provider + variant  (scope='provider', ownerId=providerId, variant)
provider canonical  (scope='provider', ownerId=providerId, variant=null)
family  + variant  (scope='family',   ownerId=familyId,    variant)
family  canonical  (scope='family',   ownerId=familyId,    variant=null)
cross-type          (scope='cross-type', ownerId='global')
→ system built-in default
```

---

## 7. Endpoint / Contract Spec

| # | Endpoint | Method | Purpose | Status |
|---|----------|--------|---------|--------|
| 1 | `/api/conceptual/families` | GET | All families | ✅ built |
| 2 | `/api/conceptual/surface?providerId=` | GET | 4-tier resolved slots for a provider | ✅ built |
| 3 | `/api/conceptual/provider-types/:slug` | GET | Family spec + `UiComponent`s | ✅ built |
| 4 | `/api/conceptual/resolve` | GET | Resolve single primitive | ✅ built |
| 5 | `/api/capabilities?surface=ui` | GET | Capabilities w/ `uiSlots` | ✅ built |
| 6 | `/api/conversations/:id/stream-blocks` | GET | `{ blocks: ContentBlock[], streaming: bool }` | ⏳ pending |
| 7 | `WS /ws/canvas` | WS | `canvas:layer:spawned` / `dismissed` | ⏳ pending |

`/api/conceptual/surface` response:
```json
{
  "ok": true,
  "providerId": "chatgpt",
  "family": "ai-chat",
  "slots": [
    {
      "primitive": { "id": "ai-chat.entry", "scope": "family", "label": "Entry",
                     "defaultRegion": { "x":0,"y":0,"w":400,"h":300 }, "version": 1 },
      "component": { "id":"uc:...", "componentKey":"ai-chat.entry.system",
                     "html":"...", "css":"...", "scriptUrl": null },
      "tier": "cross-type",
      "fromSystemDefault": false
    }
  ]
}
```
`ContentBlock` union (`shared/stream-blocks.ts`): `text | thinking | code | artifact | image | citation | tool_use | error | meta`, each with `index`.

---

## 8. Implementation Units (C1–C7) — Status

| Unit | Concern | Built | Pending |
|------|---------|-------|---------|
| **C1** | `CanvasSurface` React Flow shell, nodes, mount hooks | ✅ | Mount as a tab in `App.tsx` |
| **C2** | `ZoomNode` contextual zoom (dot/card/full) | ✅ | — |
| **C3** | `nodeTypes` = registry; `conceptual` node type | ✅ | — |
| **C4** | `SandboxedLayer` iframe + CSP bridge | ✅ | — |
| **C5** | `useUiSlots` data-driven seeding via `uiSlots` claims | ✅ | — |
| **C6** | `useStreamBlocks` + `StreamingSlot`/`ResultSlot` | ✅ frontend | Backend `/stream-blocks` endpoint |
| **C7** | `useCanvasEvents` WS + `useManifest` living manifest | ✅ frontend | WS `/ws/canvas` forwarder + `LayerMounter` emit |

### 8.1 Conceptual model (09/10) — ✅ built end-to-end
- Tables, 4-tier `resolve()`, `ConceptualModelService`, `/api/conceptual/*`, idempotent boot seeder (`seeds/conceptual-model/seed.ts`), `useConceptualModel` hook, `registerUiComponent`/`catalogResolve`, generic `conceptual` node type, family-driven `CanvasSurface`.

---

## 9. Pending Work (detailed acceptance)

### P1 — Mount `CanvasSurface` (C1 follow-up)
- Add **"Canvas" tab** to `App.tsx` → `<CanvasSurface providerId="chatgpt" />`. Keep `ChatPage` intact.
- **Accept:** Canvas tab renders ai-chat family nodes; falls back to `SEED_NODES` if backend down.

### P2 — Stream-blocks endpoint (C6)
- `GET /api/conversations/:id/stream-blocks` → `{ blocks, streaming }`.
  - `blocks`: from latest assistant message `blocksJson` (else wrap `content` as one `text` block).
  - `streaming`: conversation/message pending status.
- **Accept:** `useStreamBlocks` receives structured blocks; `StreamingSlot` pulses; `ResultSlot` fills progressively.

### P3 — Live canvas events (C7)
- Add `canvas:layer:spawned` / `canvas:layer:dismissed` to `CapabilityEventBus`.
- `registerCanvasLayerForwarder(eventBus)` in `websocket.ts` (mirror `registerCanvasMutationForwarder`).
- Thin `LayerMounter` (`src/engines/canvas-layer-mounter.ts`): emits those events on mount/unmount.
- `useCanvasEvents` sends `subscribe { entityType:'canvas' }` on WS open.
- **Accept:** spawn a layer → node appears → `useManifest` updates.

### P4 — Seed other families
- Extend `seeds/conceptual-model/seed.ts` with `UiComponent` rows (html/css) for `email`/`messenger`/`social` primitives (idempotent).
- **Accept:** resolving a social/messenger/email provider returns real `component` (not `fromSystemDefault`).

### P5 — Integration tests
- Test `ConceptualModelService.resolveSurface` for `chatgpt` (4-tier precedence; provider > family > cross-type > system).
- Test `/api/conceptual/surface` contract shape.
- **Accept:** `bun test` passes; coverage on resolution path ≥ existing bar.

### P6 — Fix doc drift
- `08-backend-integration.md`: remove false "already exists" claims about `StreamBlockStore`/`LayerMounter`; mark conceptual endpoints done.
- Align `implementation/README.md` + top-level `README.md` status lines.

---

## 10. Risks & Constraints

| Risk | Mitigation |
|------|-----------|
| `CanvasSurface` currently renders slot nodes, not full chat | Keep `ChatPage` as working surface; Canvas tab is additive (per user decision) |
| `LayerMounter` is minimal, not full Phase-03 engine | Explicitly scoped; full engine is a future PRD |
| Inline `<script>` in `UiComponent.html` | Rejected at def time + render time (P8; `SandboxedLayer` CSP) |
| Governor Canon (P7) | No engine opens CDP; canvas events flow through `CapabilityEventBus` |
| No new migrations | Tables exist; only seed rows + routes added |

---

## 11. Verification Plan

1. `cd frontend && bun run typecheck` — 0 new errors.
2. `bun run typecheck` (root) — backend compiles.
3. `bun test` (root) — new + existing pass.
4. `pwsh scripts/start-bg.ps1` → browser:
   - Canvas tab → ai-chat family resolves from DB.
   - Switch provider/family → email/messenger/social resolve real components.
   - Spawn/dismiss layer → node appears/removed via WS.
   - Stream a response → `StreamingSlot` pulses → `ResultSlot` fills.
5. `bun run devops verify-cross-surface` (if taxonomy touched).

---

## 12. Open Questions (carry to next pass)

1. Designer-layer authoring UX (visual DSL vs code).
2. Cross-family composition (can a layer embed another without scope leak).
3. Layer state persistence on dismiss.
4. Oracle read contract (dedicated aggregation vs fan-out).

---

*This is a living document. Amend it on purpose, cite it always.*
