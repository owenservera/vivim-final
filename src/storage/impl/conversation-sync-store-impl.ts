// src/storage/impl/conversation-sync-store-impl.ts
// ConversationSyncStoreImpl — Prisma-backed ConversationSyncStateStore.

import { newId } from '../../ids.js'
import type {
  ConversationSyncLogRow,
  ConversationSyncStateRow,
  ConversationSyncStateStore,
} from '../contracts/conversation-store.js'
import type { CapStoreDb } from '../db.js'

// ── Prisma row shapes ──────────────────────────────────────────────────────

interface PrismaSyncState {
  id: string
  providerId: string
  accountId: string
  syncType: string
  status: string
  cursorJson: string
  totalConversations: number
  syncedConversations: number
  failedConversations: number
  lastSyncedAt: number | null
  nextSyncAt: number | null
  errorJson: string | null
  configJson: string
  createdAt: number
  updatedAt: number
}

interface PrismaSyncLog {
  id: string
  providerId: string
  accountId: string
  syncType: string
  status: string
  startedAt: number
  completedAt: number | null
  durationMs: number | null
  conversationsFound: number
  conversationsSynced: number
  conversationsFailed: number
  errorJson: string | null
  metadataJson: string
}

// ── Mappers ──────────────────────────────────────────────────────────────

function toSyncStateRow(r: PrismaSyncState): ConversationSyncStateRow {
  return {
    id: r.id,
    providerId: r.providerId,
    accountId: r.accountId,
    syncType: r.syncType,
    status: r.status,
    cursorJson: r.cursorJson,
    totalConversations: r.totalConversations,
    syncedConversations: r.syncedConversations,
    failedConversations: r.failedConversations,
    lastSyncedAt: r.lastSyncedAt,
    nextSyncAt: r.nextSyncAt,
    errorJson: r.errorJson,
    configJson: r.configJson,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  }
}

function toSyncLogRow(r: PrismaSyncLog): ConversationSyncLogRow {
  return {
    id: r.id,
    providerId: r.providerId,
    accountId: r.accountId,
    syncType: r.syncType,
    status: r.status,
    startedAt: r.startedAt,
    completedAt: r.completedAt,
    durationMs: r.durationMs,
    conversationsFound: r.conversationsFound,
    conversationsSynced: r.conversationsSynced,
    conversationsFailed: r.conversationsFailed,
    errorJson: r.errorJson,
    metadataJson: r.metadataJson,
  }
}

// ── ConversationSyncStoreImpl ────────────────────────────────────────────

export class ConversationSyncStoreImpl implements ConversationSyncStateStore {
  constructor(private db: CapStoreDb) {}

  async getSyncState(providerId: string, accountId: string): Promise<ConversationSyncStateRow | null> {
    const row = await this.db.prisma.conversationSyncState.findUnique({
      where: { providerId_accountId: { providerId, accountId } },
    })
    return row ? toSyncStateRow(row as unknown as PrismaSyncState) : null
  }

  async upsertSyncState(input: {
    providerId: string
    accountId: string
    syncType?: string
    status?: string
    cursorJson?: string
    totalConversations?: number
    syncedConversations?: number
    failedConversations?: number
    errorJson?: string
    configJson?: string
  }): Promise<ConversationSyncStateRow> {
    const now = Date.now()
    const existing = await this.getSyncState(input.providerId, input.accountId)
    
    if (existing) {
      const row = await this.db.prisma.conversationSyncState.update({
        where: { providerId_accountId: { providerId: input.providerId, accountId: input.accountId } },
        data: {
          syncType: input.syncType ?? existing.syncType,
          status: input.status ?? existing.status,
          cursorJson: input.cursorJson ?? existing.cursorJson,
          totalConversations: input.totalConversations ?? existing.totalConversations,
          syncedConversations: input.syncedConversations ?? existing.syncedConversations,
          failedConversations: input.failedConversations ?? existing.failedConversations,
          errorJson: input.errorJson ?? existing.errorJson,
          configJson: input.configJson ?? existing.configJson,
          updatedAt: now,
        },
      })
      return toSyncStateRow(row as unknown as PrismaSyncState)
    }
    
    const row = await this.db.prisma.conversationSyncState.create({
      data: {
        id: newId(),
        providerId: input.providerId,
        accountId: input.accountId,
        syncType: input.syncType ?? 'incremental',
        status: input.status ?? 'pending',
        cursorJson: input.cursorJson ?? '{}',
        totalConversations: input.totalConversations ?? 0,
        syncedConversations: input.syncedConversations ?? 0,
        failedConversations: input.failedConversations ?? 0,
        errorJson: input.errorJson ?? null,
        configJson: input.configJson ?? '{}',
        createdAt: now,
        updatedAt: now,
      },
    })
    return toSyncStateRow(row as unknown as PrismaSyncState)
  }

