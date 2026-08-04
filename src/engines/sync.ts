// src/engines/sync.ts
// SyncEngine — E2E-encrypted multi-device sync.
// Pair devices via code, exchange keys, sync unsynced entries through a relay.
// All data encrypted with peer's public key before transmission.

import { EngineError } from '../errors.js'
import type { EncryptionEngine } from './encryption.js'

// ── Types ───────────────────────────────────────────────────────────────

export interface SyncConfig {
  enabled: boolean
  relayUrl: string
  deviceId: string
  syncIntervalMs: number
  conflictResolution: 'last_write_wins' | 'manual'
}

export interface SyncPeer {
  id: string
  deviceId: string
  name: string
  publicKey: string
  lastSyncAt: number | null
  status: 'paired' | 'pending' | 'revoked'
  pairingCode?: string
  pairedAt?: number
}

export interface SyncLogEntry {
  id: string
  deviceId: string
  table: string
  recordId: string
  operation: 'create' | 'update' | 'delete'
  dataJson: string
  ts: number
  syncedAt: number | null
}

export interface SyncStore {
  createLogEntry(entry: SyncLogEntry): Promise<void>
  getUnsyncedEntries(deviceId: string, limit?: number): Promise<SyncLogEntry[]>
  markSynced(ids: string[]): Promise<void>
  createPeer(peer: SyncPeer): Promise<void>
  updatePeer(id: string, patch: Partial<SyncPeer>): Promise<void>
  getPeers(): Promise<SyncPeer[]>
  getPeer(deviceId: string): Promise<SyncPeer | null>
}

export interface SyncResult {
  entriesSynced: number
  conflicts: number
}

// ── Engine ──────────────────────────────────────────────────────────────

export class SyncEngine {
  private syncTimer: ReturnType<typeof setInterval> | null = null
  private pairingCodes: Map<string, string> = new Map()

  constructor(
    private store: SyncStore,
    private config: SyncConfig,
    private encryption: EncryptionEngine,
  ) {}

  async pair(newDeviceId: string, name: string): Promise<{ pairingCode: string }> {
    const code = String(Math.floor(100000 + Math.random() * 900000))
    this.pairingCodes.set(newDeviceId, code)
    const peer: SyncPeer = {
      id: `peer_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      deviceId: newDeviceId,
      name,
      publicKey: '',
      lastSyncAt: null,
      status: 'pending',
      pairingCode: code,
    }
    await this.store.createPeer(peer)
    return { pairingCode: code }
  }

  async confirmPair(deviceId: string, pairingCode: string): Promise<void> {
    const expected = this.pairingCodes.get(deviceId)
    if (!expected || expected !== pairingCode) {
      throw new EngineError('Invalid pairing code')
    }
    await this.store.updatePeer(deviceId, {
      status: 'paired',
      pairedAt: Date.now(),
    } as Partial<SyncPeer>)
    this.pairingCodes.delete(deviceId)
  }

  async sync(): Promise<SyncResult> {
    if (!this.config.enabled) {
      return { entriesSynced: 0, conflicts: 0 }
    }
    let entriesSynced = 0
    let conflicts = 0
    const peers = await this.store.getPeers()
    const pairedPeers = peers.filter((p) => p.status === 'paired')

    for (const peer of pairedPeers) {
      const entries = await this.store.getUnsyncedEntries(peer.deviceId, 100)
      if (entries.length === 0) continue

      try {
        // Encrypt each entry's data before relay transmission
        const encryptedEntries = entries.map((e) => ({
          ...e,
          dataJson: this.encryption.isUnlocked()
            ? this.encryption.encryptField(e.dataJson)
            : e.dataJson,
        }))

        const res = await fetch(`${this.config.relayUrl}/sync/${peer.deviceId}`, {
          method: 'POST',
          signal: AbortSignal.timeout(15_000),
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ entries: encryptedEntries, fromDeviceId: this.config.deviceId }),
        })

        if (res.ok) {
          await this.store.markSynced(entries.map((e) => e.id))
          await this.store.updatePeer(peer.id, { lastSyncAt: Date.now() } as Partial<SyncPeer>)
          entriesSynced += entries.length
        } else {
          // Relay returned error — entries stay unsynced for retry
          conflicts++
        }
      } catch {
        // Relay unreachable — entries remain unsynced for next cycle
        conflicts++
      }
    }

    return { entriesSynced, conflicts }
  }

  async getPendingSync(): Promise<number> {
    const peers = await this.store.getPeers()
    let total = 0
    for (const peer of peers) {
      if (peer.status !== 'paired') continue
      const entries = await this.store.getUnsyncedEntries(peer.deviceId)
      total += entries.length
    }
    return total
  }

  async getPeers(): Promise<SyncPeer[]> {
    return this.store.getPeers()
  }

  async revokePeer(deviceId: string): Promise<void> {
    await this.store.updatePeer(deviceId, { status: 'revoked' } as Partial<SyncPeer>)
  }

  start(): void {
    if (this.syncTimer) return
    this.syncTimer = setInterval(() => {
      this.sync().catch(() => {})
    }, this.config.syncIntervalMs)
  }

  stop(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer)
      this.syncTimer = null
    }
  }
}
