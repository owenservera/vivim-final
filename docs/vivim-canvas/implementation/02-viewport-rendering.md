# 02 — Viewport & Node Rendering (C1, C2)

**Units:** C1.1 (CanvasSurface shell), C1.2 (BrowserLayerHost), C2.1 (detailZoom)
**Files:** `CanvasSurface.tsx`, `BrowserLayerHost.tsx`, `useZoomLevel.ts`, `ZoomNode.tsx`

---

## 1. Problem

No browser-side viewport renderer existed. `CanvasLayout{x,y,z,w,h}` were pure
data; nothing panned/zoomed/CSS-transformed a browser surface or mounted a
`CanvasDefinition` into real DOM. `LayerHost` was only implemented server-side
(`ServerLayerHost`).

---

## 2. Solution — `@xyflow/react` v12 as the viewport engine

React Flow provides out-of-the-box:
- Infinite pan/zoom (CSS transform plane)
- Viewport culling (`onlyRenderVisibleElements`)
- MiniMap + Controls
- Zoom subscription via `useStore`

We do **not** reinvent pan/zoom. The canvas is a React Flow instance; every UI
region is a **node**.

---

## 3. CanvasSurface (C1.1)

`web/ui/src/features/canvas/CanvasSurface.tsx`

```tsx
export function CanvasSurface() {
  const nodeTypes = useNodeTypes()
  const [nodes, setNodes] = useState<CanvasNode[]>(SEED_NODES)

  useCanvasEvents(setNodes)   // C7: live spawn/dismiss
  useUiSlots()                // C5: apply backend uiSlots claims

  const onNodesChange = useCallback(
    (changes) => setNodes((nds) => applyNodeChanges(changes, nds)),
    [],
  )

  return (
    <div style={{ width: '100vw', height: '100vh' }}>
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
    </div>
  )
}
```

### Seed nodes (replaces ChatPage)

The old `ChatPage` shell is gone. Its slots become seed nodes on the canvas:

```ts
const SEED_NODES: CanvasNode[] = [
  { id: 'chat.header',    type: 'chat.header',    position: { x: 0,    y: -60 }, data: {} },
  { id: 'chat.sidebar',   type: 'chat.sidebar',   position: { x: -400, y: 0 },   data: {} },
  { id: 'chat.entry',     type: 'chat.entry',     position: { x: 0,    y: 0 },   data: {} },
  { id: 'chat.thread',    type: 'chat.thread',    position: { x: 420,  y: 0 },   data: {} },
  { id: 'chat.composer',  type: 'chat.composer',  position: { x: 420,  y: 400 }, data: {} },
  { id: 'chat.actionBar', type: 'chat.actionBar', position: { x: 0,    y: 600 }, data: {} },
]
```

> **Note:** `type` is the slot id (e.g. `'chat.thread'`). React Flow looks up
> `nodeTypes['chat.thread']` to render it. See `03-slot-node-unification.md`.

---

## 4. CanvasNode shape

```ts
export interface CanvasNode extends Node {
  data: {
    overrideSlug?: string    // capability slug → drives resolution precedence
    providerSlug?: string    // provider slug → fallback precedence
    sandbox?: string[]       // allow-list of capabilities the layer may touch
    definitionId?: string    // CanvasDefinition row id (for BrowserLayerHost)
  }
}
```

`position` comes from `CanvasLayout{x,y}`. `style.width/height` come from
`CanvasLayout{w,h}`.

---

## 5. BrowserLayerHost (C1.2)

`web/ui/src/features/canvas/BrowserLayerHost.tsx`

Implements the backend `LayerHost` contract (from `shared/canvas-types.ts`) in
the browser. `mount()` creates a React Flow node from a `CanvasDefinition` row:

```ts
export function createBrowserLayerHost(
  setNodes: React.Dispatch<React.SetStateAction<CanvasNode[]>>,
): LayerHost {
  const mounted = new Set<string>()
  return {
    async mount(instanceId, def) {
      const node: CanvasNode = {
        id: instanceId,
        type: def.category,
        position: { x: def.layout.x, y: def.layout.y },
        data: {
          definitionId: def.id,
          sandbox: def.sandbox.allowCapabilities,
          overrideSlug: def.slug,
        },
        style: { width: def.layout.w, height: def.layout.h },
      }
      setNodes((prev) => [...prev, node])
      mounted.add(instanceId)
      return { hostNodeId: instanceId }
    },
    async unmount(instanceId) {
      setNodes((prev) => prev.filter((n) => n.id !== instanceId))
      mounted.delete(instanceId)
    },
    isMounted(instanceId) {
      return mounted.has(instanceId)
    },
  }
}
```

This is the browser counterpart to the server-only `ServerLayerHost`. The
`LayerMounter` engine (backend) can now target either host.

---

## 6. detailZoom (C2.1)

React Flow's `useStore` exposes the live transform. We subscribe to
`transform[2]` (the zoom) and classify into tiers.

`useZoomLevel.ts`:

```ts
import { useStore } from '@xyflow/react'

export type ZoomTier = 'dot' | 'card' | 'full'

const DOT_THRESHOLD = 0.3
const CARD_THRESHOLD = 0.8

function classifyZoom(zoom: number): ZoomTier {
  if (zoom < DOT_THRESHOLD) return 'dot'
  if (zoom < CARD_THRESHOLD) return 'card'
  return 'full'
}

export function useZoomTier(): ZoomTier {
  const zoom = useStore((s) => s.transform[2])
  return classifyZoom(zoom)
}
```

> **Why `useStore` directly?** It re-renders only when the *value* changes
> (React Flow uses `useSyncExternalStore` internally). We further reduce churn
> by classifying into tiers — a node at zoom 1.2 and 1.5 both render "full",
> so panning within a tier does not re-render the node body.

`ZoomNode.tsx` wraps any slot node:

```tsx
export function ZoomNode({ label, icon, color, children }: ZoomNodeProps) {
  const tier = useZoomTier()
  switch (tier) {
    case 'dot':  return <DotNode label={label} color={color} />
    case 'card': return <CardNode label={label} icon={icon} color={color} />
    case 'full': return <>{children}</>
  }
}
```

| Zoom | Tier | Render |
|------|------|--------|
| `< 0.3` | `dot` | 12px colored circle (map-dot placeholder) |
| `0.3 – 0.8` | `card` | Title card: icon + name + colored dot |
| `≥ 0.8` | `full` | Full HTML/CSS/iframe content (the real component) |

This is the SOTA-2026 **contextual zoom** pattern: you see the *shape* of the
system when zoomed out, and the *detail* when zoomed in — without loading
everything at once.

---

## 7. Acceptance (from PRD-C2)

- [x] `bun add @xyflow/react` installs without peer-dep conflicts
- [x] `CanvasSurface` renders seed nodes; pan/zoom/culling works
- [x] `BrowserLayerHost.mount()` creates a node from a `CanvasDefinition` row
- [x] At zoom < 0.3, nodes render as dots; at zoom ≥ 0.8, full content
- [x] `bun run typecheck` passes

---

## 8. Open items

- **Seed-layer real HTML/CSS** (PRD-C2 §3.4): currently the seed nodes render
  the *existing* slot components (ChatEntry, Thread, Composer, etc.). The
  original vision called for bespoke `system`/`chat`/`designer` HTML panels.
  Those can be added as new `CanvasDefinition` rows + new node types without
  touching `CanvasSurface`.
- **MiniMap node colors:** could color minimap dots by category (currently
  default React Flow styling).
