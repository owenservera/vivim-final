// web/ui/src/ui/defaults/actionBar.tsx
// chat.actionBar — renders capability action buttons. Each button dispatches
// through the ActionRegistry by id (B8 — One Entry Point invariant).

import { ActionTrigger } from '../../components/action-trigger.js'
import type { ActionBarProps } from './types.js'

export function ActionBar({ actions }: ActionBarProps) {
  if (!actions || actions.length === 0) return null
  return (
    <div style={{ display: 'flex', gap: 8, padding: '0 14px 8px', flexWrap: 'wrap' }}>
      {actions.map((a) => (
        <ActionTrigger key={a.id} actionId={a.id} params={a.params}>
          <span
            style={{
              display: 'inline-block',
              border: '1px solid #e5e7eb',
              borderRadius: 8,
              padding: '4px 10px',
              fontSize: 12,
              cursor: 'pointer',
              color: '#374151',
            }}
          >
            {a.label}
          </span>
        </ActionTrigger>
      ))}
    </div>
  )
}
