/**
 * shared/vcard.ts
 * --------------------------------------------------------------------
 * V6 vCard system — hierarchical capability menu on every node.
 *
 * Two layers:
 *   1. Global Actions (available on ALL vCards): collapse, pin, fullscreen,
 *      duplicate, detach, settings, connections, thread, remux, inspect,
 *      remove, export, history, lock
 *   2. Per-Widget-Type Actions: chat (new thread, branch, merge, clear,
 *      export, model select, system prompt, temperature), tool (configure,
 *      test, schema, enable, permissions), memory (recall, forget,
 *      consolidate, export, import), file (open, download, upload, versions,
 *      diff), provider (health, rate limits, switch model, test, usage)
 */

export type VCardActionId =
  // Global
  | 'collapse'
  | 'expand'
  | 'pin'
  | 'fullscreen'
  | 'duplicate'
  | 'detach'
  | 'settings'
  | 'connections'
  | 'thread'
  | 'remux'
  | 'inspect'
  | 'remove'
  | 'export'
  | 'history'
  | 'lock'
  // Chat
  | 'new_thread'
  | 'branch'
  | 'merge'
  | 'clear_context'
  | 'export_transcript'
  | 'model_select'
  | 'system_prompt'
  | 'temperature'
  // Tool
  | 'configure'
  | 'test_run'
  | 'view_schema'
  | 'enable_disable'
  | 'permissions'
  // Memory
  | 'recall'
  | 'forget'
  | 'consolidate'
  | 'memory_export'
  | 'memory_import'
  // File
  | 'file_open'
  | 'download'
  | 'upload'
  | 'version_history'
  | 'diff'
  // Provider
  | 'health'
  | 'rate_limits'
  | 'switch_model'
  | 'test_connection'
  | 'usage'

export interface VCardAction {
  id: VCardActionId
  label: string
  icon: string
  /** Whether the action is currently enabled (context-dependent). */
  enabled: boolean
  /** Whether this action has a submenu. */
  hasSubmenu?: boolean
  /** Shortcut key (display only). */
  shortcut?: string
}

export type VCardCategory =
  | 'chat'
  | 'tool'
  | 'memory'
  | 'file'
  | 'provider'
  | 'automation'
  | 'agent'
  | 'media'
  | 'document'
  | 'shell'
  | 'generic'

export interface VCardState {
  nodeId: string
  /** Whether the node is collapsed (title bar only). */
  collapsed: boolean
  /** Whether the node is pinned (no drag). */
  pinned: boolean
  /** Whether the node is fullscreen. */
  fullscreen: boolean
  /** Whether the node is locked (no changes). */
  locked: boolean
  /** Whether I/O connection lines are visible. */
  connectionsVisible: boolean
  /** Whether the node is detached (separate window). */
  detached: boolean
  /** Node category (drives per-type actions). */
  category: VCardCategory
}

/** Global actions available on ALL vCards. */
export const GLOBAL_ACTIONS: VCardAction[] = [
  { id: 'collapse', label: 'Collapse', icon: '▾', enabled: true },
  { id: 'expand', label: 'Expand', icon: '▴', enabled: true },
  { id: 'pin', label: 'Pin', icon: 'pin', enabled: true },
  { id: 'fullscreen', label: 'Full Screen', icon: 'fullscreen', enabled: true },
  { id: 'duplicate', label: 'Duplicate', icon: '⧉', enabled: true },
  { id: 'detach', label: 'Detach', icon: '↗', enabled: true },
  { id: 'settings', label: 'Settings', icon: '', enabled: true },
  { id: 'connections', label: 'Connections', icon: '⤴', enabled: true },
  { id: 'thread', label: 'Thread', icon: '', enabled: true },
  { id: 'remux', label: 'Remux', icon: 'remux', enabled: true },
  { id: 'inspect', label: 'Inspect', icon: 'search', enabled: true },
  { id: 'history', label: 'History', icon: '↻', enabled: true },
  { id: 'lock', label: 'Lock', icon: '', enabled: true },
  { id: 'export', label: 'Export', icon: '', enabled: true },
  { id: 'remove', label: 'Remove', icon: '', enabled: true },
]

