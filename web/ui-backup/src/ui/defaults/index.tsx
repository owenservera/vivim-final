// web/ui/src/ui/defaults/index.tsx
// Registers the generic default renderer for every slot, and publishes each as
// a catalog entry so backend override claims (H6) can resolve a key → component.

import { SLOT_IDS, type SlotId } from '../slots.js'
import { registerCatalogEntry, registerDefault, type AnyComponent } from '../registry.js'
import { ChatEntry } from './entry.js'
import { Sidebar } from './sidebar.js'
import { Bubble, Result, Streaming, Thread } from './messages.js'
import { AttachButton, Composer, SendButton } from './composer.js'
import { ConfirmDialog, ErrorBar } from './overlays.js'
import { Header } from './header.js'
import { ActionBar } from './actionBar.js'

const DEFAULTS: Record<SlotId, AnyComponent> = {
  'chat.entry': ChatEntry as unknown as AnyComponent,
  'chat.sidebar': Sidebar as unknown as AnyComponent,
  'chat.thread': Thread as unknown as AnyComponent,
  'chat.bubble': Bubble as unknown as AnyComponent,
  'chat.composer': Composer as unknown as AnyComponent,
  'chat.send': SendButton as unknown as AnyComponent,
  'chat.attach': AttachButton as unknown as AnyComponent,
  'chat.streaming': Streaming as unknown as AnyComponent,
  'chat.result': Result as unknown as AnyComponent,
  'chat.confirm': ConfirmDialog as unknown as AnyComponent,
  'chat.error': ErrorBar as unknown as AnyComponent,
  'chat.header': Header as unknown as AnyComponent,
  'chat.actionBar': ActionBar as unknown as AnyComponent,
}

let registered = false

/** Idempotent: register all defaults + catalog entries once. */
export function registerDefaults(): void {
  if (registered) return
  registered = true
  for (const id of SLOT_IDS) {
    registerDefault(id, DEFAULTS[id])
    registerCatalogEntry(id, DEFAULTS[id])
  }
}

export { ChatEntry, Sidebar, Bubble, Thread, Streaming, Result, Composer, SendButton, AttachButton, ConfirmDialog, ErrorBar, Header, ActionBar }
