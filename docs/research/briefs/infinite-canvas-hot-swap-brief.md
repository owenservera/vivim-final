# Infinite Canvas + Hot-Swap Unification — Brief

**Source:** [full report](../reports/infinite-canvas-hot-swap-sota-2026.md)
**Confidence:** High | **Sources:** 28 | **Date:** 2026-07-16

## TL;DR

vivim-final has two parallel frontend systems: the `vivim-canvas` (HTML layers on an infinite plane) and the hot-swap `UIComponentRegistry` (slot-based component swapping). Both are heavily scaffolded but lack a browser-side viewport renderer. **React Flow (`@xyflow/react` v12)** is the closest existing implementation to "infinite plane with arbitrary React panels." Adopt it as the canvas engine; unify both systems into a single frontend where React Flow `nodeTypes` IS the hot-swap registry. One surface, one resolution path, one registry.

## Key Decisions

1. **Adopt `@xyflow/react` v12** as the canvas viewport engine. It provides pan/zoom/culling/minimap out-of-the-box; nodes are arbitrary React components positioned at `{x,y}` — exactly our `CanvasLayout{x,y,w,h}`.
2. **`nodeTypes` IS the hot-swap registry.** React Flow's `Record<string, ComponentType>` map replaces `UIComponentRegistry.defaults` + `bespoke`. No separate external store needed — React Flow handles live re-rendering when types change.
3. **Retire `ChatPage` as a separate shell.** It becomes a default node layout on the canvas: `chat.entry`, `chat.sidebar`, `chat.thread`, etc. are seed nodes. One frontend system.
4. **`BrowserLayerHost implements LayerHost`** mounts a `CanvasDefinition` row as a React Flow node. Replaces the server-only `ServerLayerHost`.
5. **Sandbox bridge stays as-is.** Harden with validated iframe+CSP+MessageChannel pattern; no new library.
6. **`ResolvedCapability.uiSlots` drives data-driven seeding.** Backend populates node types; frontend applies on load.

## Evidence Summary

- **React Flow v12** (`@xyflow/react`): 35K+ stars, MIT, React 19 compatible. Nodes are React components. `onlyRenderVisibleElements` provides viewport culling. Contextual zoom pattern documented. Production-grade. (Sources: reactflow.dev, GitHub xyflow/xyflow)
- **Contextual zoom** is a documented React Flow pattern: `useStore` subscribes to zoom level; nodes render different content at different zoom tiers — maps directly to our `detailZoom` semantic-zoom threshold. (Source: reactflow.dev/examples/interaction/contextual-zoom)
- **Sandboxed iframe + CSP + MessageChannel** is a validated, well-documented pattern for running untrusted HTML/JS in-browser. (Sources: agentpatterns.ai, web.dev, MDN, 7asecurity, joshua.hu)
- **Prior research** (`capability-ui-patterns-brief.md`) already established the canonical manifest + external store approach for capability-driven UI — no duplication needed. (Source: docs/research/briefs/capability-ui-patterns-brief.md)

## Open Questions

- None — all resolved by user confirmation of recommendations (adopt React Flow, unify systems, harden sandbox).

## Used In

- PRD-C1: Unified Infinite-Canvas Surface
- PRD-C2: Viewport & Node Rendering
- PRD-C3: Slot↔Node Unification
- PRD-C4: Sandbox Bridge Hardening
- PRD-C5: Data-Driven Seeding
- PRD-C6: Streaming/Result Slots
- PRD-C7: Living Manifest via EventBus
