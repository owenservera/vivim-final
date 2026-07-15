// src/storage/impl/knowledge-ingestion-store-impl.ts
// Prisma-backed KnowledgeIngestionStore.

import type { KnowledgeIngestionStore } from '../contracts/knowledge-ingestion-store.js'
import type { CapStoreDb } from '../db.js'

export class KnowledgeIngestionStoreImpl implements KnowledgeIngestionStore {
  constructor(private db: CapStoreDb) {}

  async createImportJob(job: {
    id: string
    source: string
    filePath: string
    status: string
    configJson: string
    startedAt: number
  }): Promise<void> {
    await this.db.prisma.importJob.create({
      data: {
        id: job.id,
        source: job.source,
        filePath: job.filePath,
        status: job.status,
        configJson: job.configJson,
        startedAt: job.startedAt,
      },
    })
  }

  async updateImportJob(
    id: string,
    patch: {
      status?: string
      resultJson?: string
      completedAt?: number
      error?: string
    },
  ): Promise<void> {
    const data: Record<string, unknown> = {}
    if (patch.status !== undefined) data.status = patch.status
    if (patch.resultJson !== undefined) data.resultJson = patch.resultJson
    if (patch.completedAt !== undefined) data.completedAt = patch.completedAt
    if (patch.error !== undefined) data.error = patch.error
    await this.db.prisma.importJob.update({ where: { id }, data })
  }

  async getImportJob(id: string): Promise<{
    id: string
    source: string
    filePath: string
    status: string
    configJson: string
    resultJson: string | null
    startedAt: number
    completedAt: number | null
  } | null> {
    const r = await this.db.prisma.importJob.findUnique({ where: { id } })
    if (!r) return null
    return {
      id: r.id,
      source: r.source,
      filePath: r.filePath,
      status: r.status,
      configJson: r.configJson,
      resultJson: r.resultJson,
      startedAt: Number(r.startedAt),
      completedAt: r.completedAt == null ? null : Number(r.completedAt),
    }
  }

  async listImportJobs(opts?: { limit?: number }): Promise<
    Array<{
      id: string
      source: string
      status: string
      startedAt: number
      completedAt: number | null
    }>
  > {
    const rows = await this.db.prisma.importJob.findMany({
      orderBy: { startedAt: 'desc' },
      take: opts?.limit ?? 50,
    })
    return rows.map((r) => ({
      id: r.id,
      source: r.source,
      status: r.status,
      startedAt: Number(r.startedAt),
      completedAt: r.completedAt == null ? null : Number(r.completedAt),
    }))
  }

  async findExistingConversation(
    sourceProviderId: string,
    externalId: string,
  ): Promise<string | null> {
    const row = await this.db.prisma.conversation.findFirst({
      where: { source: sourceProviderId, externalId },
      select: { id: true },
    })
    return row?.id ?? null
  }
}
