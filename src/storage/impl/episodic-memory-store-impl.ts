// src/storage/impl/episodic-memory-store-impl.ts
// EpisodicMemoryStoreImpl — Prisma-backed episodic memory store

import type {
  EpisodeQueryOpts,
  EpisodicMemory,
  EpisodicMemoryStore,
} from '../../engines/memory-engine.js'
import type { CapStoreDb } from '../db.js'

type PrismaLoose = Record<string, unknown>

export class EpisodicMemoryStoreImpl implements EpisodicMemoryStore {
  private db: PrismaLoose

  constructor(db: CapStoreDb) {
    this.db = db as unknown as PrismaLoose
  }

  private get p(): any {
    return this.db.prisma
  }

  async save(episode: EpisodicMemory): Promise<void> {
    await this.p.episodicMemory.upsert({
      where: { id: episode.id },
      create: {
        id: episode.id,
        provider_id: episode.providerId,
        capability_id: episode.capabilityId ?? null,
        slave_id: episode.slaveId ?? null,
        action: episode.action,
        input_json: JSON.stringify(episode.input),
        output_json: JSON.stringify(episode.output),
        success: episode.success ? 1 : 0,
        duration_ms: episode.durationMs,
        tags_json: JSON.stringify(episode.tags),
        timestamp: episode.timestamp,
        created_at: Date.now(),
      },
      update: {},
    })
  }

  async query(opts: EpisodeQueryOpts): Promise<EpisodicMemory[]> {
    const where: PrismaLoose = {}
    if (opts.providerId) where.provider_id = opts.providerId
    if (opts.capabilityId) where.capability_id = opts.capabilityId
    if (opts.action) where.action = opts.action
    if (opts.since) where.timestamp = { gte: opts.since }
    if (opts.successOnly) where.success = 1

    const rows = await this.p.episodicMemory.findMany({
      where,
      orderBy: { timestamp: 'desc' },
      take: opts.limit ?? 50,
    })

    return (rows as PrismaLoose[]).map((r) => ({
      id: r.id as string,
      providerId: r.provider_id as string,
      capabilityId: (r.capability_id as string) ?? undefined,
      slaveId: (r.slave_id as string) ?? undefined,
      action: r.action as string,
      input: JSON.parse((r.input_json as string) ?? '{}') as Record<string, unknown>,
      output: JSON.parse((r.output_json as string) ?? '{}') as Record<string, unknown>,
      success: (r.success as number) === 1,
      durationMs: r.duration_ms as number,
      timestamp: r.timestamp as number,
      tags: JSON.parse((r.tags_json as string) ?? '[]') as string[],
    }))
  }

  async count(): Promise<number> {
    return this.p.episodicMemory.count() as Promise<number>
  }
}
