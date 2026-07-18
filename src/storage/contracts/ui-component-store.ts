// src/storage/contracts/ui-component-store.ts
// UiComponentStore — persistence + resolution for hot-swappable UI code nodes.
// The single table expresses all four resolution tiers via (scope, ownerId,
// variant). `resolve()` walks the precedence defined in 10-conceptual-matrix §3.

import type {
  UiComponent,
  UiComponentRow,
  UiComponentScope,
  UiComponentStatus,
} from 'shared/ui-component.js'

export type { UiComponent, UiComponentRow, UiComponentScope, UiComponentStatus }

export interface UiComponentInput {
  id: string
  primitiveId: string
  scope: UiComponentScope
  ownerId: string
  variant?: string | null
  componentKey: string
  displayName: string
  html?: string
  css?: string
  scriptUrl?: string | null
  sandboxJson?: string
  constraintsJson?: string
  contractJson?: string
  archetype?: string | null
  version?: number
  status?: UiComponentStatus
  author?: 'system' | 'user' | 'agent'
  defaultRegion?: { x: number; y: number; z: number; w: number; h: number } | null
  tags?: string[]
}

/** Inputs to walk the 4-tier resolution for one primitive on one provider. */
export interface ResolveContext {
  providerId: string
  familyId: string
  primitiveId: string
  /** Optional explicit variant (e.g. user-selected 'gemini'). */
  variant?: string | null
}

export interface UiComponentStore {
  create(input: UiComponentInput): Promise<UiComponentRow>
  get(id: string): Promise<UiComponentRow | null>
  /** Walk the precedence: provider(+variant) > provider > family(+variant) >
   *  family > cross-type > null. Returns the winning row or null. */
  resolve(ctx: ResolveContext): Promise<UiComponentRow | null>
  listByOwner(scope: UiComponentScope, ownerId: string): Promise<UiComponentRow[]>
  listByPrimitive(primitiveId: string): Promise<UiComponentRow[]>
  listByFamily(familyId: string): Promise<UiComponentRow[]>
  update(id: string, patch: Partial<Omit<UiComponentInput, 'id'>>): Promise<UiComponentRow>
  delete(id: string): Promise<void>
  /** Domain helper: resolve and deserialize. */
  resolveDomain(ctx: ResolveContext): Promise<UiComponent | null>
}
