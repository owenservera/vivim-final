// src/storage/impl/sync-store-impl.ts
// Prisma-backed SyncStore — CRUD + lifecycle for SyncState.

import { newId } from '../../ids.js'
import type { CapStoreDb } from '../db.js'

// ── Domain types ────────────────────────────────────────────────────────────

export interface SyncStateRow {
  id: string
  providerId: string
  accountId: string
  entityType: string
  entityId: string
  syncDirection: string
  syncStatus: string
  syncVersion: string | null
  cursorJson: string | null
  lastSyncedAt: number | null
  nextSyncAt: number | null
  errorCount: number
  lastError: string | null
  itemsSynced: number
  itemsFailed: number
  bytesSynced: number
  createdAt: number
  updatedAt: number
}

// ── Store implementation ────────────────────────────────────────────────────

export class SyncStoreImpl {
  protected readonly prisma: any

  constructor(private readonly db: CapStoreDb) {
    this.prisma = db.prisma
  }

  async upsertSyncState(input: {
    providerId: string
    accountId: string
    entityType: string
    entityId: string
    syncDirection?: string
    syncStatus?: string
    cursorJson?: string
  }): Promise<SyncStateRow> {
    const now = Date.now()
    // Try to find existing
    const existing = await this.prisma.syncState.findFirst({
      where: {
        providerId: input.providerId,
        accountId: input.accountId,
        entityType: input.entityType,
        entityId: input.entityId,
      },
    })
    if (existing) {
      const row = await this.prisma.syncState.update({
        where: { id: existing.id },
        data: {
          syncDirection: input.syncDirection ?? existing.syncDirection,
          syncStatus: input.syncStatus ?? existing.syncStatus,
          cursorJson: input.cursorJson ?? existing.cursorJson,
          lastSyncedAt: now,
          updatedAt: now,
        },
      })
      return this.toRow(row)
    }
    const row = await this.prisma.syncState.create({
      data: {
        id: newId(),
        providerId: input.providerId,
        accountId: input.accountId,
        entityType: input.entityType,
        entityId: input.entityId,
        syncDirection: input.syncDirection ?? 'pull',
        syncStatus: input.syncStatus ?? 'pending',
        syncVersion: null,
        cursorJson: input.cursorJson ?? null,
        lastSyncedAt: null,
        nextSyncAt: null,
        errorCount: 0,
        lastError: null,
        itemsSynced: 0,
        itemsFailed: 0,
        bytesSynced: 0,
        createdAt: now,
        updatedAt: now,
      },
    })
    return this.toRow(row)
  }

  async getSyncState(
    providerId: string,
    accountId: string,
    entityType: string,
    entityId: string,
  ): Promise<SyncStateRow | null> {
    const row = await this.prisma.syncState.findFirst({
      where: { providerId, accountId, entityType, entityId },
    })
    return row ? this.toRow(row) : null
  }

  async getSyncStatesByAccount(accountId: string): Promise<SyncStateRow[]> {
    const rows = await this.prisma.syncState.findMany({
      where: { accountId },
      orderBy: { updatedAt: 'desc' },
    })
    return rows.map((r) => this.toRow(r))
  }

  async getSyncStatesPending(): Promise<SyncStateRow[]> {
    const rows = await this.prisma.syncState.findMany({
      where: { syncStatus: 'pending' },
      orderBy: { updatedAt: 'asc' },
      take: 100,
    })
    return rows.map((r) => this.toRow(r))
  }

  async updateSyncStatus(id: string, status: string, error?: string): Promise<SyncStateRow> {
    const now = Date.now()
    const data: Record<string, unknown> = { syncStatus: status, updatedAt: now }
    if (error) {
      data.lastError = error
      data.errorCount = { increment: 1 }
    }
    if (status === 'synced') {
      data.lastSyncedAt = now
    }
    const row = await this.prisma.syncState.update({ where: { id }, data })
    return this.toRow(row)
  }

  async incrementSyncStats(
    id: string,
    itemsSynced: number,
    itemsFailed: number,
    bytesSynced: number,
  ): Promise<SyncStateRow> {
    const now = Date.now()
    const row = await this.prisma.syncState.update({
      where: { id },
      data: {
        itemsSynced: { increment: itemsSynced },
        itemsFailed: { increment: itemsFailed },
        bytesSynced: { increment: bytesSynced },
        lastSyncedAt: now,
        updatedAt: now,
      },
    })
    return this.toRow(row)
  }

  async deleteSyncState(id: string): Promise<void> {
    await this.prisma.syncState.delete({ where: { id } })
  }

  // ── Helpers ─────────────────────────────────────────────────────────────

  private toRow(r: Record<string, unknown>): SyncStateRow {
    return {
      id: r.id,
      providerId: r.providerId,
      accountId: r.accountId,
      entityType: r.entityType,
      entityId: r.entityId,
      syncDirection: r.syncDirection,
      syncStatus: r.syncStatus,
      syncVersion: r.syncVersion,
      cursorJson: r.cursorJson,
      lastSyncedAt: r.lastSyncedAt,
      nextSyncAt: r.nextSyncAt,
      errorCount: r.errorCount,
      lastError: r.lastError,
      itemsSynced: r.itemsSynced,
      itemsFailed: r.itemsFailed,
      bytesSynced: r.bytesSynced,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }
  }
}
