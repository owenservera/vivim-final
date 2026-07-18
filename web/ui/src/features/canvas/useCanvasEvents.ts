// web/ui/src/features/canvas/useCanvasEvents.ts
// Subscribes to canvas layer events via WebSocket (PRD-C7).
// When a layer spawns or dismisses, updates the React Flow nodes.
// Replaces static manifest with live EventBus-driven updates.

import { useEffect, useCallback } from 'react'
import type { CanvasNode } from './CanvasSurface.js'

type SetNodes = React.Dispatch<React.SetStateAction<CanvasNode[]>>

interface CanvasLayerEvent {
  type: 'canvas:layer:spawned' | 'canvas:layer:dismissed' | 'canvas:layer:moved' | 'canvas:mutated'
  instanceId?: string
  definition?: {
    id: string
    slug: string
    category: string
    layout: { x: number; y: number; z: number; w: number; h: number }
    sandbox?: { allowCapabilities: string[] }
  }
  instance?: {
    instanceId: string
    definitionId: string
    slug: string
  }
}

/**
 * Subscribe to canvas layer events via WebSocket.
 * On spawn: adds a node. On dismiss: removes a node.
 */
export function useCanvasEvents(setNodes: SetNodes): void {
  const handleMessage = useCallback(
    (event: MessageEvent) => {
      try {
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
              z: def.layout.z ?? 0,
            },
            style: { width: def.layout.w, height: def.layout.h },
          }
          setNodes((prev) => [...prev, node])
        }

        if (data.type === 'canvas:layer:dismissed' && data.instanceId) {
          setNodes((prev) => prev.filter((n) => n.id !== data.instanceId))
        }

        if (data.type === 'canvas:layer:moved' && data.instanceId && data.definition) {
          setNodes((prev) =>
            prev.map((n) =>
              n.id === data.instanceId
                ? {
                    ...n,
                    position: {
                      x: data.definition!.layout.x,
                      y: data.definition!.layout.y,
                    },
                    data: {
                      ...n.data,
                      z: data.definition!.layout.z ?? n.data.z ?? 0,
                    },
                    style: data.definition!.layout.w
                      ? { width: data.definition!.layout.w, height: data.definition!.layout.h }
                      : n.style,
                  }
                : n,
            ),
          )
        }
      } catch {
        // ignore malformed messages
      }
    },
    [setNodes],
  )

  useEffect(() => {
    let ws: WebSocket | null = null
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null

    function connect() {
      try {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
        ws = new WebSocket(`${protocol}//${window.location.host}/ws/canvas`)
        ws.onmessage = handleMessage
        ws.onerror = () => {
          // reconnect after delay
          reconnectTimer = setTimeout(connect, 3000)
        }
        ws.onclose = () => {
          reconnectTimer = setTimeout(connect, 3000)
        }
      } catch {
        reconnectTimer = setTimeout(connect, 3000)
      }
    }

    connect()

    return () => {
      ws?.close()
      if (reconnectTimer) clearTimeout(reconnectTimer)
    }
  }, [handleMessage])
}
