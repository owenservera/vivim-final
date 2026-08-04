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
    this.db = db.loose 
  }

  private get p() {
    return this.db.prisma
  }

  async save(episode: EpisodicMemory): Promise<void> {
    await this.p.episodicMemory.upsert({
      where: { id: episode.id },
      create: {
        id: episode.id,
        providerId: episode.providerId,
        capabilityId: episode.capabilityId ?? null,
        slaveId: episode.slaveId ?? null,
        action: episode.action,
        inputJson: JSON.stringify(episode.input),
        outputJson: JSON.stringify(episode.output),
        success: episode.success ? 1 : 0,
        durationMs: episode.durationMs,
        tagsJson: JSON.stringify(episode.tags),
        timestamp: episode.timestamp,
        createdAt: Date.now(),
      },
      update: {},
    })
  }

  async query(opts: EpisodeQueryOpts): Promise<EpisodicMemory[]> {
    const where: PrismaLoose = {}
    if (opts.providerId) where.providerId = opts.providerId
    if (opts.capabilityId) where.capabilityId = opts.capabilityId
    if (opts.action) where.action = opts.action
    if (opts.since) where.timestamp = { gte: opts.since }
    if (opts.successOnly) where.success = true

    const rows = await this.p.episodicMemory.findMany({
      where,
      orderBy: { timestamp: 'desc' },
      take: opts.limit ?? 50,
    })

    return (rows as PrismaLoose[]).map((r) => ({
      id: r.id as string,
      providerId: r.providerId as string,
      capabilityId: (r.capabilityId as string) ?? undefined,
      slaveId: (r.slaveId as string) ?? undefined,
      action: r.action as string,
      input: JSON.parse((r.inputJson as string) ?? '{}') as Record<string, unknown>,
      output: JSON.parse((r.outputJson as string) ?? '{}') as Record<string, unknown>,
      success: r.success as boolean,
      durationMs: r.durationMs as number,
      timestamp: r.timestamp as number,
      tags: JSON.parse((r.tagsJson as string) ?? '[]') as string[],
    }))
  }

  async count(): Promise<number> {
    return this.p.episodicMemory.count() as Promise<number>
  }

  async findAll(): Promise<EpisodicMemory[]> {
    const rows = await this.p.episodicMemory.findMany({
      orderBy: { timestamp: 'desc' },
    })

    return (rows as PrismaLoose[]).map((r) => ({
      id: r.id as string,
      providerId: r.providerId as string,
      capabilityId: (r.capabilityId as string) ?? undefined,
      slaveId: (r.slaveId as string) ?? undefined,
      action: r.action as string,
      input: JSON.parse((r.inputJson as string) ?? '{}') as Record<string, unknown>,
      output: JSON.parse((r.outputJson as string) ?? '{}') as Record<string, unknown>,
      success: r.success as boolean,
      durationMs: r.durationMs as number,
      timestamp: r.timestamp as number,
      tags: JSON.parse((r.tagsJson as string) ?? '[]') as string[],
    }))
  }
}
