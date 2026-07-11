// src/storage/contracts/provider-store.ts
// ProviderStore contract — defines the data access interface for ProviderRegistrar.
// Implementation is provided by Prisma-based storage in src/storage/impl/.

import type {
  ProviderCapabilityRow,
  ProviderConfigRow,
  ProviderDefinitionRow,
  ProviderEndpointRow,
  ProviderModelRow,
  ProviderParserRow,
} from '../../schema/types.js'

export interface ProviderStore {
  upsertDefinition(def: ProviderDefinitionRow): Promise<void>
  upsertEndpoint(endpoint: ProviderEndpointRow): Promise<void>
  upsertParser(parser: ProviderParserRow): Promise<void>
  upsertCapability(cap: ProviderCapabilityRow): Promise<void>
  upsertConfig(config: ProviderConfigRow): Promise<void>
  upsertModel(model: ProviderModelRow): Promise<void>
  deleteProviderEndpoints(providerId: string): Promise<void>
  deleteProviderParsers(providerId: string): Promise<void>
  deleteProviderCapabilities(providerId: string): Promise<void>
  deleteProviderConfigs(providerId: string): Promise<void>
  deleteProviderModels(providerId: string): Promise<void>
  getDefinition(id: string): Promise<ProviderDefinitionRow | null>
  getDefinitionBySlug(slug: string): Promise<ProviderDefinitionRow | null>
  listDefinitions(opts?: { isActive?: boolean }): Promise<ProviderDefinitionRow[]>
}
