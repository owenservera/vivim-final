# vivim-canvas — Implementation

**Status:** Implemented (frontend + conceptual-model backend complete; C6/C7 live wires pending)
**Date:** 2026-07-16
**Scope:** The unified infinite-canvas hot-swappable UI system built on React Flow

---

## 0. What this folder is

This folder documents the **implemented** unified infinite-canvas system — the
concrete code that collapses the two parallel frontend systems (`vivim-canvas`
+ hot-swap `UIComponentRegistry`) into a single React Flow–powered frontend.

It is the engineering counterpart to the design docs in the parent
`docs/vivim-canvas/` folder:

```
docs/vivim-canvas/
  00-vision-and-philosophy.md     ← "why" + governing principles
  01-sota-2026-notes.md           ← "how" (best practices + sketch)
  implementation/                 ← THIS FOLDER: what was actually built
    README.md                     ← index (you are here)
    01-architecture.md            ← system shape + file map
    02-viewport-rendering.md      ← CanvasSurface + detailZoom (C1, C2)
    03-slot-node-unification.md   ← nodeTypes = registry (C3)
    04-sandbox-hardening.md       ← SandboxedLayer + bridge (C4)
    05-data-driven-seeding.md     ← uiSlots contract (C5)
    06-streaming-result-slots.md  ← progressive blocks (C6)
     07-living-manifest.md         ← EventBus + manifest (C7)
     08-backend-integration.md     ← API/WS contract the frontend expects
     09-conceptual-model-plan.md  ← ProviderType/Primitive/UiComponent + 4-tier resolution
     10-conceptual-matrix.md       ← resolution matrix + schema decisions
```

The 7 PRDs that drove this implementation live at repo root:
`prd-canvas-unified-surface.md` (C1, master) and `prd-c2` through `prd-c7`.

---

## 1. The one-sentence summary

> **A single React Flow canvas renders every UI region as a node; the
> `UIComponentRegistry` IS the `nodeTypes` map; layers are swappable on demand;
> sandboxed HTML runs in opaque-origin iframes; and the whole thing is driven by
> backend `uiSlots` claims + a live EventBus.**

---

## 2. Key decisions (from research)

| # | Decision | Why |
|---|----------|-----|
| D1 | Adopt `@xyflow/react` v12 as the canvas viewport engine | Pan/zoom/culling/minimap/contextual-zoom out-of-the-box — no wheel reinvention |
| D2 | **One** frontend system; retire `ChatPage` as a separate shell | It becomes a default node layout on the canvas, not a competing surface |
| D3 | `nodeTypes` map **is** the hot-swap registry | `UIComponentRegistry.resolve()` → React Flow node component; no second registry |
| D4 | `data.overrideSlug` drives resolution precedence | `capabilitySlug > providerSlug > default` — same as before, now per-node |
| D5 | `detailZoom` = React Flow's contextual-zoom pattern | Zoom-tier-dependent rendering (dot / card / full) without custom math |
| D6 | `BrowserLayerHost implements LayerHost` | Backend's `CanvasDefinition` rows mount as React Flow nodes in the browser |
| D7 | Sandbox = `iframe sandbox="allow-scripts"` (NO `allow-same-origin`) + immutable CSP + scoped `MessageChannel` | Opaque origin; host DOM never reachable from layer JS |
| D8 | Data-driven seeding via `uiSlots` map on `ResolvedCapability` | Backend publishes slot overrides; frontend applies them — FRONTEND=BACKEND |
| D9 | Live manifest via `CapabilityEventBus` forwarder | Spawn/dismiss events update nodes + oracle visibility in real time |

Research report: `docs/research/reports/infinite-canvas-hot-swap-sota-2026.md`
Research brief (gate currency): `docs/research/briefs/infinite-canvas-hot-swap-brief.md`

---

## 3. File map

### Frontend (`web/ui/src/features/canvas/`)

