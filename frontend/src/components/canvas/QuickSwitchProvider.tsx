// frontend/src/components/canvas/QuickSwitchProvider.tsx
// Keyboard-driven provider switcher (Ctrl+Shift+P opens, arrow keys cycle).
'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useFocusTrap } from '@/hooks/useFocusTrap'

interface Provider {
  id: string
  name: string
  icon: string
  connected: boolean
}

interface QuickSwitchProviderProps {
  providers: Provider[]
  activeProviderId: string
  onSwitch: (providerId: string) => void
}

export function QuickSwitchProvider({ providers, activeProviderId, onSwitch }: QuickSwitchProviderProps) {
  const [open, setOpen] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const trapRef = useFocusTrap<HTMLDivElement>({ active: open })

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'P' && (e.ctrlKey || e.metaKey) && e.shiftKey) {
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

  useEffect(() => {
    if (!open) return
    const idx = providers.findIndex((p) => p.id === activeProviderId)
    setSelectedIndex(idx >= 0 ? idx : 0)
  }, [open, providers, activeProviderId])

  if (!open) return null

  return (
    <div
      onClick={() => setOpen(false)}
      style={{
        position: 'fixed', inset: 0, zIndex: 10000,
        background: 'rgba(0,0,0,0.3)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        paddingTop: '20vh',
      }}
    >
      <div
        ref={trapRef}
        onClick={(e) => e.stopPropagation()}
        role="listbox"
        aria-label="Switch provider"
        style={{
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border)',
          borderRadius: 8,
          padding: 4,
          minWidth: 200,
          boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
        }}
      >
        {providers.map((p, i) => (
          <button
            key={p.id}
            role="option"
            aria-selected={p.id === activeProviderId}
            onClick={() => { onSwitch(p.id); setOpen(false) }}
            style={{
              display: 'flex', alignItems: 'center', gap: 8, width: '100%',
              padding: '8px 12px', border: 'none',
              background: i === selectedIndex ? 'var(--accent-subtle)' : 'transparent',
              color: p.connected ? 'var(--text)' : 'var(--text-muted)',
              cursor: 'pointer', borderRadius: 4, textAlign: 'left',
              fontFamily: 'inherit', fontSize: 13,
            }}
          >
            <span>{p.icon}</span>
            <span style={{ flex: 1 }}>{p.name}</span>
            {p.id === activeProviderId && <span style={{ fontSize: 11 }}>✓</span>}
            {!p.connected && <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>disconnected</span>}
          </button>
        ))}
      </div>
    </div>
  )
}
