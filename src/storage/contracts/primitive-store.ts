// src/storage/contracts/primitive-store.ts
// PrimitiveStore — persistence contract for the closed UI-vocabulary rows.
// A Primitive is declared once per (scope, owner, id); UiComponents reference it.

import type { Primitive, PrimitiveRow, PrimitiveScope } from 'shared/conceptual-model.js'

export type { Primitive, PrimitiveRow, PrimitiveScope }

export interface PrimitiveInput {
  id: string
  scope: PrimitiveScope
  familyId?: string | null
  providerId?: string | null
  label: string
  description?: string | null
  defaultRegion: { x: number; y: number; w: number; h: number }
  version?: number
}

export interface PrimitiveStore {
  create(input: PrimitiveInput): Promise<PrimitiveRow>
  get(id: string): Promise<PrimitiveRow | null>
  /** All primitives for a family (scope='family' + its cross-type globals). */
  listByFamily(familyId: string): Promise<PrimitiveRow[]>
  listByProvider(providerId: string): Promise<PrimitiveRow[]>
  listByScope(scope: PrimitiveScope): Promise<PrimitiveRow[]>
  update(id: string, patch: Partial<Omit<PrimitiveInput, 'id'>>): Promise<PrimitiveRow>
  delete(id: string): Promise<void>
  listDomains(): Promise<Primitive[]>
}
