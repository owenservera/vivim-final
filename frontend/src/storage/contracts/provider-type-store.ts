/**
 * storage/contracts/provider-type-store.ts
 * --------------------------------------------------------------------
 * ProviderType (family) store contract.
 */

import type { ProviderType, ProviderTypeSlug } from '../../shared/conceptual-model';

export interface ProviderTypeRow {
  id: string;
  slug: ProviderTypeSlug;
  displayName: string;
  description: string;
  slotCatalogJson: string;
  regionLayoutJson: string;
  interactionGrammarJson: string;
  basePrimitive: string;
  version: number;
  createdAt: number;
  updatedAt: number;
}

export interface ProviderTypeStore {
  get(id: string): Promise<ProviderTypeRow | null>;
  getBySlug(slug: ProviderTypeSlug): Promise<ProviderTypeRow | null>;
  list(): Promise<ProviderTypeRow[]>;
  upsert(row: Omit<ProviderTypeRow, 'createdAt' | 'updatedAt'>): Promise<ProviderTypeRow>;
  toDomain(row: ProviderTypeRow): ProviderType;
}
