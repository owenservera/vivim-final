// ─── Command Store Implementation ────────────────────────────────────
// Prisma-backed MRU persistence for the command language system.

import type { CommandStore } from '../contracts/command-store.js'

/**
 * In-memory MRU store with periodic flush.
 * For v1, we use an in-memory LRU cache.
 */
export class CommandStoreImpl implements CommandStore {
  private mruCache: Map<string, string[]> = new Map()
  private readonly maxMRU = 50

  async getMRU(userId: string, limit = 10): Promise<string[]> {
    const mru = this.mruCache.get(userId) ?? []
    return mru.slice(0, limit)
  }

  async recordMRU(userId: string, commandId: string): Promise<void> {
    const mru = this.mruCache.get(userId) ?? []
    // Remove if already exists
    const filtered = mru.filter((id) => id !== commandId)
    // Add to front
    filtered.unshift(commandId)
    // Trim to max
    this.mruCache.set(userId, filtered.slice(0, this.maxMRU))
  }

  async clearMRU(userId: string): Promise<void> {
    this.mruCache.delete(userId)
  }
}
