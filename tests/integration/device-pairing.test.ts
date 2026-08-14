import { describe, expect, it } from 'bun:test'
import { EncryptionEngine } from '../../src/engines/encryption.js'
import type { SyncConfig, SyncPeer, SyncStore } from '../../src/engines/sync.js'
import { SyncEngine } from '../../src/engines/sync.js'

// In-memory SyncStore satisfying the contract used by the pairing flow.
class MemorySyncStore implements SyncStore {
  private peers = new Map<string, SyncPeer>()
  async createPeer(peer: SyncPeer): Promise<void> {
    this.peers.set(peer.deviceId, peer)
  }
  async updatePeer(id: string, patch: Partial<SyncPeer>): Promise<void> {
    const peer = this.peers.get(id) ?? [...this.peers.values()].find((p) => p.id === id)
    if (peer) this.peers.set(peer.deviceId, { ...peer, ...patch })
  }
  async getPeers(): Promise<SyncPeer[]> {
    return [...this.peers.values()]
  }
  async getPeer(deviceId: string): Promise<SyncPeer | null> {
    return this.peers.get(deviceId) ?? null
  }
  async createLogEntry(): Promise<void> {}
  async getUnsyncedEntries(): Promise<never[]> {
    return []
  }
  async markSynced(): Promise<void> {}
}

function makeEngine(): SyncEngine {
  const config: SyncConfig = {
    enabled: true,
    deviceId: 'device-A',
    relayUrl: 'http://localhost:0',
    syncIntervalMs: 1000,
    conflictResolution: 'last_write_wins',
  }
  return new SyncEngine(new MemorySyncStore(), config, new EncryptionEngine())
}

describe('device-pairing (36.4)', () => {
  it('A issues a code, B pairs, both see the paired device; revoke removes it', async () => {
    const engine = makeEngine()
    const deviceB = 'device-B'

    // Device A initiates pairing for the new device.
    const { pairingCode } = await engine.pair(deviceB, 'Laptop B')
    expect(pairingCode).toMatch(/^\d{6}$/)

    // Device B enters the code to confirm.
    await engine.confirmPair(deviceB, pairingCode)

    const paired = (await engine.getPeers()).filter((p) => p.status === 'paired')
    expect(paired.length).toBe(1)
    expect(paired[0]?.deviceId).toBe(deviceB)
    expect(paired[0]?.name).toBe('Laptop B')

    // Revoke removes it from the paired set.
    await engine.revokePeer(deviceB)
    const afterRevoke = (await engine.getPeers()).filter((p) => p.status === 'paired')
    expect(afterRevoke.length).toBe(0)
  })

  it('wrong code is rejected', async () => {
    const engine = makeEngine()
    const { pairingCode } = await engine.pair('device-C', 'Phone C')
    expect(pairingCode).toBeDefined()
    await expect(engine.confirmPair('device-C', '000000')).rejects.toThrow()
  })
})
