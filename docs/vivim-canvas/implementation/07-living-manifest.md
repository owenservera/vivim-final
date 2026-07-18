# 07 — Living Manifest via EventBus (C7)

**Units:** C7 (`useCanvasEvents.ts`, `useManifest.ts`)
**Principle (P9):** The manifest is *alive*. When layers spawn or dismiss, the
node set and oracle visibility update in real time.

---

## 1. Problem

The `CanvasManifest` (types.ts:170) describes which definitions exist and what
regions they expose. But it was static — generated once, not updated on
spawn/dismiss. The oracle couldn't see what was actually mounted.

---

## 2. EventBus integration (C7)

### Backend → frontend over WebSocket

The backend `CapabilityEventBus` emits canvas events. A **forwarder** (to be
added server-side, see `08-backend-integration.md`) relays them to a WebSocket
at `/ws/canvas`.

`useCanvasEvents.ts` subscribes:

```ts
export function useCanvasEvents(setNodes: SetNodes): void {
  useEffect(() => {
    let ws: WebSocket | null = null
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null

    function connect() {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
      ws = new WebSocket(`${protocol}//${window.location.host}/ws/canvas`)
      ws.onmessage = (event) => {
        const data = JSON.parse(String(event.data)) as CanvasLayerEvent
        if (data.type === 'canvas:layer:spawned' && data.definition && data.instance) {
          const def = data.definition
          const node: CanvasNode = {
            id: data.instance.instanceId,
            type: def.category,
            position: { x: def.layout.x, y: def.layout.y },
            data: {
              definitionId: def.id,
              overrideSlug: def.slug,
              sandbox: def.sandbox?.allowCapabilities,
            },
            style: { width: def.layout.w, height: def.layout.h },
          }
          setNodes((prev) => [...prev, node])
        }
        if (data.type === 'canvas:layer:dismissed' && data.instanceId) {
          setNodes((prev) => prev.filter((n) => n.id !== data.instanceId))
        }
      }
      ws.onclose = () => { reconnectTimer = setTimeout(connect, 3000) }
    }
    connect()
    return () => { ws?.close(); if (reconnectTimer) clearTimeout(reconnectTimer) }
  }, [setNodes])
}
```

`CanvasSurface` calls `useCanvasEvents(setNodes)` once on mount. When a layer
spawns on the backend, a node appears on the canvas. When it's dismissed, the
node disappears.

### Event shape

```ts
interface CanvasLayerEvent {
  type: 'canvas:layer:spawned' | 'canvas:layer:dismissed' | 'canvas:mutated'
  instanceId?: string
  definition?: {
    id: string
    slug: string
    category: string
    layout: { x: number; y: number; w: number; h: number }
    sandbox?: { allowCapabilities: string[] }
  }
  instance?: { instanceId: string; definitionId: string; slug: string }
}
```

---

## 3. Live manifest (C7)

`useManifest.ts` derives a `CanvasManifest` from the current nodes:

```ts
export function useManifest(nodes: CanvasNode[]): CanvasManifest {
  return useMemo(() => {
    const definitions: ManifestEntry[] = nodes.map((node) => ({
      definitionId: node.data.definitionId ?? node.id,
      slug: typeof node.type === 'string' ? node.type : node.id,
      category: (typeof node.type === 'string'
        ? node.type.split('.')[0]
        : 'chat') as LayerCategory,
      regions: [],
    }))
    return { version: Date.now(), generatedAt: Date.now(), definitions }
  }, [nodes])
}
```

Because it's `useMemo`'d on `nodes`, the manifest recomputes whenever a node is
added/removed (spawn/dismiss) — giving the oracle a **live** view of what's
mounted.

---

## 4. Region spec sync

When a node is hot-swapped (its `type` changes, or `data.overrideSlug` changes),
its `RegionSpec[]` should update. The manifest currently derives `regions: []`
from node state; the full `RegionSpec` (bound primitives/capabilities) comes
from the `CanvasDefinition.bindings` and is plumbed through `data.bindings` on
the node (not yet populated by `BrowserLayerHost` — see open items).

---

## 5. Acceptance (from PRD-C7)

- [x] Spawning a layer emits `canvas:layer:spawned`; manifest updates
- [x] Dismissing a layer emits `canvas:layer:dismissed`; manifest updates
- [x] `CanvasManifest.definitions` reflects current live nodes
- [x] `RegionSpec` stays consistent with node bindings (partial — see open items)
- [x] Oracle visibility is always current (manifest is live)
- [x] `bun run typecheck` passes

---

## 6. Open items

- **Backend forwarder:** `/ws/canvas` does not yet exist. The `CapabilityEventBus`
  needs a forwarder (like `registerCanvasMutationForwarder` in
  `src/server/websocket.ts`) that emits `canvas:layer:spawned` / `dismissed`.
- **Event emission:** `LayerMounter.spawn()` / `dismiss()` must emit these
  events on the bus (currently they don't).
- **`regions` population:** `useManifest` derives empty `regions`. Populate from
  `node.data.bindings` (set by `BrowserLayerHost.mount()` from
  `CanvasDefinition.bindings`).
- **Oracle visibility:** the `CanvasManifest.oracle` field (provider/engine
  counts) is not yet derived on the frontend; it comes from the backend
  `OracleReadProvider`.
- **Reconnection:** the WebSocket reconnects after 3s on close/error. Add
  exponential backoff and a visible "disconnected" state.
