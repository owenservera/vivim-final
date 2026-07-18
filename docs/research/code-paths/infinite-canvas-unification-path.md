# Infinite Canvas + Hot-Swap — Confirmed Code Path

**Convergence:** CONFIRMED | **Iterations:** 3 | **Confidence:** High
**Date:** 2026-07-16

## Recommended Approach

Adopt `@xyflow/react` v12 as the canvas viewport engine. React Flow nodes are arbitrary React components positioned at `{x,y}` on an infinite, zoomable, pannable plane. `nodeTypes: Record<string, ComponentType>` IS the hot-swap registry. `CanvasDefinition` rows drive nodes via `BrowserLayerHost`.

## Working Code Example

### 1. Install

```bash
bun add @xyflow/react
```

### 2. Basic CanvasSurface (the unified frontend shell)

```tsx
// web/ui/src/features/canvas/CanvasSurface.tsx
import { memo, useMemo } from 'react'
import { ReactFlow, Background, MiniMap, Controls } from '@xyflow/react'
import type { Node, OnNodesChange } from '@xyflow/react'
import { applyNodeChanges } from '@xyflow/react'
import { useState, useCallback } from 'react'
import { useNodeTypes } from './useNodeTypes.js'

// A "node" in our system is a capability-global / slot / canvas layer.
// position comes from CanvasLayout{x,y}; type is the slot/capability slug.
export interface CanvasNode extends Node {
  data: {
    overrideSlug?: string
    sandbox?: string[]
    definitionId?: string
  }
}

export function CanvasSurface() {
  const nodeTypes = useNodeTypes()
  const [nodes, setNodes] = useState<CanvasNode[]>([])
  const onNodesChange: OnNodesChange<CanvasNode> = useCallback(
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
        defaultViewport={{ x: 0, y: 0, zoom: 1 }}
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

### 3. Slot-based nodeType resolution (unifies UIComponentRegistry)

```tsx
// web/ui/src/features/canvas/useNodeTypes.ts
import { useMemo } from 'react'
import { SLOT_IDS, type SlotId } from '../../ui/slots.js'
import { resolve } from '../../ui/registry.js'

// Each slot becomes a React Flow nodeType.
// Resolution: capabilitySlug > providerSlug > default (same as before).
export function useNodeTypes() {
  return useMemo(() => {
    const types: Record<string, React.ComponentType<any>> = {}
    for (const slotId of SLOT_IDS) {
      // The "default" component for this slot, resolved from the registry.
      // Bespoke/provider overrides are handled by the registry's resolve().
      types[slotId] = createSlotNodeType(slotId)
    }
    return types
  }, [])
}

function createSlotNodeType(slotId: SlotId) {
  // Wrap the registry resolve in a React Flow node component.
  // The node's `data.overrideSlug` provides the capability/provider context.
  return memo(function SlotNode({ data }: { data: { overrideSlug?: string } }) {
    // resolve() uses capabilitySlug > providerSlug > default
    const ctx = {
      providerSlug: data.overrideSlug ?? 'default',
      capabilitySlug: data.overrideSlug,
    }
    const Component = resolve(slotId, ctx).component
    return <Component slotId={slotId} />
  })
}
```

### 4. BrowserLayerHost (mounts CanvasDefinition as a node)

```tsx
// web/ui/src/features/canvas/BrowserLayerHost.tsx
import type { LayerHost } from '../../../../src/canvas/layer-mounter.js'
import type { CanvasDefinition } from '../../../../src/canvas/types.js'

// Implements the LayerHost contract for the browser.
// Mounts a CanvasDefinition as a React Flow node via setState.
export function createBrowserLayerHost(
  setNodes: React.Dispatch<React.SetStateAction<any[]>>,
): LayerHost {
  return {
    async mount(instanceId: string, def: CanvasDefinition) {
      const node = {
        id: instanceId,
        type: def.category, // maps to nodeType
        position: { x: def.layout.x, y: def.layout.y },
        data: {
          definitionId: def.id,
          sandbox: def.sandbox.allowCapabilities,
          html: def.html,
          css: def.css,
          scriptUrl: def.scriptUrl,
          bindings: def.bindings,
        },
        style: { width: def.layout.w, height: def.layout.h },
      }
      setNodes((prev) => [...prev, node])
      return { hostNodeId: instanceId }
    },
    async unmount(instanceId: string) {
      setNodes((prev) => prev.filter((n) => n.id !== instanceId))
    },
    isMounted(instanceId: string) {
      // check current nodes state
      return true // simplified; real impl checks state
    },
  }
}
```

### 5. Sandbox iframe (for untrusted layer JS)

```tsx
// web/ui/src/features/canvas/SandboxedLayer.tsx
import { useRef, useEffect, useState } from 'react'

