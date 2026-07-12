// web/sandbox/src/features/keyboard-shortcuts.tsx
// Unit 10.3 — Keyboard shortcuts + command palette

import { useEffect, useState, useCallback } from 'react'

export interface ShortcutBinding {
  id: string
  keys: string
  label: string
  scope: 'global' | 'conversation' | 'composer'
  action: () => void
}

const shortcuts = new Map<string, ShortcutBinding>()

export function registerShortcut(binding: ShortcutBinding): void {
  shortcuts.set(binding.keys.toLowerCase(), binding)
}

export function useKeyboardShortcuts(context: { scope: string }) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const parts: string[] = []
      if (e.ctrlKey || e.metaKey) parts.push('Ctrl')
      if (e.shiftKey) parts.push('Shift')
      if (e.altKey) parts.push('Alt')

      let key = e.key.toLowerCase()
      if (key === ' ') key = 'space'
      if (key === 'escape') key = 'escape'
      if (key === '/') key = '/'
      parts.push(key)

      const keyStr = parts.join('+')
      const binding = shortcuts.get(keyStr)

      if (binding && (binding.scope === 'global' || binding.scope === context.scope)) {
        e.preventDefault()
        e.stopPropagation()
        binding.action()
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [context.scope])
}

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(0)

  const items = Array.from(shortcuts.values()).filter((s) =>
    s.label.toLowerCase().includes(query.toLowerCase()),
  )

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelected((s) => Math.min(s + 1, items.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelected((s) => Math.max(s - 1, 0))
    } else if (e.key === 'Enter' && items[selected]) {
      items[selected].action()
      onClose()
    } else if (e.key === 'Escape') {
      onClose()
    }
  }, [items, selected, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-gray-900 border border-gray-700 rounded-lg shadow-xl w-full max-w-md overflow-hidden">
        <input
          autoFocus
          value={query}
          onChange={(e) => { setQuery(e.target.value); setSelected(0) }}
          onKeyDown={handleKeyDown}
          placeholder="Type a command..."
          className="w-full px-4 py-3 bg-transparent text-white border-b border-gray-700 outline-none"
        />
        <div className="max-h-64 overflow-y-auto">
          {items.map((item, i) => (
            <button
              key={item.id}
              className={`w-full px-4 py-2 text-left flex justify-between items-center ${
                i === selected ? 'bg-blue-600/20 text-blue-400' : 'text-gray-300 hover:bg-gray-800'
              }`}
              onClick={() => { item.action(); onClose() }}
            >
              <span>{item.label}</span>
              <span className="text-xs text-gray-500 font-mono">{item.keys}</span>
            </button>
          ))}
          {items.length === 0 && (
            <div className="px-4 py-3 text-gray-500 text-sm">No commands found</div>
          )}
        </div>
      </div>
    </div>
  )
}
