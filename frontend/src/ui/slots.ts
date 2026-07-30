// web/ui/src/ui/slots.ts
// Canonical catalog of UI slots ("capability globals"). A slot is a fixed
// position in a surface that renders a swappable component. Every surface
// resolves each slot through the global UIComponentRegistry so the same
// component set is shared across providers, and any provider/capability can
// hot-swap a bespoke renderer for that slot at runtime (no rebuild).
//
// This file is the single source of truth for which slots exist. See
// docs/prd-hot-swappable-ui.md §4.1 for the conceptual model.

/** Every slot id. Add new capability globals here. */
export const SLOT_IDS = [
  'chat.entry', // main chat box / frontend entry point (host region)
  'chat.sidebar', // conversation list + new-chat
  'chat.thread', // message scroll region
  'chat.bubble', // single message (user/assistant)
  'chat.composer', // input + send region
  'chat.send', // send-message button
  'chat.attach', // attach-file button
  'chat.streaming', // progressive/streaming indicator
  'chat.result', // rich result renderer (blocks/artifacts)
  'chat.confirm', // confirmation dialog (destructive ops)
  'chat.error', // error/toast surface
  'chat.header', // provider switcher + account status
  'chat.actionBar', // capability action buttons (B8)
  // Canvas-level slots
  'canvas.controls',
  'session.controls',
  'autonomous.controls',
  'automation.launcher',
  'fleet.controls',
  'capabilities.panel',
  'health.panel',
  'search.panel',
  'zlayers.panel',
  'audit.panel',
  'templates.panel',
  'rbac.panel',
  'tab.bar',
  'tab.layer-switcher',
  'tab.panel-content',
  'entry.unified',
] as const

export type SlotId = (typeof SLOT_IDS)[number]

/** Metadata describing a slot — used by debug/manifest surfaces. */
export interface SlotMeta {
  id: SlotId
  /** Human label for the manifest/debug UI. */
  label: string
  /** Which layer is allowed to override this slot. */
  overridableBy: 'capability' | 'provider' | 'both'
}

export const SLOT_META: Record<SlotId, SlotMeta> = {
  'chat.entry': { id: 'chat.entry', label: 'Chat entry (host)', overridableBy: 'capability' },
  'chat.sidebar': { id: 'chat.sidebar', label: 'Sidebar', overridableBy: 'provider' },
  'chat.thread': { id: 'chat.thread', label: 'Thread', overridableBy: 'capability' },
  'chat.bubble': { id: 'chat.bubble', label: 'Bubble', overridableBy: 'both' },
  'chat.composer': { id: 'chat.composer', label: 'Composer', overridableBy: 'provider' },
  'chat.send': { id: 'chat.send', label: 'Send button', overridableBy: 'capability' },
  'chat.attach': { id: 'chat.attach', label: 'Attach button', overridableBy: 'capability' },
  'chat.streaming': {
    id: 'chat.streaming',
    label: 'Streaming indicator',
    overridableBy: 'capability',
  },
  'chat.result': { id: 'chat.result', label: 'Result renderer', overridableBy: 'capability' },
  'chat.confirm': { id: 'chat.confirm', label: 'Confirm dialog', overridableBy: 'capability' },
  'chat.error': { id: 'chat.error', label: 'Error/toast', overridableBy: 'capability' },
  'chat.header': { id: 'chat.header', label: 'Header', overridableBy: 'provider' },
  'chat.actionBar': { id: 'chat.actionBar', label: 'Action bar', overridableBy: 'capability' },
  'canvas.controls': {
    id: 'canvas.controls',
    label: 'Canvas Controls',
    overridableBy: 'capability',
  },
  'session.controls': {
    id: 'session.controls',
    label: 'Session Controls',
    overridableBy: 'provider',
  },
  'autonomous.controls': {
    id: 'autonomous.controls',
    label: 'Autonomous Controls',
    overridableBy: 'capability',
  },
  'automation.launcher': {
    id: 'automation.launcher',
    label: 'Automation Launcher',
    overridableBy: 'capability',
  },
  'fleet.controls': { id: 'fleet.controls', label: 'Fleet Status', overridableBy: 'provider' },
  'capabilities.panel': {
    id: 'capabilities.panel',
    label: 'Capabilities Panel',
    overridableBy: 'capability',
  },
  'health.panel': { id: 'health.panel', label: 'Health Dashboard', overridableBy: 'provider' },
  'search.panel': { id: 'search.panel', label: 'Search Panel', overridableBy: 'capability' },
  'zlayers.panel': { id: 'zlayers.panel', label: 'Z-Layers Panel', overridableBy: 'capability' },
  'audit.panel': { id: 'audit.panel', label: 'Audit Panel', overridableBy: 'capability' },
  'templates.panel': {
    id: 'templates.panel',
    label: 'Templates Panel',
    overridableBy: 'capability',
  },
  'rbac.panel': { id: 'rbac.panel', label: 'RBAC Panel', overridableBy: 'capability' },
  'tab.bar': { id: 'tab.bar', label: 'Tab Bar', overridableBy: 'capability' },
  'tab.layer-switcher': {
    id: 'tab.layer-switcher',
    label: 'Layer Switcher',
    overridableBy: 'capability',
  },
  'tab.panel-content': {
    id: 'tab.panel-content',
    label: 'Tab Panel Content',
    overridableBy: 'capability',
  },
  'entry.unified': { id: 'entry.unified', label: 'Unified Entry', overridableBy: 'provider' },
}

/** Type guard for arbitrary strings. */
export function isSlotId(value: string): value is SlotId {
  return (SLOT_IDS as readonly string[]).includes(value)
}

/**
 * A slot override claim coming from the backend. `component` is a catalog key
 * (not a React component — the frontend resolves it against the component
 * catalog). `sandbox` is the whitelist of capability(s) the bespoke renderer
 * is allowed to touch (P8).
 */
export interface SlotOverrideClaim {
  slot: SlotId
  component?: string
  sandbox?: string[]
}