| File | Unit | Responsibility |
|------|------|----------------|
| `CanvasSurface.tsx` | C1.1 | React Flow shell; family-driven nodes from `useConceptualModel`; mounts `useCanvasEvents` + `useUiSlots` |
| `useNodeTypes.tsx` | C3.1 | SLOT_IDS + `conceptual` → React Flow `nodeTypes`; wraps `registry.resolve()` / `catalogResolve()` in `ZoomNode` |
| `useConceptualModel.ts` | — | Fetches `/api/conceptual/surface?providerId=`; hot-swaps resolved `UiComponent`s; `toNodes()` builds family nodes |
| `ZoomNode.tsx` | C2.1 | Zoom-tier rendering: dot (<0.3) / card (<0.8) / full (≥0.8) |
| `useZoomLevel.ts` | C2.1 | `useZoomTier()` / `useZoom()` via React Flow `useStore` |
| `BrowserLayerHost.tsx` | C1.2 | `LayerHost` impl: `CanvasDefinition` → React Flow node |
| `SandboxedLayer.tsx` | C4.1 | Sandboxed iframe + `MessageChannel` bridge; host-side allow-list |
| `useUiSlots.ts` | C5 | Fetches capabilities; applies `uiSlots` claims to registry |
| `useStreamBlocks.ts` | C6 | Polls `/api/conversations/:id/stream-blocks`; returns `{ blocks, isStreaming }` |
| `StreamingSlot.tsx` | C6 | Animated streaming indicator |
| `ResultSlot.tsx` | C6 | Progressive block renderer (text/code/artifact/image/etc.) |
| `useCanvasEvents.ts` | C7 | WebSocket `/ws/canvas` subscription; spawn/dismiss → node add/remove |
| `useManifest.ts` | C7 | Derives live `CanvasManifest` from current nodes |
| `index.ts` | — | Barrel exports |

### Shared types (`shared/`)

| File | What |
|------|------|
| `canvas-types.ts` | `CanvasDefinition`, `LayerHost`, `SandboxPolicy`, `CanvasLayout` |
| `ui-slots.ts` | `UiSlotsMap`, `UiSlotClaim` |
| `stream-blocks.ts` | `ContentBlock` union |
| `conceptual-model.ts` | `ProviderType`, `Primitive`, scope types (the family vocabulary) |
| `ui-component.ts` | `UiComponent`, scope, status types (DB code node) |

### Frontend UI registry (`web/ui/src/ui/`)

| File | What |
|------|------|
| `registry.ts` | `UIComponentRegistry` + `registerUiComponent()` / `catalogResolve()` (conceptual bridge) |
| `ui-component-renderer.tsx` | Wraps a raw `html/css` `UiComponent` payload into a React component |
| `slots.ts` | `SLOT_IDS` (chat-only closed catalog) + `SlotOverrideClaim` |

### Backend (existing, consumed by frontend)

| File | What the frontend uses |
|------|----------------------|
| `src/engines/capability-resolution.ts` | `ResolvedCapability.uiSlots` (already parsed from `ui_component_override`) |
| `src/server/capability-router.ts` | `GET /api/capabilities?surface=ui` |
| `src/engines/capability-event-bus.ts` | `CapabilityEventBus` (backend EventBus to forward to `/ws/canvas`) |
| `src/engines/stream-block-store.ts` | `StreamBlockStore` (backend persistence for blocks) |
| `src/engines/conceptual-model-service.ts` | `resolveFamilyForProvider` / `resolveSurface` (4-tier resolution brain) |
| `src/server/conceptual-router.ts` | `GET /api/conceptual/{families,surface,provider-types/:slug,resolve}` |
| `src/storage/contracts/{provider-type-store,primitive-store,ui-component-store}.ts` | Stores + 4-tier `resolve()` |
| `src/storage/impl/{provider-type-store-impl,primitive-store-impl,ui-component-store-impl}.ts` | Prisma impls |
| `seeds/conceptual-model/seed.ts` | Idempotent seeder: 4 families, primitives, `UiComponent` rows (runs at server boot) |

---

## 4. Data flow (end to end)

