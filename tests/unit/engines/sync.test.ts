// tests/unit/engines/sync.test.ts
// SyncEngine — E2E-encrypted multi-device sync tests

import { beforeEach, describe, expect, test } from 'bun:test'
import { EncryptionEngine } from '../../../src/engines/encryption.js'
import {
  type SyncConfig,
  SyncEngine,
  type SyncLogEntry,
  type SyncPeer,
  type SyncStore,
} from '../../../src/engines/sync.js'

function createMockStore(): SyncStore & { peers: SyncPeer[]; entries: SyncLogEntry[] } {
  const peers: SyncPeer[] = []
  const entries: SyncLogEntry[] = []
  return {
    peers,
    entries,
    async createPeer(peer) {
      peers.push(peer)
    },
    async updatePeer(idOrDeviceId, patch) {
      const peer = peers.find((p) => p.id === idOrDeviceId || p.deviceId === idOrDeviceId)
      if (peer) Object.assign(peer, patch)
    },
    async getPeers() {
      return peers
    },
    async getPeer(deviceId) {
      return peers.find((p) => p.deviceId === deviceId) ?? null
    },
    async createLogEntry(entry) {
      entries.push(entry)
    },
    async getUnsyncedEntries(deviceId, limit) {
      return entries
        .filter((e) => e.deviceId === deviceId && e.syncedAt === null)
        .slice(0, limit ?? 100)
    },
    async markSynced(ids) {
      for (const e of entries) {
        if (ids.includes(e.id)) e.syncedAt = Date.now()
      }
    },
  }
}

function makeConfig(overrides?: Partial<SyncConfig>): SyncConfig {
  return {
    enabled: true,
    relayUrl: 'http://localhost:19999',
    deviceId: 'device-local',
    syncIntervalMs: 60_000,
    conflictResolution: 'last_write_wins',
    ...overrides,
  }
}

describe('SyncEngine', () => {
  let encryption: EncryptionEngine

  beforeEach(async () => {
    encryption = new EncryptionEngine()
    await encryption.unlock('test-passphrase')
  })

  test('pair creates pending peer with valid 6-digit pairing code', async () => {
    const store = createMockStore()
    const engine = new SyncEngine(store, makeConfig(), encryption)
    const { pairingCode } = await engine.pair('device-remote', 'Laptop')
    expect(pairingCode).toMatch(/^\d{6}$/)
    expect(store.peers).toHaveLength(1)
    expect(store.peers[0]?.status).toBe('pending')
    expect(store.peers[0]?.deviceId).toBe('device-remote')
    expect(store.peers[0]?.name).toBe('Laptop')
  })

  test('confirmPair activates peer when code matches', async () => {
    const store = createMockStore()
    const engine = new SyncEngine(store, makeConfig(), encryption)
    const { pairingCode } = await engine.pair('device-remote', 'Laptop')
    await engine.confirmPair('device-remote', pairingCode)
    const peer = store.peers[0]
    expect(peer?.status).toBe('paired')
    expect(peer?.pairedAt).toBeTruthy()
  })

  test('confirmPair throws on wrong code', async () => {
    const store = createMockStore()
    const engine = new SyncEngine(store, makeConfig(), encryption)
    await engine.pair('device-remote', 'Laptop')
    expect(engine.confirmPair('device-remote', '000000')).rejects.toThrow('Invalid pairing code')
  })

  test('sync returns 0 when no paired peers', async () => {
    const store = createMockStore()
    const engine = new SyncEngine(store, makeConfig(), encryption)
    const result = await engine.sync()
    expect(result.entriesSynced).toBe(0)
    expect(result.conflicts).toBe(0)
  })

  test('revokePeer sets status to revoked', async () => {
    const store = createMockStore()
    const engine = new SyncEngine(store, makeConfig(), encryption)
    await engine.pair('device-remote', 'Laptop')
    await engine.revokePeer('device-remote')
    expect(store.peers[0]?.status).toBe('revoked')
  })

  test('getPendingSync returns 0 with no paired peers', async () => {
    const store = createMockStore()
    const engine = new SyncEngine(store, makeConfig(), encryption)
    const pending = await engine.getPendingSync()
    expect(pending).toBe(0)
  })

  test('getPeers returns all peers', async () => {
    const store = createMockStore()
    const engine = new SyncEngine(store, makeConfig(), encryption)
    await engine.pair('device-a', 'Phone')
    await engine.pair('device-b', 'Tablet')
    const peers = await engine.getPeers()
    expect(peers).toHaveLength(2)
  })

  test('start/stop manages background interval', async () => {
    const store = createMockStore()
    const engine = new SyncEngine(store, makeConfig({ syncIntervalMs: 100 }), encryption)
    engine.start()
    engine.stop()
    // No error = pass
  })
})
