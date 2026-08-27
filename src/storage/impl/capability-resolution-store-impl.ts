// src/storage/impl/capability-resolution-store-impl.ts
// Prisma-backed CapabilityResolutionStore for CapabilityResolutionEngine.
// Uses raw SQL for the complex resolution query with override chains.

import type {
  CapabilityResolutionStore,
  RawResolutionRow,
} from '../contracts/capability-resolution-store.js'
import type { PrismaClientLike } from './prisma-like.js'

export class CapabilityResolutionStoreImpl implements CapabilityResolutionStore {
  constructor(private prisma: PrismaClientLike) {}

  private get p() {
    return this.prisma
  }

  async resolveCapabilities(providerId: string, planTier: string): Promise<RawResolutionRow[]> {
    const sql = `
      SELECT
        ct.*,
        COALESCE(cb.status, 'inactive') AS binding_status,
        COALESCE(cb.confidence, 0) AS binding_confidence,
        pc.ui_component_override AS ui_component_override,
        pt.max_models AS tier_max_models,
        pt.max_file_size AS tier_max_file_size,
        pt.max_options AS tier_max_options,
        pt.custom_config_json AS tier_config_json
      FROM capability_taxonomy ct
      LEFT JOIN capability_binding cb ON cb.global_id = ct.id AND cb.provider_id = $1
      LEFT JOIN provider_capability pc ON pc.provider_id = $1 AND pc.global_capability_id = ct.id
      LEFT JOIN capability_tier pt ON pt.capability_id = ct.id AND pt.plan_tier = $2
      WHERE cb.status = 'active' OR cb.id IS NULL
      ORDER BY ct.ui_position, ct.ui_order
    `
    const rows = (await this.p.$queryRawUnsafe(sql, providerId, planTier)) as RawResolutionRow[]
    return rows ?? []
  }

  async getActiveBindings(providerId: string): Promise<string[]> {
    const sql = `
      SELECT global_id FROM capability_binding
      WHERE provider_id = $1 AND status = 'active'
    `
    const rows = (await this.p.$queryRawUnsafe(sql, providerId)) as { global_id: string }[]
    return (rows ?? []).map((r) => r.global_id)
  }

  async searchCapabilities(
    providerId: string,
    planTier: string,
    query: string,
  ): Promise<RawResolutionRow[]> {
    const sql = `
      SELECT
        ct.*,
        COALESCE(cb.status, 'inactive') AS binding_status,
        COALESCE(cb.confidence, 0) AS binding_confidence,
        pc.ui_component_override AS ui_component_override,
        pt.max_models AS tier_max_models,
        pt.max_file_size AS tier_max_file_size,
        pt.max_options AS tier_max_options,
        pt.custom_config_json AS tier_config_json
      FROM capability_taxonomy ct
      LEFT JOIN capability_binding cb ON cb.global_id = ct.id AND cb.provider_id = $1
      LEFT JOIN provider_capability pc ON pc.provider_id = $1 AND pc.global_capability_id = ct.id
      LEFT JOIN capability_tier pt ON pt.capability_id = ct.id AND pt.plan_tier = $2
      WHERE (ct.name ILIKE $3 OR ct.slug ILIKE $3 OR ct.search_hints_json ILIKE $3)
        AND (cb.status = 'active' OR cb.id IS NULL)
      ORDER BY ct.ui_position, ct.ui_order
    `
    // Escape LIKE metacharacters so a user query such as "50%" matches the
    // literal string "50%" instead of treating `%`/`_` as wildcards. The engine
    // re-filters the candidate rows precisely, so we must not truncate with a
    // LIMIT before that filter runs (otherwise valid literal matches are lost).
    const escaped = query.replace(/[\\%_]/g, '\\$&')
    const pattern = `%${escaped}%`
    const rows = (await this.p.$queryRawUnsafe(
      sql,
      providerId,
      planTier,
      pattern,
    )) as RawResolutionRow[]
    return rows ?? []
  }
}