  async updateSyncStatus(
    providerId: string,
    accountId: string,
    status: string,
    error?: string
  ): Promise<ConversationSyncStateRow> {
    const now = Date.now()
    const data: Record<string, unknown> = { status, updatedAt: now }
    
    if (error) {
      data.errorJson = JSON.stringify({ error, timestamp: now })
    }
    
    if (status === 'completed') {
      data.lastSyncedAt = now
    }
    
    const row = await this.db.prisma.conversationSyncState.update({
      where: { providerId_accountId: { providerId, accountId } },
      data,
    })
    return toSyncStateRow(row as unknown as PrismaSyncState)
  }

  async incrementSyncProgress(
    providerId: string,
    accountId: string,
    synced: number,
    failed: number
  ): Promise<ConversationSyncStateRow> {
    const now = Date.now()
    const row = await this.db.prisma.conversationSyncState.update({
      where: { providerId_accountId: { providerId, accountId } },
      data: {
        syncedConversations: { increment: synced },
        failedConversations: { increment: failed },
        updatedAt: now,
      },
    })
    return toSyncStateRow(row as unknown as PrismaSyncState)
  }

  async getPendingSyncs(): Promise<ConversationSyncStateRow[]> {
    const rows = await this.db.prisma.conversationSyncState.findMany({
      where: { status: 'pending' },
      orderBy: { updatedAt: 'asc' },
      take: 100,
    })
    return rows.map((r) => toSyncStateRow(r as unknown as PrismaSyncState))
  }

  async deleteSyncState(providerId: string, accountId: string): Promise<void> {
    await this.db.prisma.conversationSyncState.delete({
      where: { providerId_accountId: { providerId, accountId } },
    })
  }

  // ── Sync Log Methods ────────────────────────────────────────────────────

  async createSyncLog(input: {
    providerId: string
    accountId: string
    syncType: string
    status: string
  }): Promise<ConversationSyncLogRow> {
    const now = Date.now()
    const row = await this.db.prisma.conversationSyncLog.create({
      data: {
        id: newId(),
        providerId: input.providerId,
        accountId: input.accountId,
        syncType: input.syncType,
        status: input.status,
        startedAt: now,
        conversationsFound: 0,
        conversationsSynced: 0,
        conversationsFailed: 0,
        metadataJson: '{}',
      },
    })
    return toSyncLogRow(row as unknown as PrismaSyncLog)
  }

  async updateSyncLog(
    id: string,
    input: {
      status: string
      completedAt?: number
      durationMs?: number
      conversationsFound?: number
      conversationsSynced?: number
      conversationsFailed?: number
      errorJson?: string
    }
  ): Promise<ConversationSyncLogRow> {
    const data: Record<string, unknown> = { status: input.status }
    
    if (input.completedAt !== undefined) data.completedAt = input.completedAt
    if (input.durationMs !== undefined) data.durationMs = input.durationMs
    if (input.conversationsFound !== undefined) data.conversationsFound = input.conversationsFound
    if (input.conversationsSynced !== undefined) data.conversationsSynced = input.conversationsSynced
    if (input.conversationsFailed !== undefined) data.conversationsFailed = input.conversationsFailed
    if (input.errorJson !== undefined) data.errorJson = input.errorJson
    
    const row = await this.db.prisma.conversationSyncLog.update({
      where: { id },
      data,
    })
    return toSyncLogRow(row as unknown as PrismaSyncLog)
  }

  async getSyncLogs(
    providerId: string,
    accountId: string,
    opts?: { limit?: number; offset?: number }
  ): Promise<ConversationSyncLogRow[]> {
    const rows = await this.db.prisma.conversationSyncLog.findMany({
      where: { providerId, accountId },
      orderBy: { startedAt: 'desc' },
      take: opts?.limit ?? 50,
      skip: opts?.offset ?? 0,
    })
    return rows.map((r) => toSyncLogRow(r as unknown as PrismaSyncLog))
  }
}
