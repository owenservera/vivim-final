// web/ui/src/ui/defaults/overlays.tsx
// chat.confirm / chat.error defaults (overlay + toast surfaces).

import type { ConfirmProps, ErrorProps } from './types.js'

/** chat.error default — thin error bar above the composer. */
export function ErrorBar({ message }: ErrorProps) {
  if (!message) return null
  return (
    <div style={{ padding: '6px 14px', background: '#fef2f2', color: '#b91c1c', fontSize: 12 }}>
      {message}
    </div>
  )
}

/** chat.confirm default — modal confirmation for destructive ops. */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  onConfirm,
  onCancel,
}: ConfirmProps) {
  if (!open) return null
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.35)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 50,
      }}
    >
      <div style={{ background: '#fff', borderRadius: 12, padding: 20, maxWidth: 360, width: '90%' }}>
        <h3 style={{ margin: '0 0 8px', fontSize: 15 }}>{title}</h3>
        <p style={{ margin: '0 0 16px', fontSize: 13, color: '#374151' }}>{message}</p>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={onCancel}
            style={{
              border: '1px solid #d1d5db',
              background: '#fff',
              borderRadius: 8,
              padding: '8px 14px',
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            style={{
              border: 'none',
              background: '#b91c1c',
              color: '#fff',
              borderRadius: 8,
              padding: '8px 14px',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
