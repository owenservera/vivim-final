// web/ui/src/features/canvas/useKeyboardShortcuts.ts
// Global keyboard shortcuts reading from UnifiedCapability.ui.shortcut.
// Registers keydown handler. Show shortcut overlay on pressing '?'.
// v2: full registry (register/unregister), ignore-in-input, number key jump.

import { useEffect, useCallback, useRef, useState } from 'react'

export interface ShortcutBinding {
  key: string
  ctrl?: boolean
  shift?: boolean
  alt?: boolean
  meta?: boolean
  action: () => void
  description: string
}

interface ShortcutRegistryEntry extends ShortcutBinding {
  id: string
}

let globalId = 0

export interface KeyboardShortcutsAPI {
  register: (shortcut: ShortcutBinding) => () => void
  unregister: (id: string) => void
}

export interface KeyboardShortcutsState {
  showShortcutOverlay: boolean
  toggleOverlay: () => void
  api: KeyboardShortcutsAPI
}

function isInputFocused(): boolean {
  const el = document.activeElement
  if (!el) return false
  const tag = el.tagName.toLowerCase()
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return true
  if ((el as HTMLElement).isContentEditable) return true
  if (el.getAttribute('role') === 'textbox' || el.getAttribute('role') === 'searchbox') return true
  if (el.closest('[contenteditable="true"]')) return true
  return false
}

export function useKeyboardShortcuts(
  opts: { shortcuts: ShortcutBinding[] } | ShortcutBinding[],
): KeyboardShortcutsState {
  const initialShortcuts = Array.isArray(opts) ? opts : opts.shortcuts
  const [showOverlay, setShowOverlay] = useState(false)
  const registryRef = useRef<Map<string, ShortcutRegistryEntry>>(new Map())

  // Initial registration
  useEffect(() => {
    for (const s of initialShortcuts) {
      const id = `shortcut:${++globalId}`
      registryRef.current.set(id, { ...s, id })
    }
  }, [])

  const register = useCallback((shortcut: ShortcutBinding): (() => void) => {
    const id = `shortcut:${++globalId}`
    registryRef.current.set(id, { ...shortcut, id })
    return () => { registryRef.current.delete(id) }
  }, [])

  const unregister = useCallback((id: string) => {
    registryRef.current.delete(id)
  }, [])

  const toggleOverlay = useCallback(() => {
    setShowOverlay((prev) => !prev)
  }, [])

  useEffect(() => {
    const handler = (e: KeyboardEvent): void => {
      // Ignore when user is typing in an input
      if (isInputFocused()) return

      // Toggle shortcut overlay on '?' (without modifiers)
      if (e.key === '?' && !e.ctrlKey && !e.altKey && !e.metaKey) {
        e.preventDefault()
        toggleOverlay()
        return
      }

      // Exit overlay on Escape
      if (e.key === 'Escape') {
        setShowOverlay(false)
      }

      for (const s of registryRef.current.values()) {
        const keyMatch = e.key.toLowerCase() === s.key.toLowerCase()
        const ctrlMatch = s.ctrl ? (e.ctrlKey || e.metaKey) : !e.ctrlKey && !e.metaKey
        const shiftMatch = s.shift ? e.shiftKey : !e.shiftKey
        const altMatch = s.alt ? e.altKey : !e.altKey

        if (keyMatch && ctrlMatch && shiftMatch && altMatch) {
          e.preventDefault()
          s.action()
          return
        }
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [toggleOverlay])

  return { showShortcutOverlay: showOverlay, toggleOverlay, api: { register, unregister } }
}

/** Default canvas shortcuts */
export function getDefaultCanvasShortcuts(
  undo: () => void,
  redo: () => void,
): ShortcutBinding[] {
  return [
    { key: 'z', ctrl: true, action: undo, description: 'Undo' },
    { key: 'z', ctrl: true, shift: true, action: redo, description: 'Redo' },
  ]
}

export function ShortcutOverlay({ shortcuts }: { shortcuts: ShortcutBinding[] }): React.ReactNode {
  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 9995, fontFamily: 'system-ui, sans-serif',
      }}
    >
      <div style={{
        background: 'var(--bg-secondary, #1f2937)', borderRadius: 12,
        border: '1px solid var(--border-primary, #374151)', padding: 24,
        minWidth: 360, maxWidth: 520, color: 'var(--text-primary, #f9fafb)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>Keyboard Shortcuts</h3>
          <span style={{ fontSize: 12, color: 'var(--text-muted, #6b7280)' }}>Press Esc to close</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {shortcuts.map((s, idx) => (
            <div key={`${s.description}-${idx}`} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '6px 0', borderBottom: '1px solid var(--border-primary, #374151)',
              opacity: 0.9,
            }}>
              <span style={{ fontSize: 13 }}>{s.description}</span>
              <kbd style={{
                padding: '2px 8px', borderRadius: 4, background: 'var(--bg-tertiary, #374151)',
                fontSize: 12, fontFamily: 'monospace', minWidth: 60, textAlign: 'center',
              }}>
                {s.ctrl ? 'Ctrl+' : ''}{s.shift ? 'Shift+' : ''}{s.alt ? 'Alt+' : ''}{s.key.length === 1 ? s.key.toUpperCase() : s.key}
              </kbd>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
