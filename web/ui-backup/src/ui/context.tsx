// web/ui/src/ui/context.tsx
// Slot resolution context. Surfaces wrap their tree in <SlotProvider> with the
// active provider (and optional capability) slug; slots resolved below the
// provider inherit that context, enabling capability-level > provider-level
// precedence without prop-drilling.

import { createContext, createElement, useContext, type ReactNode } from 'react'
import type { SlotId } from './slots.js'

export interface SlotContextValue {
  providerSlug: string
  capabilitySlug?: string
}

const SlotContext = createContext<SlotContextValue | null>(null)

export function SlotProvider({
  providerSlug,
  capabilitySlug,
  children,
}: {
  providerSlug: string
  capabilitySlug?: string
  children: ReactNode
}) {
  const value: SlotContextValue = { providerSlug, capabilitySlug }
  return createElement(SlotContext.Provider, { value }, children)
}

export function useSlotContext(): SlotContextValue {
  const ctx = useContext(SlotContext)
  if (!ctx) {
    // Safe fallback: surfaces that forget to wrap still resolve defaults.
    return { providerSlug: 'unknown' }
  }
  return ctx
}

export type { SlotId }
