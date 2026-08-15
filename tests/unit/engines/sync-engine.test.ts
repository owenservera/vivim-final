// tests/unit/engines/sync-engine.test.ts
// SyncEngine — store-contract-backed sync-state tests

import { describe, expect, test, vi } from 'bun:test'
import {
  SyncEngine,
  type SyncState,
  type SyncStateInput,
  type SyncStateStore,
} from '../../../src/engines/sync-engine.js'

function makeStore() {
  const states = new Map<string, SyncState>()
  const bus = { emit: vi.fn() }
  const store: SyncStateStore = {
    upsertSyncState: vi.fn(async (input: SyncStateInput): Promise<SyncState> => {
      const s: SyncState = {
        id: `s-${states.size + 1}`,
        syncDirection: 'pull',
        syncStatus: 'pending',
        syncVersion: 1,
        cursorJson: '{}',
        errorCount: 0,
        itemsSynced: 0,
        itemsFailed: 0,
        bytesSynced: 0,
        metadataJson: '{}',
        createdAt: 1,
        updatedAt: 1,
        ...input,
      }
      states.set(s.id, s)
      return s
    }),
    getSyncState: vi.fn(
      async (p, a, t, e) =>
        [...states.values()].find(
          (s) => s.providerId === p && s.accountId === a && s.entityType === t && s.entityId === e,
        ) ?? null,
    ),
    getSyncStatesByAccount: vi.fn(async (a) =>
      [...states.values()].filter((s) => s.accountId === a),
    ),
    getSyncStatesPending: vi.fn(async () =>
      [...states.values()].filter((s) => s.syncStatus === 'pending'),
    ),
    updateSyncStatus: vi.fn(async (id, status, err) => {
      const cur = states.get(id)!
      const next = { ...cur, syncStatus: status, lastError: err }
      states.set(id, next)
      return next
    }),
    incrementSyncStats: vi.fn(async (id, synced, failed, bytes) => {
      const cur = states.get(id)!
      const next = {
        ...cur,
        itemsSynced: cur.itemsSynced + synced,
        itemsFailed: cur.itemsFailed + failed,
        bytesSynced: cur.bytesSynced + bytes,
      }
      states.set(id, next)
      return next
    }),
    deleteSyncState: vi.fn(async (id) => {
      states.delete(id)
    }),
  }
  return { store, bus }
}

describe('SyncEngine', () => {
  test('upsertSyncState emits', async () => {
    const { store, bus } = makeStore()
    const engine = new SyncEngine(store, bus as never)
    const s = await engine.upsertSyncState({
      providerId: 'p',
      accountId: 'a',
      entityType: 'contact',
      entityId: 'e1',
    })
    expect(s.id).toBeDefined()
    expect(bus.emit).toHaveBeenCalledWith(expect.objectContaining({ type: 'sync:upserted' }))
  })

  test('getSyncState resolves by coordinates', async () => {
    const { store } = makeStore()
    const engine = new SyncEngine(store)
    const s = await engine.upsertSyncState({
      providerId: 'p',
      accountId: 'a',
      entityType: 'contact',
      entityId: 'e1',
    })
    expect((await engine.getSyncState('p', 'a', 'contact', 'e1'))?.id).toBe(s.id)
  })

  test('listSyncStates by account', async () => {
    const { store } = makeStore()
    const engine = new SyncEngine(store)
    await engine.upsertSyncState({
      providerId: 'p',
      accountId: 'a1',
      entityType: 'contact',
      entityId: 'e1',
    })
    await engine.upsertSyncState({
      providerId: 'p',
      accountId: 'a2',
      entityType: 'contact',
      entityId: 'e2',
    })
    expect((await engine.listSyncStates('a1')).length).toBe(1)
  })

  test('getPendingSyncs returns pending only', async () => {
    const { store } = makeStore()
    const engine = new SyncEngine(store)
    const s = await engine.upsertSyncState({
      providerId: 'p',
      accountId: 'a',
      entityType: 'contact',
      entityId: 'e1',
    })
    await engine.updateStatus(s.id, 'completed')
    await engine.upsertSyncState({
      providerId: 'p',
      accountId: 'a',
      entityType: 'contact',
      entityId: 'e2',
    })
    expect((await engine.getPendingSyncs()).length).toBe(1)
  })

  test('updateStatus emits', async () => {
    const { store, bus } = makeStore()
    const engine = new SyncEngine(store, bus as never)
    const s = await engine.upsertSyncState({
      providerId: 'p',
      accountId: 'a',
      entityType: 'contact',
      entityId: 'e1',
    })
    await engine.updateStatus(s.id, 'running', 'oops')
    expect(bus.emit).toHaveBeenCalledWith(expect.objectContaining({ type: 'sync:status' }))
  })

  test('recordSyncProgress accumulates stats', async () => {
    const { store } = makeStore()
    const engine = new SyncEngine(store)
    const s = await engine.upsertSyncState({
      providerId: 'p',
      accountId: 'a',
      entityType: 'contact',
      entityId: 'e1',
    })
    const r = await engine.recordSyncProgress(s.id, 5, 1, 100)
    expect(r.itemsSynced).toBe(5)
    expect(r.bytesSynced).toBe(100)
  })

  test('deleteSyncState emits', async () => {
    const { store, bus } = makeStore()
    const engine = new SyncEngine(store, bus as never)
    const s = await engine.upsertSyncState({
      providerId: 'p',
      accountId: 'a',
      entityType: 'contact',
      entityId: 'e1',
    })
    await engine.deleteSyncState(s.id)
    expect(bus.emit).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'sync:deleted', stateId: s.id }),
    )
  })
})
