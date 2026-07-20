// web/ui/src/features/canvas/ZoomNode.tsx
// Wraps any slot node with zoom-tier-dependent rendering (PRD-C2 §3.3).
// At zoom < 0.3: renders a colored dot (map-dot placeholder).
// At 0.3 <= zoom < 0.8: renders a title card (name + icon).
// At zoom >= 0.8: renders full HTML/CSS/iframe content.

import type { ReactNode } from 'react'
import { useZoomTier, type ZoomTier } from './useZoomLevel.js'

interface ZoomNodeProps {
  /** The slot/capability name shown in card/dot modes. */
  label: string
  /** A single-char icon or emoji for dot/card modes. */
  icon?: string
  /** Category color for the dot background. */
  color?: string
  /** Full content rendered at zoom >= 0.8. */
  children: ReactNode
}

/**
 * Conditional renderer based on zoom tier.
 * Wraps children in a tier-appropriate representation.
 */
export function ZoomNode({ label, icon, color, children }: ZoomNodeProps) {
  const tier = useZoomTier()

  switch (tier) {
    case 'dot':
      return <DotNode label={label} color={color} />
    case 'card':
      return <CardNode label={label} icon={icon} color={color} />
    case 'full':
    default:
      return <>{children}</>
  }
}

function DotNode({ label, color }: { label: string; color?: string }) {
  return (
    <div
      title={label}
      style={{
        width: 12,
        height: 12,
        borderRadius: '50%',
        backgroundColor: color ?? '#6366f1',
      }}
    />
  )
}

function CardNode({
  label,
  icon,
  color,
}: {
  label: string
  icon?: string
  color?: string
}) {
  return (
    <div
      style={{
        padding: '8px 12px',
        borderRadius: 8,
        border: '1px solid #374151',
        background: '#111827',
        color: '#e5e7eb',
        fontSize: 13,
        fontWeight: 500,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        minWidth: 120,
        minHeight: 40,
      }}
    >
      {icon && <span style={{ fontSize: 16 }}>{icon}</span>}
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          backgroundColor: color ?? '#6366f1',
          flexShrink: 0,
        }}
      />
      {label}
    </div>
  )
}