/** Per-category actions. */
export const CATEGORY_ACTIONS: Record<VCardCategory, VCardAction[]> = {
  chat: [
    { id: 'new_thread', label: 'New Thread', icon: '', enabled: true },
    { id: 'branch', label: 'Branch', icon: '', enabled: true },
    { id: 'merge', label: 'Merge', icon: 'remux', enabled: true },
    { id: 'clear_context', label: 'Clear Context', icon: '', enabled: true },
    { id: 'export_transcript', label: 'Export Transcript', icon: '', enabled: true },
    { id: 'model_select', label: 'Model Select', icon: 'robot', enabled: true, hasSubmenu: true },
    { id: 'system_prompt', label: 'System Prompt', icon: '', enabled: true },
    { id: 'temperature', label: 'Temperature', icon: '', enabled: true, hasSubmenu: true },
  ],
  tool: [
    { id: 'configure', label: 'Configure', icon: '', enabled: true },
    { id: 'test_run', label: 'Test Run', icon: '', enabled: true },
    { id: 'view_schema', label: 'View Schema', icon: '', enabled: true },
    { id: 'enable_disable', label: 'Enable/Disable', icon: '', enabled: true },
    { id: 'permissions', label: 'Permissions', icon: 'shield', enabled: true },
  ],
  memory: [
    { id: 'recall', label: 'Recall', icon: '', enabled: true },
    { id: 'forget', label: 'Forget', icon: '', enabled: true },
    { id: 'consolidate', label: 'Consolidate', icon: '', enabled: true },
    { id: 'memory_export', label: 'Export', icon: '', enabled: true },
    { id: 'memory_import', label: 'Import', icon: '', enabled: true },
  ],
  file: [
    { id: 'file_open', label: 'Open', icon: '', enabled: true },
    { id: 'download', label: 'Download', icon: '', enabled: true },
    { id: 'upload', label: 'Upload', icon: '', enabled: true },
    { id: 'version_history', label: 'Version History', icon: '', enabled: true },
    { id: 'diff', label: 'Diff', icon: '', enabled: true },
  ],
  provider: [
    { id: 'health', label: 'Health', icon: '', enabled: true },
    { id: 'rate_limits', label: 'Rate Limits', icon: '', enabled: true },
    { id: 'switch_model', label: 'Switch Model', icon: '', enabled: true, hasSubmenu: true },
    { id: 'test_connection', label: 'Test Connection', icon: '', enabled: true },
    { id: 'usage', label: 'Usage', icon: '', enabled: true },
  ],
  automation: [
    { id: 'configure', label: 'Configure', icon: '', enabled: true },
    { id: 'test_run', label: 'Test Run', icon: '', enabled: true },
  ],
  agent: [
    { id: 'configure', label: 'Configure', icon: '', enabled: true },
    { id: 'test_run', label: 'Invoke', icon: '', enabled: true },
  ],
  media: [
    { id: 'file_open', label: 'Open', icon: '', enabled: true },
    { id: 'download', label: 'Download', icon: '', enabled: true },
  ],
  document: [
    { id: 'file_open', label: 'Open Editor', icon: '', enabled: true },
    { id: 'download', label: 'Download', icon: '', enabled: true },
    { id: 'version_history', label: 'Version History', icon: '', enabled: true },
  ],
  shell: [
    { id: 'clear_context', label: 'Clear', icon: '', enabled: true },
    { id: 'export_transcript', label: 'Export Log', icon: '', enabled: true },
  ],
  generic: [],
}

/** Get all actions for a vCard (global + category-specific). */
export function getActionsForCard(state: VCardState): VCardAction[] {
  const global = GLOBAL_ACTIONS.map((a) => {
    // Toggle labels based on state.
    if (a.id === 'collapse' && state.collapsed) return { ...a, label: 'Expand', icon: '▴' }
    if (a.id === 'expand' && !state.collapsed) return { ...a, enabled: false }
    if (a.id === 'pin' && state.pinned) return { ...a, label: 'Unpin', icon: 'pin' }
    if (a.id === 'lock' && state.locked) return { ...a, label: 'Unlock', icon: '' }
    if (a.id === 'connections' && !state.connectionsVisible)
      return { ...a, label: 'Show Connections', icon: '⤴' }
    if (a.id === 'connections' && state.connectionsVisible)
      return { ...a, label: 'Hide Connections', icon: '⤴' }
    return a
  })
  const category = CATEGORY_ACTIONS[state.category] ?? []
  return [...global, ...category]
}
