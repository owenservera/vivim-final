// web/ui/src/ui/defaults/DefaultProjects.tsx
// Default fallback renderer for projects primitive.
// Registered in UIComponentRegistry as fallback when fromSystemDefault: true.

import type { ReactNode } from 'react'

interface DefaultProjectsProps {
  slotId?: string
  [key: string]: unknown
}

export function DefaultProjects({ slotId }: DefaultProjectsProps): ReactNode {
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
      <span style={{ fontSize: 18 }}>{'\uD83D\uDCC1'}</span>
      <span>Projects {slotId ? `(${slotId})` : ''}</span>
    </div>
  )
}