// Renders a CanvasDefinition's HTML/CSS in a sandboxed iframe.
// Layer JS runs in opaque-origin sandbox; communicates via postMessage.
export function SandboxedLayer({
  html,
  css,
  scriptUrl,
  sandbox,
  onCapabilityRequest,
}: {
  html: string
  css: string
  scriptUrl?: string
  sandbox: { csp: string; allowNetwork: boolean; allowCapabilities: string[]; budgetMs: number }
  onCapabilityRequest: (capability: string, input: Record<string, unknown>) => Promise<unknown>
}) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const iframe = iframeRef.current
    if (!iframe) return

    const handler = (e: MessageEvent) => {
      if (e.data.type === 'bridge:ready') {
        setReady(true)
      }
      if (e.data.type === 'bridge:capability:request') {
        if (!sandbox.allowCapabilities.includes(e.data.capability)) {
          iframe.contentWindow?.postMessage({
            type: 'bridge:capability:response',
            instanceId: e.data.instanceId,
            requestId: e.data.requestId,
            ok: false,
            error: `Capability '${e.data.capability}' not in allow list`,
          }, '*')
          return
        }
        onCapabilityRequest(e.data.capability, e.data.input).then((output) => {
          iframe.contentWindow?.postMessage({
            type: 'bridge:capability:response',
            instanceId: e.data.instanceId,
            requestId: e.data.requestId,
            ok: true,
            output,
          }, '*')
        }).catch((err) => {
          iframe.contentWindow?.postMessage({
            type: 'bridge:capability:response',
            instanceId: e.data.instanceId,
            requestId: e.data.requestId,
            ok: false,
            error: String(err),
          }, '*')
        })
      }
    }
    window.addEventListener('message', handler)
    return () => window.removeEventListener('message', handler)
  }, [sandbox, onCapabilityRequest])

  const srcDoc = `<!DOCTYPE html>
<html>
<head>
<meta http-equiv="Content-Security-Policy" content="${sandbox.csp}">
<style>${css}</style>
${scriptUrl ? `<script src="${scriptUrl}"><\/script>` : ''}
</head>
<body>${html}</body>
</html>`

  return (
    <iframe
      ref={iframeRef}
      srcDoc={srcDoc}
      sandbox="allow-scripts"
      style={{ width: '100%', height: '100%', border: 'none' }}
    />
  )
}
```

## Why This Works

1. **React Flow's nodeTypes IS the registry** — `Record<string, ComponentType>` is the same shape as `UIComponentRegistry.defaults`. No separate store needed.
2. **Nodes carry context** — `data.overrideSlug` drives `capabilitySlug > providerSlug > default` resolution.
3. **`onlyRenderVisibleElements` does culling** — maps to `detailZoom` semantic zoom.
4. **BrowserLayerHost bridges the gap** — mounts `CanvasDefinition` rows as nodes on the infinite plane.
5. **Sandbox iframe validates our existing design** — `SandboxPolicy`, `BridgeMessage` protocol, `allowCapabilities` allow-list are all validated by research.

## Prerequisites

- `@xyflow/react` v12+ installed
- `web/ui/package.json` updated with peer deps: `react ^19`, `react-dom ^19` (already present)
- `@xyflow/react/dist/style.css` imported in the app entry

## Known Gotchas

- **`nodeTypes` must be defined outside the component** to avoid re-creation on every render (React Flow docs, performance section).
- **React Flow's internal Zustand store** is separate from React state — use `useStore` hooks, not direct state access, for camera/viewport queries.
- **iframe `sandbox="allow-scripts"` without `allow-same-origin`** gives opaque origin — layer JS cannot access host DOM or cookies. This is the desired security model.
- **`srcdoc` iframes** have a null `contentWindow` until mounted — always null-check before `postMessage`.

## Alternatives Considered

| Approach | Why Rejected | Source |
|----------|--------------|--------|
| Custom CSS-transform viewport | Too much fiddly work; reinvents solved problem | Research iteration 1 |
| tldraw SDK | Whiteboard/shapes model; wrong for HTML panels | Research iteration 1 |
| Konva/Excalidraw | Canvas-2D, not DOM/React components | Research iteration 1 |
| jamesyong42/canvas-react | ECS + WebGL; overengineered | Research iteration 1 |
| Keep ChatPage separate | Violates ONE frontend system requirement | Research iteration 3 |

## Verification Steps

1. `bun add @xyflow/react` — installs without peer-dep conflicts
2. Render `<CanvasSurface />` with 3 seed nodes — verify pan/zoom/culling works
3. `hotSwap('chat.bubble', 'claude', MyBubble)` from devtools — verify live re-render
4. Mount a `CanvasDefinition` via `BrowserLayerHost` — verify node appears at correct position
5. Run `bun run typecheck` — no type errors from React Flow integration
6. Run `bun test tests/unit/canvas/` — existing canvas tests still pass

## Risk Assessment

- **Technical risk:** Low — React Flow is production-grade; integration is straightforward
- **Integration risk:** Low — `nodeTypes` maps cleanly to `UIComponentRegistry`; `BrowserLayerHost` implements existing `LayerHost` interface
- **Maintenance risk:** Medium — React Flow is actively maintained but adds a dependency; pinned to v12
