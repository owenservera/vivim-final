// src/storage/impl/harness-checkpoint-store-impl.ts
// PrismaStoreImpl for HarnessCheckpointStore contract — Phase 21.1.3

import type {
  HarnessCheckpointRow,
  HarnessCheckpointStore,
} from '../../engines/harness-checkpoint.js'
import type { CapStoreDb } from '../db.js'

export class HarnessCheckpointStoreImpl implements HarnessCheckpointStore {
  constructor(private db: CapStoreDb) {}

  async create(input: HarnessCheckpointRow): Promise<HarnessCheckpointRow> {
    await this.db.prisma.harnessCheckpoint.create({
      data: {
        id: input.id,
        slaveId: input.slaveId,
        conversationId: input.conversationId ?? null,
        activeDagJson: input.activeDagJson ?? null,
        dagPosition: input.dagPosition ?? null,
        loadedModulesJson: input.loadedModulesJson,
        pageUrl: input.pageUrl ?? null,
        pageTitle: input.pageTitle ?? null,
        authState: input.authState ?? null,
        createdAt: input.createdAt,
      },
    })
    return input
  }

  async getLatestBySlave(slaveId: string): Promise<HarnessCheckpointRow | null> {
    const row = await this.db.prisma.harnessCheckpoint.findFirst({
      where: { slaveId },
      orderBy: { createdAt: 'desc' },
    })
    if (!row) return null
    return this.toRow(row)
  }

  async getLatestByConversation(conversationId: string): Promise<HarnessCheckpointRow | null> {
    const row = await this.db.prisma.harnessCheckpoint.findFirst({
      where: { conversationId },
      orderBy: { createdAt: 'desc' },
    })
    if (!row) return null
    return this.toRow(row)
  }

  async deleteBySlave(slaveId: string): Promise<void> {
    await this.db.prisma.harnessCheckpoint.deleteMany({ where: { slaveId } })
  }

  private toRow(r: {
    id: string
    slaveId: string
    conversationId: string | null
    activeDagJson: string | null
    dagPosition: number | null
    loadedModulesJson: string
    pageUrl: string | null
    pageTitle: string | null
    authState: string | null
    createdAt: bigint
  }): HarnessCheckpointRow {
    return {
      id: r.id,
      slaveId: r.slaveId,
      conversationId: r.conversationId,
      activeDagJson: r.activeDagJson,
      dagPosition: r.dagPosition,
      loadedModulesJson: r.loadedModulesJson,
      pageUrl: r.pageUrl,
      pageTitle: r.pageTitle,
      authState: r.authState,
      createdAt: Number(r.createdAt),
    }
  }
}
