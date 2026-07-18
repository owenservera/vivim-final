// src/storage/contracts/provider-type-store.ts
// ProviderTypeStore — persistence contract for provider-type (family) rows.
// Engines depend on this interface, never on an impl.

import type { ProviderType, ProviderTypeRow } from 'shared/conceptual-model.js'

export type { ProviderType, ProviderTypeRow }

export interface ProviderTypeInput {
  id: string
  slug: string
  displayName: string
  description?: string | null
  slotCatalog: string[]
  regionLayout: Record<string, { x: number; y: number; w: number; h: number }>
  interactionGrammar: Record<string, unknown>
  basePrimitive?: string
  version?: number
}

export interface ProviderTypeStore {
  create(input: ProviderTypeInput): Promise<ProviderTypeRow>
  get(id: string): Promise<ProviderTypeRow | null>
  getBySlug(slug: string): Promise<ProviderTypeRow | null>
  list(): Promise<ProviderTypeRow[]>
  update(id: string, patch: Partial<Omit<ProviderTypeInput, 'id'>>): Promise<ProviderTypeRow>
  delete(id: string): Promise<void>
  /** Domain helper: load all families as typed objects. */
  listDomains(): Promise<ProviderType[]>
}
