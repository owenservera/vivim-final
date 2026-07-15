// src/storage/impl/sync-store-impl.ts
// PrismaStoreImpl for SyncStore contract — Phase 20.6

import type { SyncLogEntry, SyncPeer, SyncStore } from '../../engines/sync.js'
import type { CapStoreDb } from '../db.js'

export class SyncStoreImpl implements SyncStore {
  constructor(private db: CapStoreDb) {}

  async createLogEntry(entry: SyncLogEntry): Promise<void> {
    await this.db.prisma.syncLog.create({
      data: {
        id: entry.id,
        deviceId: entry.deviceId,
        table: entry.table,
        recordId: entry.recordId,
        operation: entry.operation,
        dataJson: entry.dataJson,
        ts: entry.ts,
        syncedAt: entry.syncedAt,
      },
    })
  }

  async getUnsyncedEntries(deviceId: string, limit?: number): Promise<SyncLogEntry[]> {
    const rows = await this.db.prisma.syncLog.findMany({
      where: { deviceId, syncedAt: null },
      orderBy: { ts: 'asc' },
      take: limit ?? 100,
    })
    return rows.map((r) => ({
      id: r.id,
      deviceId: r.deviceId,
      table: r.table,
      recordId: r.recordId,
      operation: r.operation as SyncLogEntry['operation'],
      dataJson: r.dataJson,
      ts: Number(r.ts),
      syncedAt: r.syncedAt == null ? null : Number(r.syncedAt),
    }))
  }

  async markSynced(ids: string[]): Promise<void> {
    const now = Date.now()
    await this.db.prisma.syncLog.updateMany({
      where: { id: { in: ids } },
      data: { syncedAt: now },
    })
  }

  async createPeer(peer: SyncPeer): Promise<void> {
    await this.db.prisma.syncPeer.create({
      data: {
        id: peer.id,
        deviceId: peer.deviceId,
        name: peer.name,
        publicKey: peer.publicKey,
        lastSyncAt: peer.lastSyncAt,
        status: peer.status,
        pairedAt: peer.pairedAt ?? null,
      },
    })
  }

  async updatePeer(id: string, patch: Partial<SyncPeer>): Promise<void> {
    const data: Record<string, unknown> = {}
    if (patch.name !== undefined) data.name = patch.name
    if (patch.publicKey !== undefined) data.publicKey = patch.publicKey
    if (patch.lastSyncAt !== undefined) data.lastSyncAt = patch.lastSyncAt
    if (patch.status !== undefined) data.status = patch.status
    if (patch.pairedAt !== undefined) data.pairedAt = patch.pairedAt
    await this.db.prisma.syncPeer.update({
      where: { id },
      data,
    })
  }

  async getPeers(): Promise<SyncPeer[]> {
    const rows = await this.db.prisma.syncPeer.findMany()
    return rows.map((r) => ({
      id: r.id,
      deviceId: r.deviceId,
      name: r.name,
      publicKey: r.publicKey,
      lastSyncAt: Number(r.lastSyncAt),
      status: r.status as SyncPeer['status'],
      pairedAt: r.pairedAt == null ? undefined : Number(r.pairedAt),
    }))
  }

  async getPeer(deviceId: string): Promise<SyncPeer | null> {
    const row = await this.db.prisma.syncPeer.findUnique({
      where: { deviceId },
    })
    if (!row) return null
    return {
      id: row.id,
      deviceId: row.deviceId,
      name: row.name,
      publicKey: row.publicKey,
      lastSyncAt: Number(row.lastSyncAt),
      status: row.status as SyncPeer['status'],
      pairedAt: row.pairedAt == null ? undefined : Number(row.pairedAt),
    }
  }
}