```
┌─────────────────────────────────────────────────────────────────┐
│  BACKEND (Bun + Prisma)                                          │
│                                                                   │
│  provider_capability.ui_component_override (JSON)                 │
│        │  parseUiSlots()                                          │
│        ▼                                                          │
│  ResolvedCapability.uiSlots: { [slotId]: { component, sandbox } } │
│        │  GET /api/capabilities?surface=ui                        │
│        ▼                                                          │
│  ┌──────────────────┐   canvas:layer:spawned/dismissed  ┌───────┐│
│  │ CapabilityEventBus│ ───────── WebSocket /ws/canvas ──▶│  WS   ││
│  └──────────────────┘                                     └───────┘│
│                                                                   │
│  ConceptualModelService (4-tier resolution)                       │
│    ProviderDefinition.providerTypeId → ProviderType (family)      │
│    Primitive[] (family slot catalog)                              │
│    UiComponentStore.resolve(provider+family+primitive+variant)    │
│        │  GET /api/conceptual/surface?providerId=                 │
│        ▼                                                          │
│  { family, slots: [{ primitive, component, tier, fromSystemDefault }] }│
│        │  GET /api/conversations/:id/stream-blocks                │
│        ▼                                                          │
│  StreamBlockStore (Prisma) ──► blocks[]                           │
└─────────────────────────────────────────────────────────────────┘
                          │ HTTP + WS
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│  FRONTEND (Vite + React + @xyflow/react)                         │
│                                                                   │
 │  CanvasSurface                                                    │
 │    ├─ useConceptualModel(providerId) ──▶ /api/conceptual/surface  │
 │    │     └─ registerUiComponent(slot, family, payload) ─▶ registry│
 │    │     └─ toNodes() → family-driven CanvasNode[]                │
 │    ├─ useUiSlots() ──▶ applyClaim(slot, slug, claim) ──▶ registry │
 │    ├─ useCanvasEvents() ──▶ setNodes(add/remove)                  │
 │    └─ ReactFlow                                                   │
 │         └─ nodeTypes = useNodeTypes()                             │
 │              └─ SLOT_IDS/conceptual → SlotNode → ZoomNode         │
 │                   └─ registry.resolve() / catalogResolve()        │
 │                        └─ Component (default or bespoke)           │
 │                                                                   │
 │  StreamingSlot / ResultSlot ──▶ useStreamBlocks() ──▶ poll blocks │
 │  SandboxedLayer ──▶ iframe + MessageChannel bridge                │
└─────────────────────────────────────────────────────────────────┘
```

---

## 5. What is done vs. pending

### ✅ Done (this implementation)
- Frontend canvas engine (all 7 units C1–C7)
- `@xyflow/react` v12 installed
- Shared types extracted to `shared/`
- Typecheck passes clean for all new code

### ✅ Done (conceptual model — `09` / `10`)
- `ProviderType` (family) + `Primitive` (closed vocabulary) + `UiComponent` (DB code
  node) tables on a single `(scope, ownerId, primitiveId, variant)` key
- Backend 4-tier resolution (`provider(+variant) > provider > family(+variant) >
  family > cross-type > system`) in `UiComponentStore.resolve()` + `ConceptualModelService`
- `GET /api/conceptual/{families,surface,provider-types/:slug,resolve}` endpoints
- Idempotent conceptual seeder (`seeds/conceptual-model/seed.ts`) run at server boot
- Frontend: `useConceptualModel` hook + `registerUiComponent` / `catalogResolve` in the
  registry + generic `conceptual` node type; `CanvasSurface` is now family-driven
  (`providerId` prop, default `chatgpt`) with `SEED_NODES` as fallback
- `bun run typecheck` (web/ui) — 0 new errors; backend 4-tier resolution unit-verified

### ⏳ Pending (backend wiring)
- `GET /api/conversations/:id/stream-blocks` endpoint (C6 needs it)
- WebSocket forwarder `/ws/canvas` from `CapabilityEventBus` (C7 needs it)
- `canvas:layer:spawned` / `canvas:layer:dismissed` events emitted by `LayerMounter` (C7)
- Mount `CanvasSurface` as the default shell (currently `ChatPage` is mounted in `App.tsx`)
- Seed-layer real HTML/CSS for email/messenger/social families (ai-chat family seeded)
- Integration tests for the conceptual surface → canvas node path

See `08-backend-integration.md` for the exact contract the backend must satisfy.
