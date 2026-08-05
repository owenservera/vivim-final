// shared/ui-slots.ts
// uiSlots contract — shared between backend resolution and frontend application.
// A uiSlot claim tells the frontend which component to render for a given slotId,
// scoped to a specific capability/provider. Resolution chain: global < plan < provider.

export interface UiSlotClaim {
  /** Catalog key → resolves to a React component via UIComponentRegistry. */
  component?: string
  /** Capability slugs this renderer may touch (P8 sandbox scoping). */
  sandbox?: string[]
}

/** Map of slotId → claim. Each capability publishes its UI overrides. */
export type UiSlotsMap = Record<string, UiSlotClaim>
