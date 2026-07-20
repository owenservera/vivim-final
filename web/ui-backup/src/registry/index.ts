// web/ui/src/registry/index.ts
// CapabilityRegistry — promotes proven sandbox harnesses to shared, reusable
// renderers. Each entry binds a capability slug to a renderer component and a
// best-practice note. Prod renderers consult this ledger to choose bespoke
// (registered) vs generic (contract-driven) rendering.

import type { ComponentType } from 'react'

/** Props passed to a capability renderer. */
export interface CapabilityRenderProps {
  slug: string
  /** The 21-field resolved capability contract. */
  contract: Record<string, unknown>
  /** Dispatch a UI action by id (B8 — all actions go through ActionRegistry). */
  onAction?: (actionId: string, params: Record<string, unknown>) => void
}

export interface CapabilityRenderer {
  slug: string
  /** Best-practice note captured from sandbox iteration. */
  bestPracticeNote?: string
  /** Bespoke renderer for this capability; absent → generic renderer used. */
  component?: ComponentType<CapabilityRenderProps>
}

const renderers = new Map<string, CapabilityRenderer>()

export const CapabilityRegistry = {
  register(slug: string, renderer: CapabilityRenderer): void {
    if (!slug) throw new Error('CapabilityRegistry.register requires a slug')
    const { slug: _ignored, ...rest } = renderer
    renderers.set(slug, { slug, ...rest })
  },

  get(slug: string): CapabilityRenderer | undefined {
    return renderers.get(slug)
  },

  list(): CapabilityRenderer[] {
    return [...renderers.values()]
  },

  /** True when a bespoke renderer exists for the slug. */
  hasBespoke(slug: string): boolean {
    return renderers.get(slug)?.component !== undefined
  },
}
