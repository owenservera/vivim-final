// frontend/src/hooks/useKeyboardNav.ts
// Global keyboard shortcut manager with scope support.
'use client'

import { useCallback, useEffect, useRef } from 'react'

type KeyCombo = {
  key: string
  ctrl?: boolean
  shift?: boolean
  alt?: boolean
  meta?: boolean
}

type Handler = (e: KeyboardEvent) => void

interface ShortcutRegistration {
  combo: KeyCombo
  handler: Handler
  description: string
}

const registry: ShortcutRegistration[] = []

export function registerShortcut(combo: KeyCombo, handler: Handler, description: string) {
  registry.push({ combo, handler, description })
  return () => {
    const idx = registry.findIndex((r) => r.handler === handler)
    if (idx >= 0) registry.splice(idx, 1)
  }
}

function matches(e: KeyboardEvent, combo: KeyCombo): boolean {
  if (e.key.toLowerCase() !== combo.key.toLowerCase()) return false
  if (combo.ctrl && !e.ctrlKey && !e.metaKey) return false
  if (combo.shift && !e.shiftKey) return false
  if (combo.alt && !e.altKey) return false
  if (combo.meta && !e.metaKey) return false
  return true
}

export function useKeyboardNav() {
  const handlersRef = useRef<Map<string, Handler>>(new Map())

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Skip if inside input/textarea/select
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return

      for (const reg of registry) {
        if (matches(e, reg.combo)) {
          e.preventDefault()
          reg.handler(e)
          return
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  const bind = useCallback((combo: KeyCombo, handler: Handler, description: string) => {
    const id = `${combo.key}-${combo.ctrl}-${combo.shift}-${combo.alt}-${combo.meta}`
    handlersRef.current.set(id, handler)
    return registerShortcut(combo, handler, description)
  }, [])

  return { bind }
}
