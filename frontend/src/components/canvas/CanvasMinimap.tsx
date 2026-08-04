'use client'

import type { CanvasNode, CanvasPalette, Viewport } from '@/canvas/types'
import { useCallback, useMemo } from 'react'

export interface CanvasMinimapProps {
  nodes: CanvasNode[]
  viewport: Viewport
  containerSize: { w: number; h: number }
  palette: CanvasPalette
  onNavigate: (x: number, y: number, scale: number) => void
  size?: number
}

/**
 * CanvasMinimap — bird's-eye overview of all nodes.
 * Click to navigate; shows viewport rectangle.
 */
export function CanvasMinimap({
  nodes,
  viewport,
  containerSize,
  palette,
  onNavigate,
  size = 160,
}: CanvasMinimapProps) {
  const padding = 8

  const worldBounds = useMemo(() => {
    if (nodes.length === 0) return { minX: 0, minY: 0, maxX: 320, maxY: 240 }
    let minX = Number.POSITIVE_INFINITY
    let minY = Number.POSITIVE_INFINITY
    let maxX = Number.NEGATIVE_INFINITY
    let maxY = Number.NEGATIVE_INFINITY
    for (const n of nodes) {
      minX = Math.min(minX, n.position.x)
      minY = Math.min(minY, n.position.y)
      maxX = Math.max(maxX, n.position.x + (n.size?.x ?? 320))
      maxY = Math.max(maxY, n.position.y + (n.size?.y ?? 200))
    }
    return {
      minX: minX - 50,
      minY: minY - 50,
      maxX: maxX + 50,
      maxY: maxY + 50,
    }
  }, [nodes])

  const worldW = worldBounds.maxX - worldBounds.minX || 1
  const worldH = worldBounds.maxY - worldBounds.minY || 1
  const minimapScale = Math.min((size - padding * 2) / worldW, (size - padding * 2) / worldH)

  const toMinimap = useCallback(
    (cx: number, cy: number) => ({
      x: (cx - worldBounds.minX) * minimapScale + padding,
      y: (cy - worldBounds.minY) * minimapScale + padding,
    }),
    [worldBounds, minimapScale],
  )

  const vpRect = useMemo(() => {
    const vpW = containerSize.w / viewport.scale
    const vpH = containerSize.h / viewport.scale
    const topLeft = toMinimap(viewport.origin.x, viewport.origin.y)
    return {
      x: topLeft.x,
      y: topLeft.y,
      w: vpW * minimapScale,
      h: vpH * minimapScale,
    }
  }, [viewport, containerSize, minimapScale, toMinimap])

  const handleClick = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      const rect = e.currentTarget.getBoundingClientRect()
      const mx = e.clientX - rect.left
      const my = e.clientY - rect.top
      const canvasX = (mx - padding) / minimapScale + worldBounds.minX
      const canvasY = (my - padding) / minimapScale + worldBounds.minY
      onNavigate(
        canvasX - containerSize.w / viewport.scale / 2,
        canvasY - containerSize.h / viewport.scale / 2,
        viewport.scale,
      )
    },
    [minimapScale, worldBounds, containerSize, viewport, onNavigate],
  )

  if (nodes.length === 0) return null

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      onClick={handleClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          // Simulate click at center
          const synthetic = {
            clientX: 0,
            clientY: 0,
            currentTarget: e.currentTarget,
          } as unknown as React.MouseEvent<SVGSVGElement>;
          // Use the center of the SVG as click target
          const rect = e.currentTarget.getBoundingClientRect();
          synthetic.clientX = rect.left + size / 2;
          synthetic.clientY = rect.top + size / 2;
          handleClick(synthetic);
        }
      }}
      role="button"
      tabIndex={0}
      aria-label="Canvas minimap — click to navigate"
      style={{
        position: 'absolute',
        bottom: 12,
        right: 12,
        borderRadius: 8,
        border: `1px solid ${palette.border}`,
        background: palette.surface,
        cursor: 'crosshair',
        opacity: 0.9,
        pointerEvents: 'auto',
      }}
    >
      {nodes.map((n) => {
        const pos = toMinimap(n.position.x, n.position.y)
        const color = palette.nodeByCategory[(n.data.category as string) ?? ''] ?? palette.accent
        return (
          <rect
            key={n.id}
            x={pos.x}
            y={pos.y}
            width={Math.max((n.size?.x ?? 320) * minimapScale, 4)}
            height={Math.max((n.size?.y ?? 200) * minimapScale, 3)}
            rx={2}
            fill={color}
            opacity={0.6}
          />
        )
      })}
      <rect
        x={vpRect.x}
        y={vpRect.y}
        width={vpRect.w}
        height={vpRect.h}
        fill="none"
        stroke={palette.accent}
        strokeWidth={1.5}
        strokeDasharray="3 2"
        opacity={0.8}
      />
    </svg>
  )
}
