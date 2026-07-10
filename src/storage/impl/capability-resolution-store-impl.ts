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

  // biome-ignore lint/suspicious/noExplicitAny: Prisma escape hatch for dynamic raw SQL
  private get p(): any {
    // biome-ignore lint/suspicious/noExplicitAny: Prisma escape hatch for dynamic raw SQL
    return this.prisma as unknown as any
  }

  async resolveCapabilities(providerId: string, planTier: string): Promise<RawResolutionRow[]> {
    const sql = `
      SELECT
        ct.*,
        COALESCE(cb.status, 'inactive') AS binding_status,
        COALESCE(cb.health_score, 0) AS binding_confidence,
        pt.max_models AS tier_max_models,
        pt.max_file_size AS tier_max_file_size,
        pt.max_options AS tier_max_options,
        pt.config_json AS tier_config_json
      FROM capability_taxonomy ct
      LEFT JOIN capability_binding cb ON cb.global_id = ct.id AND cb.provider_id = $1
      LEFT JOIN provider_tier pt ON pt.tier = $2
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
        COALESCE(cb.health_score, 0) AS binding_confidence,
        pt.max_models AS tier_max_models,
        pt.max_file_size AS tier_max_file_size,
        pt.max_options AS tier_max_options,
        pt.config_json AS tier_config_json
      FROM capability_taxonomy ct
      LEFT JOIN capability_binding cb ON cb.global_id = ct.id AND cb.provider_id = $1
      LEFT JOIN provider_tier pt ON pt.tier = $2
      WHERE (ct.name ILIKE $3 OR ct.slug ILIKE $3 OR ct.search_hints_json ILIKE $3)
        AND (cb.status = 'active' OR cb.id IS NULL)
      ORDER BY ct.ui_position, ct.ui_order
      LIMIT 20
    `
    const pattern = `%${query}%`
    const rows = (await this.p.$queryRawUnsafe(
      sql,
      providerId,
      planTier,
      pattern,
    )) as RawResolutionRow[]
    return rows ?? []
  }
}
