// src/storage/contracts/local-agent-store.ts
// LocalAgentStore contract — engine-facing storage for the `local-agent` provider.
// Engines depend on this interface (Store Contracts invariant), never on Prisma directly.

import type { ContentBlock } from '../../schema/streaming.js'

export interface LocalAgentModelRow {
  slug: string
  displayName: string
  isDefault: boolean
  contextWindow?: number | null
  maxOutputTokens?: number | null
  pricingInputPer1m?: number | null
  pricingOutputPer1m?: number | null
}

export interface AgentModelSyncResult {
  added: string[]
  removed: string[]
  kept: string[]
  defaultModel: string
}

export interface AgentModelSyncState {
  lastSyncedAt: number | null
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

  /**
   * Replace the verified allow-list with the latest models discovered from the
   * opencode CLI. Upserts every incoming model, deactivates models no longer
   * present, preserves the current default when it still exists, and records the
   * sync timestamp.
   */
  syncAgentModels(
    slug: string,
    models: LocalAgentModelRow[],
    opts?: { defaultModel?: string },
  ): Promise<AgentModelSyncResult>

  /** Set which allowed model is the active default. */
  setAgentDefaultModel(slug: string, modelSlug: string): Promise<void>

  /** Last successful model sync timestamp (from provider_config), or null. */
  getAgentModelSyncState(slug: string): Promise<AgentModelSyncState>

  /** True if `model` is in the verified allow-list for `slug`. */
  isModelAllowed(slug: string, model: string): Promise<boolean>
}

export type { ContentBlock }
