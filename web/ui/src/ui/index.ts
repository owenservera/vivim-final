// web/ui/src/ui/index.ts
// Public barrel for the hot-swappable capability-global UI system.

export * from './slots.js'
export * from './registry.js'
export { SlotProvider, useSlotContext } from './context.js'
export { useSlot, useResolvedSlot } from './useSlot.js'
export { registerDefaults } from './defaults/index.js'
// H9: provider branding is resolved through the same single import surface as
// components, so a provider can override both brand and UI consistently.
export { getProviderAdapter, listProviderAdapters } from '../providers/registry.js'
