// web/ui/src/ui/defaults/DefaultSettings.tsx
// Default fallback renderer for settings primitive.
// Registered in UIComponentRegistry as fallback when fromSystemDefault: true.

import type { ReactNode } from 'react'

interface DefaultSettingsProps {
  slotId?: string
  [key: string]: unknown
}

export function DefaultSettings({ slotId }: DefaultSettingsProps): ReactNode {
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
      <span style={{ fontSize: 18 }}>{'\u2699\uFE0F'}</span>
      <span>Settings {slotId ? `(${slotId})` : ''}</span>
    </div>
  )
}
