import type { MemoryCuratedRow, MemoryCuratedStore } from '../contracts/memory-curated-store.js'
import type { CapStoreDb } from '../db.js'

export class MemoryCuratedStoreImpl implements MemoryCuratedStore {
  constructor(private readonly db: CapStoreDb) {}

  private get p() {
    return this.db.prisma
  }

  async upsert(row: MemoryCuratedRow): Promise<void> {
    await this.p.memoryCurated.upsert({
      where: { memoryType_memoryId: { memoryType: row.memoryType, memoryId: row.memoryId } },
      create: {
        id: row.id,
        memoryType: row.memoryType,
        memoryId: row.memoryId,
        isPinned: row.isPinned ? 1 : 0,
        isVerified: row.isVerified ? 1 : 0,
        note: row.note,
        curatedAt: Date.now(),
      },
      update: {
        isPinned: row.isPinned ? 1 : 0,
        isVerified: row.isVerified ? 1 : 0,
        note: row.note,
        curatedAt: Date.now(),
      },
    })
  }

  async setPinned(memoryType: string, memoryId: string, pinned: boolean): Promise<void> {
    await this.p.memoryCurated.upsert({
      where: { memoryType_memoryId: { memoryType, memoryId } },
      create: {
        id: `${memoryType}:${memoryId}`,
        memoryType,
        memoryId,
        isPinned: pinned ? 1 : 0,
        curatedAt: Date.now(),
      },
      update: { isPinned: pinned ? 1 : 0, curatedAt: Date.now() },
    })
  }

  async setVerified(memoryType: string, memoryId: string, verified: boolean): Promise<void> {
    await this.p.memoryCurated.upsert({
      where: { memoryType_memoryId: { memoryType, memoryId } },
      create: {
        id: `${memoryType}:${memoryId}`,
        memoryType,
        memoryId,
        isVerified: verified ? 1 : 0,
        curatedAt: Date.now(),
      },
      update: { isVerified: verified ? 1 : 0, curatedAt: Date.now() },
    })
  }

  async list(memoryType?: string): Promise<MemoryCuratedRow[]> {
    const rows = await this.p.memoryCurated.findMany({
      where: memoryType ? { memoryType } : undefined,
      orderBy: { curatedAt: 'desc' },
    })
    return rows.map((r) => ({
      id: r.id,
      memoryType: r.memoryType,
      memoryId: r.memoryId,
      isPinned: r.isPinned === 1,
      isVerified: r.isVerified === 1,
      note: r.note,
    }))
  }
}
