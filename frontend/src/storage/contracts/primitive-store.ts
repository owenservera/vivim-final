/**
 * storage/contracts/primitive-store.ts
 * --------------------------------------------------------------------
 * Primitive (slot vocabulary) store contract.
 */

import type { Primitive, PrimitiveScope } from '../../shared/conceptual-model';

export interface PrimitiveRow {
  id: string;
  scope: PrimitiveScope;
  familyId: string | null;
  providerId: string | null;
  label: string;
  description: string | null;
  defaultRegionJson: string;
  version: number;
  createdAt: number;
  updatedAt: number;
}

export interface PrimitiveStore {
  get(id: string): Promise<PrimitiveRow | null>;
  list(filter?: { familyId?: string; scope?: PrimitiveScope }): Promise<PrimitiveRow[]>;
  upsert(row: Omit<PrimitiveRow, 'createdAt' | 'updatedAt'>): Promise<PrimitiveRow>;
  toDomain(row: PrimitiveRow): Primitive;
}
