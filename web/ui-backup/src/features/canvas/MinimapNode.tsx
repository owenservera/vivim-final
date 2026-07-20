// web/ui/src/features/canvas/MinimapNode.tsx
// Minimap overlay — renders a scaled-down view of all layers as colored rectangles
// in the bottom-right corner. Click to jump to a layer.
// v2: viewport highlight rectangle, zoom-based visibility (hidden when zoomed in > 50%).

import { useCallback, useMemo, type ReactNode } from 'react'
import type { CanvasNode } from './CanvasSurface.js'
import { useReactFlow, useStore } from '@xyflow/react'

const CATEGORY_COLORS: Record<string, string> = {
  chat: '#6366f1',
  system: '#10b981',
  automation: '#f59e0b',
  agents: '#8b5cf6',
  projects: '#3b82f6',
  knowledge: '#ec4899',
  designer: '#14b8a6',
  plugin: '#f97316',
}

interface MinimapNodeProps {
  nodes: CanvasNode[]
  bounds?: { minX: number; minY: number; maxX: number; maxY: number }
  width?: number
  height?: number
}

export function MinimapNode({ nodes, bounds, width = 160, height = 120 }: MinimapNodeProps): ReactNode {
  const { setCenter } = useReactFlow()
  const viewport = useStore((s) => s.transform)
  const viewportZoom = viewport[2]
  const viewportX = viewport[0]
  const viewportY = viewport[1]
  // Get viewport pixel dimensions from the store
  const vpW = useStore((s) => s.width)
  const vpH = useStore((s) => s.height)

  // Hidden when zoomed in past 50%
  if (viewportZoom > 0.5) return null

  const bbox = bounds ?? computeBounds(nodes)
  const mapW = bbox.maxX - bbox.minX || 1
  const mapH = bbox.maxY - bbox.minY || 1

  const jumpTo = useCallback(
    (x: number, y: number) => {
      setCenter(x + 50, y + 50, { zoom: 1, duration: 300 })
    },
    [setCenter],
  )

  // Viewport rectangle in minimap coordinates
  const vpScreenW = vpW / viewportZoom
  const vpScreenH = vpH / viewportZoom
  const vpRx = ((viewportX - bbox.minX) / mapW) * (width - 8) + 4
  const vpRy = ((viewportY - bbox.minY) / mapH) * (height - 8) + 4
  const vpRw = (vpScreenW / mapW) * (width - 8)
  const vpRh = (vpScreenH / mapH) * (height - 8)

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 16,
        right: 16,
        width,
        height,
        borderRadius: 8,
        border: '1px solid var(--border-primary, #374151)',
        background: 'var(--bg-secondary, #1f2937)',
        overflow: 'hidden',
        zIndex: 100,
        boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
      }}
    >
      <div
        style={{
          position: 'relative',
          width: '100%',
          height: '100%',
          padding: 4,
        }}
      >
        {/* Layer rectangles */}
        {nodes.map((node) => {
          const category = typeof node.type === 'string' ? node.type.split('.')[0] : 'chat'
          const color = CATEGORY_COLORS[category] ?? '#6b7280'
          const rx = ((node.position.x - bbox.minX) / mapW) * (width - 8)
          const ry = ((node.position.y - bbox.minY) / mapH) * (height - 8)
          const rw = Math.max(6, ((node.style?.width ?? 300) / mapW) * (width - 8))
          const rh = Math.max(4, ((node.style?.height ?? 200) / mapH) * (height - 8))
          return (
            <div
              key={node.id}
              title={node.id}
              onClick={() => jumpTo(node.position.x, node.position.y)}
              style={{
                position: 'absolute',
                left: rx + 4,
                top: ry + 4,
                width: rw,
                height: rh,
                borderRadius: 2,
                background: color,
                opacity: 0.7,
                cursor: 'pointer',
              }}
            />
          )
        })}

        {/* Viewport highlight rectangle */}
        <div
          style={{
            position: 'absolute',
            left: vpRx,
            top: vpRy,
            width: vpRw,
            height: vpRh,
            border: '1px solid rgba(255,255,255,0.5)',
            borderRadius: 2,
            pointerEvents: 'none',
            background: 'rgba(255,255,255,0.05)',
          }}
        />
      </div>
      <div
        style={{
          position: 'absolute',
          bottom: 2,
          left: 4,
          fontSize: 9,
          color: 'var(--text-muted, #6b7280)',
        }}
      >
        {nodes.length} layers
      </div>
    </div>
  )
}

function computeBounds(nodes: CanvasNode[]): { minX: number; minY: number; maxX: number; maxY: number } {
  if (nodes.length === 0) return { minX: -500, minY: -500, maxX: 1500, maxY: 1500 }
  let minX = Number.POSITIVE_INFINITY
  let minY = Number.POSITIVE_INFINITY
  let maxX = Number.NEGATIVE_INFINITY
  let maxY = Number.NEGATIVE_INFINITY
  for (const node of nodes) {
    const w = (node.style?.width as number) ?? 300
    const h = (node.style?.height as number) ?? 200
    if (node.position.x < minX) minX = node.position.x
    if (node.position.y < minY) minY = node.position.y
    if (node.position.x + w > maxX) maxX = node.position.x + w
    if (node.position.y + h > maxY) maxY = node.position.y + h
  }
  const padX = (maxX - minX) * 0.1 || 100
  const padY = (maxY - minY) * 0.1 || 100
  return { minX: minX - padX, minY: minY - padY, maxX: maxX + padX, maxY: maxY + padY }
}
