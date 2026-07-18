// web/ui/src/ui/defaults/DefaultKnowledge.tsx
// Default fallback renderer for knowledge primitive.
// Registered in UIComponentRegistry as fallback when fromSystemDefault: true.

import type { ReactNode } from 'react'

interface DefaultKnowledgeProps {
  slotId?: string
  [key: string]: unknown
}

export function DefaultKnowledge({ slotId }: DefaultKnowledgeProps): ReactNode {
  return (
    <div
      style={{
        padding: 16,
        borderRadius: 8,
        background: 'var(--bg-secondary, #1f2937)',
        border: '1px solid var(--border-primary, #374151)',
        color: 'var(--text-secondary, #d1d5db)',
        fontSize: 13,
        minHeight: 80,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
      }}
    >
      <span style={{ fontSize: 18 }}>{'\uD83D\uDCDA'}</span>
      <span>Knowledge {slotId ? `(${slotId})` : ''}</span>
    </div>
  )
}
