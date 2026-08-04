// Vim-style modal command layer for the canvas.
//
// The canvas runs in one of four modes:
//   - normal: default. Keys are commands (h/j/k/l pan, dd delete, etc.).
//   - insert: typing goes into the active node's text field. Esc returns to normal.
//   - visual: drag a selection box. Esc returns to normal.
//   - command: typing goes into the command palette (:). Enter runs, Esc cancels.
//
// The mode is shown in a status bar at the bottom-left. The leader key
// (default: space) initiates multi-key sequences (e.g. space-d-d deletes).
//
// This module is pure: it takes (keys, state) and returns (action, newMode).
// The React layer wires it to actual store dispatches.

import type { CanvasConfig } from './config'

export type Mode = 'normal' | 'insert' | 'visual' | 'command'

export interface CommandResult {
  mode: Mode
  pendingKeys: string // keys typed so far in a sequence (e.g. "d" waiting for second "d")
  action?: CanvasAction
  statusText?: string
}

export type CanvasAction =
  | { kind: 'pan'; dx: number; dy: number }
  | { kind: 'zoom'; factor: number }
  | { kind: 'zoom-fit' }
  | { kind: 'node-delete'; ids: string[] }
  | { kind: 'node-yank'; ids: string[] }
  | { kind: 'node-paste' }
  | { kind: 'node-connect'; fromId: string }
  | { kind: 'node-group'; ids: string[] }
  | { kind: 'insert-note'; at?: { x: number; y: number } }
  | { kind: 'insert-below' }
  | { kind: 'insert-above' }
  | { kind: 'find' }
  | { kind: 'command-open' }
  | { kind: 'bookmark-set' }
  | { kind: 'bookmark-goto'; hotkey: string }
  | { kind: 'undo' }
  | { kind: 'redo' }
  | { kind: 'select-all' }
  | { kind: 'clear-selection' }

// Lookup table from binding string -> action kind.
// Inverted from config.keyboard.bindings so we can match keys -> action.
function buildBindingTable(config: CanvasConfig): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [action, keys] of Object.entries(config.keyboard.bindings)) {
    out[keys] = action
  }
  return out
}

const PAN_STEP = 60 // canvas units per h/j/k/l press

export function handleKey(
  key: string,
  mode: Mode,
  pendingKeys: string,
  config: CanvasConfig,
  selection: { nodeIds: string[]; activeNodeId?: string },
): CommandResult {
  // Esc always returns to normal mode and clears pending keys.
  if (key === 'Escape') {
    return { mode: 'normal', pendingKeys: '' }
  }

  // In insert mode, all keys go to the active node's text field (handled by React).
  if (mode === 'insert') {
    return { mode, pendingKeys: '' }
  }

  // In command mode, all keys go to the palette input (handled by React).
  if (mode === 'command') {
    return { mode, pendingKeys: '' }
  }

  // Normal / visual modes: look up the binding.
  const bindings = buildBindingTable(config)
  const sequence = pendingKeys + key

  // Check if any binding is a prefix of the current sequence.
  // If so, we may need to wait for more keys (multi-key sequence).
  const isPrefix = Object.keys(bindings).some((k) => k.startsWith(sequence) && k !== sequence)
  if (isPrefix) {
    return { mode, pendingKeys: sequence }
  }

  const actionKind = bindings[sequence]
  if (!actionKind) {
    return { mode, pendingKeys: '', statusText: `No binding for ${sequence}` }
  }

  const action = buildAction(actionKind, selection)
  if (!action) {
    return { mode, pendingKeys: '', statusText: `Action ${actionKind} not implemented` }
  }
  return { mode, pendingKeys: '', action }
}

function buildAction(
  actionKind: string,
  selection: { nodeIds: string[]; activeNodeId?: string },
): CanvasAction | undefined {
  switch (actionKind) {
    case 'view.zoom-in':
      return { kind: 'zoom', factor: 1.2 }
    case 'view.zoom-out':
      return { kind: 'zoom', factor: 1 / 1.2 }
    case 'view.fit':
      return { kind: 'zoom-fit' }
    case 'view.find':
      return { kind: 'find' }
    case 'node.delete':
      return { kind: 'node-delete', ids: selection.nodeIds }
    case 'node.yank':
      return { kind: 'node-yank', ids: selection.nodeIds }
    case 'node.paste':
      return { kind: 'node-paste' }
    case 'node.connect':
      return selection.activeNodeId
        ? { kind: 'node-connect', fromId: selection.activeNodeId }
        : undefined
    case 'node.group':
      return { kind: 'node-group', ids: selection.nodeIds }
    case 'insert.note':
      return { kind: 'insert-note' }
    case 'insert.below':
      return { kind: 'insert-below' }
    case 'insert.above':
      return { kind: 'insert-above' }
    case 'command.open':
      return { kind: 'command-open' }
    case 'bookmark.set':
      return { kind: 'bookmark-set' }
    case 'bookmark.goto':
      // The full binding is "'<n>"; the second char is the hotkey. Caller strips.
      return { kind: 'bookmark-goto', hotkey: '' }
    case 'view.pan-left':
      return { kind: 'pan', dx: -PAN_STEP, dy: 0 }
    case 'view.pan-right':
      return { kind: 'pan', dx: PAN_STEP, dy: 0 }
    case 'view.pan-up':
      return { kind: 'pan', dx: 0, dy: -PAN_STEP }
    case 'view.pan-down':
      return { kind: 'pan', dx: 0, dy: PAN_STEP }
    default:
      return undefined
  }
}
