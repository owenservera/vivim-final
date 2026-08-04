// frontend/src/components/KeyboardShortcutsPanel.tsx
// Keyboard shortcuts help panel (Ctrl+/ to open).
'use client'

import { useState, useEffect, useCallback } from 'react'
import { useFocusTrap } from '@/hooks/useFocusTrap'

interface Shortcut {
  keys: string
  description: string
}

const SHORTCUTS: Shortcut[] = [
  { keys: 'Ctrl+K', description: 'Command palette' },
  { keys: 'Ctrl+/', description: 'Keyboard shortcuts' },
  { keys: 'Ctrl+\\', description: 'Dev console' },
  { keys: 'Ctrl+Tab', description: 'Next surface' },
  { keys: 'Ctrl+Shift+Tab', description: 'Previous surface' },
  { keys: 'Escape', description: 'Close modal/panel' },
  { keys: 'Ctrl+N', description: 'New conversation' },
  { keys: 'Ctrl+Shift+P', description: 'Command palette (alt)' },
]

export function KeyboardShortcutsPanel() {
  const [open, setOpen] = useState(false)
  const trapRef = useFocusTrap<HTMLDivElement>({ active: open })

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === '/' && (e.ctrlKey || e.metaKey) && !e.shiftKey) {
      e.preventDefault()
      setOpen((prev) => !prev)
    }
    if (e.key === 'Escape' && open) {
      setOpen(false)
    }
  }, [open])

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  if (!open) return null

  return (
    <div
      ref={trapRef}
      role="dialog"
      aria-label="Keyboard shortcuts"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.4)',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) setOpen(false) }}
    >
      <div style={{
        background: 'var(--bg, #fff)',
        border: '1px solid var(--border, #e5e7eb)',
        borderRadius: 12,
        padding: 24,
        maxWidth: 400,
        width: '90%',
        maxHeight: '80vh',
        overflow: 'auto',
        boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
      }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>
          Keyboard Shortcuts
        </h2>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <tbody>
            {SHORTCUTS.map((s) => (
              <tr key={s.keys} style={{ borderBottom: '1px solid var(--border, #e5e7eb)' }}>
                <td style={{ padding: '8px 0', fontSize: 13, color: 'var(--text-muted, #6b7280)' }}>
                  {s.description}
                </td>
                <td style={{ padding: '8px 0', textAlign: 'right' }}>
                  <kbd style={{
                    padding: '2px 8px',
                    background: 'var(--bg-subtle, #f3f4f6)',
                    border: '1px solid var(--border, #e5e7eb)',
                    borderRadius: 4,
                    fontSize: 12,
                    fontFamily: 'var(--font-mono, monospace)',
                  }}>
                    {s.keys}
                  </kbd>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <button
          onClick={() => setOpen(false)}
          style={{
            marginTop: 16,
            width: '100%',
            padding: '8px 16px',
            border: '1px solid var(--border, #e5e7eb)',
            borderRadius: 6,
            background: 'var(--bg, #fff)',
            cursor: 'pointer',
            fontSize: 13,
          }}
        >
          Close (Esc)
        </button>
      </div>
    </div>
  )
}
