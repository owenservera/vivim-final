// web/ui/src/ui/useSlot.ts
// React hook to resolve a slot under the current SlotProvider context,
// subscribing to the registry so runtime hot-swaps re-render live.

import { useSyncExternalStore } from 'react'
import {
  getVersion,
  resolve,
  subscribe,
  type AnyComponent,
  type ResolvedSlot,
} from './registry.js'
import { useSlotContext } from './context.js'
import type { SlotId } from './slots.js'

/** Resolve a slot's component; re-renders when the registry hot-swaps. */
export function useSlot(slot: SlotId): AnyComponent {
  const ctx = useSlotContext()
  useSyncExternalStore(subscribe, getVersion)
  return resolve(slot, { providerSlug: ctx.providerSlug, capabilitySlug: ctx.capabilitySlug })
    .component
}

/** Resolve a slot with its source + sandbox metadata. */
export function useResolvedSlot(slot: SlotId): ResolvedSlot {
  const ctx = useSlotContext()
  useSyncExternalStore(subscribe, getVersion)
  return resolve(slot, { providerSlug: ctx.providerSlug, capabilitySlug: ctx.capabilitySlug })
}
