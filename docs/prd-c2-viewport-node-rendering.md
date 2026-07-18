# PRD-C2: Viewport & Node Rendering

**Status:** Proposed | **Author:** vivim runtime | **Date:** 2026-07-16
**Part of:** [PRD-C1: Unified Infinite-Canvas Surface](prd-canvas-unified-surface.md)

## 1. Problem

No browser-side viewport renderer exists. `CanvasLayout{x,y,z,w,h}` are pure data; nothing pans/zooms/CSS-transforms a browser surface or mounts a `CanvasDefinition` into real DOM. `LayerHost` is only implemented server-side (`ServerLayerHost`).

## 2. Goals

- **G1 — Adopt `@xyflow/react` v12** as the canvas viewport engine. Pan/zoom/culling/minimap out-of-the-box.
- **G2 — `BrowserLayerHost implements LayerHost`** mounts `CanvasDefinition` rows as React Flow nodes.
- **G3 — `detailZoom` contextual rendering** via React Flow's zoom subscription. At low zoom: placeholder/map-dot. At high zoom: full HTML/CSS/iframe.
- **G4 — Real seed-layer HTML/CSS** replace `<div data-region>` stubs.

## 3. Design

### 3.1 CanvasSurface

```tsx
<ReactFlow
  nodes={nodes}
  edges={[]}
  nodeTypes={nodeTypes}
  onNodesChange={onNodesChange}
  onlyRenderVisibleElements={true}
  minZoom={0.1}
  maxZoom={4}
  fitView
>
  <Background />
  <MiniMap />
  <Controls />
</ReactFlow>
```

### 3.2 BrowserLayerHost

Implements `LayerHost` contract. `mount()` creates a React Flow node from a `CanvasDefinition`:
- `position` = `{ x: def.layout.x, y: def.layout.y }`
- `type` = `def.category` (maps to nodeType)
- `data` = `{ definitionId, sandbox, html, css, scriptUrl, bindings }`
- `style` = `{ width: def.layout.w, height: def.layout.h }`

`unmount()` removes the node.

### 3.3 detailZoom

React Flow's `useStore` subscribes to zoom. Each node checks zoom level:
- `zoom < 0.3`: Render as colored dot (map-dot placeholder)
- `0.3 <= zoom < 0.8`: Render as title card (name + icon)
- `zoom >= 0.8`: Render full HTML/CSS/iframe content

### 3.4 Seed Layers

Replace `<div data-region>` stubs with real HTML/CSS:
- `system` layer: Health dashboard panel (styled div with engine status)
- `chat` layer: Conversation surface (message list + input, matching current ChatPage)
- `designer` layer: Layer definition form (name, category, HTML/CSS editors)

## 4. Implementation

| Unit | What | Size |
|------|------|------|
| C1.1 | Install `@xyflow/react`, `CanvasSurface` shell | Small |
| C1.2 | `BrowserLayerHost` + mount/unmount | Medium |
| C1.3 | Seed-layer HTML/CSS | Medium |
| C2.1 | `detailZoom` contextual rendering | Small |

## 5. Acceptance

- `bun add @xyflow/react` installs without peer-dep conflicts
- `CanvasSurface` renders 3 seed nodes; pan/zoom/culling works
- `BrowserLayerHost.mount()` creates a node from a `CanvasDefinition` row
- At zoom < 0.3, nodes render as dots; at zoom >= 0.8, full content
- `bun run typecheck` passes
