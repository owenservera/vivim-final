// src/storage/contracts/local-agent-store.ts
// LocalAgentStore contract — engine-facing storage for the `local-agent` provider.
// Engines depend on this interface (Store Contracts invariant), never on Prisma directly.

import type { ContentBlock } from '../../schema/streaming.js'

export interface LocalAgentModelRow {
  slug: string
  displayName: string
  isDefault: boolean
}

export interface LocalAgentProviderRow {
  slug: string
  displayName: string
  authType: 'none'
  models: LocalAgentModelRow[]
}

export interface LocalAgentConfig {
  binary: string
  timeoutMs: number
  allowedModels: string[]
  defaultModel: string
}

export interface LocalAgentStore {
  /** Load the seeded `local-agent` provider (slug `opencode`) + its models. */
  getAgentProvider(slug: string): Promise<LocalAgentProviderRow | null>

  /** Runtime config (binary, timeout, allow-list). */
  getAgentConfig(slug: string): Promise<LocalAgentConfig | null>

  /** Upsert provider + model rows from the seed manifest (idempotent). */
  upsertAgentProvider(row: LocalAgentProviderRow, config: LocalAgentConfig): Promise<void>

  /** True if `model` is in the verified allow-list for `slug`. */
  isModelAllowed(slug: string, model: string): Promise<boolean>
}

export type { ContentBlock }
