# PRD-C1: Unified Infinite-Canvas Surface

**Status:** Proposed | **Author:** vivim runtime | **Date:** 2026-07-16
**Supersedes:** `prd-hot-swappable-ui.md` (folded in — the two systems are unified)

## 1. Problem

vivim-final has two parallel frontend systems:
1. **`vivim-canvas`** (`src/canvas/*`) — HTML layers on an infinite plane (`CanvasLayout{x,y,z,w,h}`), but no browser-side viewport renderer exists.
2. **Hot-swap UI** (`web/ui/src/ui/*`) — `UIComponentRegistry` with slot-based runtime component swapping, but only renders a single `ChatPage` shell.

Both are heavily scaffolded but disconnected. There is no browser surface that renders canvas layers as pannable/zoomable panels. The "infinite plane" is currently conceptual.

## 2. Goals

- **G1 — One frontend system.** A single `CanvasSurface` (React Flow) renders every UI region as a node. The `UIComponentRegistry` and `LayerHost` are unified into one `nodeTypes` registry.
- **G2 — Infinite plane.** Nodes positioned by `CanvasLayout{x,y}`; React Flow owns pan/zoom/culling. `detailZoom` → contextual zoom (node renders simplified at low zoom, full at high zoom).
- **G3 — Capability globals = nodes.** `SLOT_IDS` become seed node types. `chat.entry`, `chat.sidebar`, etc. resolve via `capabilitySlug > providerSlug > default` precedence.
- **G4 — FRONTEND=BACKEND.** `ResolvedCapability.uiSlots` drives `nodeTypes` registration at load. `CanvasDefinition` rows drive spawned layer-nodes.
- **G5 — Sandbox (P8).** Untrusted layer HTML/JS runs in sandboxed iframe + `MessageChannel` bridge.
- **G6 — Live hot-swap.** `window.__vivim.ui.hotSwap(slot, slug, Component)` = dynamic node-type registration. Persistence via localStorage + backend.

## 3. Non-Goals

- Rewriting backend engines
- Replacing the backend capability contract
- Full design-system migration (styling stays utilitarian)

## 4. Acceptance

- A `CanvasDefinition` row renders as a pannable/zoomable node on the infinite plane
- `hotSwap('chat.bubble','claude',X)` live-updates only Claude's bubble nodes
- Reloading restores persisted overrides
- Untrusted layer cannot invoke a non-whitelisted capability
- `ChatPage` is retired as a separate shell; all UI renders as nodes

## 5. Implementation Units

| Unit | Delivers | Depends on |
|------|----------|------------|
| C1.1 | Install `@xyflow/react`, `CanvasSurface` shell | — |
| C1.2 | `BrowserLayerHost` + `LayerMounter` browser mount | C1.1 |
| C1.3 | Real seed-layer HTML/CSS (replace stubs) | C1.2 |
| C2.1 | `detailZoom` contextual node rendering | C1.1 |
| C3.1 | `SLOT_IDS`→`nodeTypes` unification; retire dual shell | C1.1 |
| C4.1 | Sandbox iframe+CSP+MessageChannel hardening | — |
| C5.1 | Backend `uiSlots` contract + populate | — |
| C5.2 | Frontend apply `uiSlots`→nodeTypes | C5.1, C3.1 |
| C6.1 | Streaming/result node wiring | C3.1 |
| C7.1 | EventBus-driven re-resolution | C3.1 |

## 6. References

- [Research report](docs/research/reports/infinite-canvas-hot-swap-sota-2026.md)
- [Research brief](docs/research/briefs/infinite-canvas-hot-swap-brief.md)
- [Code path](docs/research/code-paths/infinite-canvas-unification-path.md)
- [Existing hot-swap PRD](docs/prd-hot-swappable-ui.md) (superseded)
- [Prior capability-ui brief](docs/research/briefs/capability-ui-patterns-brief.md)
