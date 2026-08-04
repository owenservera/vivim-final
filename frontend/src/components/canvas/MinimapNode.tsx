// components/canvas/MinimapNode.tsx
// Miniature viewport indicator for the canvas minimap. Shows a small
// rectangle representing a node's position in world space, with color
// coding for node type and hover-to-select.

'use client'

import { useCallback } from 'react'
import type { BoundingBox } from './quad-tree'

export interface MinimapNodeProps {
  /** Node bounding box in world coordinates. */
  bounds: BoundingBox
  /** Node type for color coding. */
  nodeType?: string
  /** Whether this node is currently selected. */
  selected?: boolean
  /** Scale factor from world to minimap pixels. */
  scale: number
  /** Offset to apply (minimap viewport origin). */
  offset: { x: number; y: number }
  /** Callback when the node is clicked in the minimap. */
  onSelect?: (nodeId: string) => void
  /** Node ID for the select callback. */
  nodeId?: string
}

const NODE_COLORS: Record<string, string> = {
  doc: 'var(--color-info)',
  media: 'var(--color-purple)',
  automation: 'var(--color-success)',
  agent: 'var(--color-warning)',
  shell: 'var(--color-error)',
  default: 'var(--text-muted)',
}

export function MinimapNode({
  bounds,
  nodeType = 'default',
  selected = false,
  scale,
  offset,
  onSelect,
  nodeId,
}: MinimapNodeProps) {
  const color = NODE_COLORS[nodeType] ?? NODE_COLORS.default

  const handleClick = useCallback(() => {
    if (nodeId && onSelect) onSelect(nodeId)
  }, [nodeId, onSelect])

  const x = bounds.x * scale + offset.x
  const y = bounds.y * scale + offset.y
  const w = Math.max(bounds.width * scale, 2)
  const h = Math.max(bounds.height * scale, 2)

  return (
    <rect
      x={x}
      y={y}
      width={w}
      height={h}
      rx={1}
      fill={color}
      fillOpacity={selected ? 0.9 : 0.5}
      stroke={selected ? 'var(--bg)' : 'none'}
      strokeWidth={selected ? 1 : 0}
      style={{ cursor: onSelect ? 'pointer' : 'default' }}
      onClick={handleClick}
    />
  )
}
