import type { CapabilityEventBus } from './capability-event-bus.js'

// ── Types ───────────────────────────────────────────────────────────────

export interface SyncState {
  id: string
  providerId: string
  accountId: string
  entityType: string
  entityId: string
  syncDirection: string
  syncStatus: string
  syncVersion: number
  cursorJson: string
  lastSyncedAt?: number
  nextSyncAt?: number
  errorCount: number
  lastError?: string
  itemsSynced: number
  itemsFailed: number
  bytesSynced: number
  metadataJson: string
  createdAt: number
  updatedAt: number
}

export interface SyncStateInput {
  providerId: string
  accountId: string
  entityType: string
  entityId: string
  syncDirection?: string
  syncStatus?: string
  syncVersion?: number
  cursorJson?: string
  lastSyncedAt?: number
  nextSyncAt?: number
  errorCount?: number
  lastError?: string
  itemsSynced?: number
  itemsFailed?: number
  bytesSynced?: number
  metadataJson?: string
}

// ── Store Contract ──────────────────────────────────────────────────────

export interface SyncStateStore {
  upsertSyncState(input: SyncStateInput): Promise<SyncState>
  getSyncState(
    providerId: string,
    accountId: string,
    entityType: string,
    entityId: string,
  ): Promise<SyncState | null>
  getSyncStatesByAccount(accountId: string): Promise<SyncState[]>
  getSyncStatesPending(): Promise<SyncState[]>
  updateSyncStatus(id: string, status: string, error?: string): Promise<SyncState>
  incrementSyncStats(
    id: string,
    itemsSynced: number,
    itemsFailed: number,
    bytesSynced: number,
  ): Promise<SyncState>
  deleteSyncState(id: string): Promise<void>
}

// ── Engine ──────────────────────────────────────────────────────────────

export class SyncEngine {
  constructor(
    private store: SyncStateStore,
    private eventBus?: CapabilityEventBus,
  ) {}

  async upsertSyncState(input: SyncStateInput): Promise<SyncState> {
    const state = await this.store.upsertSyncState(input)
    this.eventBus?.emit({ type: 'sync:upserted', state } as never)
    return state
  }

  async getSyncState(
    providerId: string,
    accountId: string,
    entityType: string,
    entityId: string,
  ): Promise<SyncState | null> {
    return this.store.getSyncState(providerId, accountId, entityType, entityId)
  }

  async listSyncStates(accountId: string): Promise<SyncState[]> {
    return this.store.getSyncStatesByAccount(accountId)
  }

  async getPendingSyncs(): Promise<SyncState[]> {
    return this.store.getSyncStatesPending()
  }

  async updateStatus(id: string, status: string, error?: string): Promise<SyncState> {
    const state = await this.store.updateSyncStatus(id, status, error)
    this.eventBus?.emit({ type: 'sync:status', state } as never)
    return state
  }

  async recordSyncProgress(
    id: string,
    itemsSynced: number,
    itemsFailed: number,
    bytesSynced: number,
  ): Promise<SyncState> {
    return this.store.incrementSyncStats(id, itemsSynced, itemsFailed, bytesSynced)
  }

  async deleteSyncState(id: string): Promise<void> {
    await this.store.deleteSyncState(id)
    this.eventBus?.emit({ type: 'sync:deleted', stateId: id } as never)
  }
}
