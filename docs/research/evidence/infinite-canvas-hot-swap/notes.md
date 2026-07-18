# Infinite Canvas + Hot-Swap — Research Notes

## Research Session: 2026-07-16

### Convergence Trace

**Iteration 1 — Broad landscape scan**
- Searched: "infinite canvas viewport architecture react pan zoom", "tldraw infinite canvas architecture", "best library for infinite canvas pan zoom"
- Found: React Flow, tldraw, Konva, Excalidraw, Flowscape, jamesyong42, grid-canvas, foolish, crafter-station/flow
- Assessment: React Flow is the clear leader for "nodes = React components on infinite plane"
- tldraw is whiteboard-first (shapes/arrows), not HTML panels
- Konva/Excalidraw are canvas-2D, not DOM/React

**Iteration 2 — Deep dive on top candidates**
- Searched: "tldraw custom shape HTML content embed", "react flow custom node render arbitrary component"
- Read: React Flow custom nodes, viewport, performance, contextual zoom docs
- Key finding: React Flow nodes ARE arbitrary React components; `nodeTypes` = `Record<string, ComponentType>`
- Contextual zoom = our `detailZoom` — nodes render different content at different zoom levels
- `onlyRenderVisibleElements` provides viewport culling

**Iteration 3 — Unification design + sandbox validation**
- Searched: "sandboxed iframe postMessage bridge capability allow list"
- Found: agentpatterns.ai (2026), web.dev, MDN, 7asecurity, joshua.hu — all validate our existing BridgeMessage protocol
- Key insight: `nodeTypes` IS the hot-swap registry; no separate external store needed
- Confirmed: ChatPage can become a default node layout; one frontend system

### Key Observations

1. **React Flow's architecture** — `useVisibleNodeIds` computes AABB intersection; `NodeWrapper` is memoized per node; Zustand store with `shallow` selector prevents unnecessary re-renders
2. **React Flow is NOT a graph library** — despite the name, it's a "node-based UI" library. Edges are optional.
3. **`@xyflow/system`** — the headless core, no React dependency. We could use this for pure math (viewport, culling) if needed, but React integration is straightforward.
4. **Bundle size** — React Flow v12 is ~50KB min+gz; acceptable for our use case
5. **React 19 compat** — confirmed in xyflow/xyflow README and npm package

### Rejected Approaches

| Approach | Why Rejected | Confidence When Rejected |
|----------|--------------|-------------------------|
| Custom CSS-transform viewport | Too much fiddly work (gesture math, culling, DPR); high jank risk | Low (iteration 1) |
| tldraw SDK | Whiteboard model (shapes/arrows); wrong for HTML app panels | Low (iteration 1) |
| Konva.js | Canvas-2D, not DOM/React components | Low (iteration 1) |
| Excalidraw | Application, not a library; Canvas-2D | Low (iteration 1) |
| Flowscape canvas-react | Too young (v1.1, 18 stars) | Low (iteration 1) |
| jamesyong42/infinite-canvas | ECS + WebGL, overengineered | Low (iteration 1) |
| grid-canvas | Grid-based layout, not freeform | Low (iteration 1) |
| Keep ChatPage separate | Violates ONE frontend system requirement | Low (iteration 3) |

### Sandbox Pattern Validation

The research confirmed our existing `SandboxBridge` design is correct:
- `iframe sandbox="allow-scripts"` without `allow-same-origin` = opaque origin
- `MessageChannel` or `postMessage` bridge = scoped communication
- `SandboxPolicy.allowCapabilities` = allow-list enforcement
- `SandboxPolicy.budgetMs` = time budget
- CSP `connect-src 'none'` unless `allowNetwork`

Key gotcha from research: `allow-scripts` + `allow-same-origin` together is dangerous (allows iframe to remove sandbox). We must use `allow-scripts` alone.
