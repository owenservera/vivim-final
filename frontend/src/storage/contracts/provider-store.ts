/**
 * storage/contracts/provider-store.ts
 * --------------------------------------------------------------------
 * ProviderDefinition store contract. Used for FK-walking
 * provider → family (bundle 02 §B.2 step 2, scenario S95).
 */

export interface ProviderDefinitionRow {
  id: string;
  slug: string;
  displayName: string;
  category: string;
  providerType: string;
  providerTypeId: string | null; // FK → ProviderType
}

export interface ProviderStore {
  getDefinition(id: string): Promise<ProviderDefinitionRow | null>;
  list(): Promise<ProviderDefinitionRow[]>;
  upsert(row: ProviderDefinitionRow): Promise<ProviderDefinitionRow>;
}
