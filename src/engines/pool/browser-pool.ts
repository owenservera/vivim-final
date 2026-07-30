// src/engines/pool/browser-pool.ts
// BrowserPool — warm browser pool with ephemeral and authenticated pools.
// Phase 4: Eliminates cold startup via warm pools.
//
// Design decisions (ADR-0005):
// - Ephemeral Pool: Reusable, provider-free browsers (generic web automation)
// - Authenticated Pool: Pinned 1:1 to (provider, account). No session reuse.
// - Profile swapping rejected due to fragility (SingletonLock, cookie corruption).

import type { SlaveId, ProviderId, AccountId } from '../../domain/types.js'
import { createSlaveId, createProviderId, createAccountId } from '../../domain/types.js'
import { Lease } from './lease.js'
import { getLogger } from '../../observability/logger.js'
import { getMetrics } from '../../observability/metrics.js'

// ── Types ───────────────────────────────────────────────────────────────────

export interface PoolOptions {
  minWarm: number
  maxWarm: number
  maxIdleMs: number
  maxLeasesPerSlave: number
}

export interface PoolSlave {
  id: SlaveId
  debugPort: number
  profileDir: string
  providerId?: ProviderId
  accountId?: AccountId
  createdAt: number
  lastUsed: number
  leaseCount: number
}

export interface AcquireResult {
  slaveId: SlaveId
  debugPort: number
  lease: Lease
}

// ── Browser Pool ────────────────────────────────────────────────────────────

export class BrowserPool {
  private ephemeralPool: PoolSlave[] = []
  private authenticatedPool = new Map<string, PoolSlave>() // key: providerId:accountId
  private leases = new Map<string, Lease>() // key: slaveId
  private logger = getLogger('BrowserPool')
  private metrics = getMetrics()
  private opts: Required<PoolOptions>
  private warmTimer: ReturnType<typeof setInterval> | null = null

  constructor(
    private spawnFn: (providerId?: string, accountId?: string) => Promise<{ slaveId: string; debugPort: number; profileDir: string }>,
    options?: Partial<PoolOptions>,
  ) {
    this.opts = {
      minWarm: options?.minWarm ?? 2,
      maxWarm: options?.maxWarm ?? 10,
      maxIdleMs: options?.maxIdleMs ?? 300_000, // 5 min
      maxLeasesPerSlave: options?.maxLeasesPerSlave ?? 1,
    }
  }

  /**
   * Start the warm spawner.
   */
  start(): void {
    this.logger.info('Starting browser pool', { opts: this.opts })
    this.warmTimer = setInterval(() => this.maintainWarmPool(), 30_000)
    this.fillPool()
  }

  /**
   * Stop the pool and drain all browsers.
   */
  async stop(): Promise<void> {
    if (this.warmTimer) {
      clearInterval(this.warmTimer)
      this.warmTimer = null
    }
    await this.drain()
  }

  /**
   * Acquire a browser from the pool.
   */
  async acquire(providerId?: string, accountId?: string): Promise<AcquireResult> {
    // For provider-specific, try authenticated pool first
    if (providerId && accountId) {
      const key = `${providerId}:${accountId}`
      const slave = this.authenticatedPool.get(key)
      if (slave) {
        this.authenticatedPool.delete(key)
        const lease = new Lease(slave.id, createProviderId(providerId), createAccountId(accountId))
        this.leases.set(slave.id, lease)
        slave.lastUsed = Date.now()
        slave.leaseCount++
        this.logger.info('Acquired from authenticated pool', { slaveId: slave.id, providerId, accountId })
        this.metrics.incCounter('chrome_pool_leases_total', { provider: providerId, hit: 'true' })
        return { slaveId: slave.id, debugPort: slave.debugPort, lease }
      }
    }

    // Try ephemeral pool
    if (this.ephemeralPool.length > 0) {
      const slave = this.ephemeralPool.pop()!
      const lease = new Lease(
        slave.id,
        createProviderId(providerId ?? 'generic'),
        createAccountId(accountId ?? 'anonymous'),
      )
      this.leases.set(slave.id, lease)
      slave.lastUsed = Date.now()
      slave.leaseCount++
      this.logger.info('Acquired from ephemeral pool', { slaveId: slave.id })
      this.metrics.incCounter('chrome_pool_leases_total', { provider: providerId ?? 'generic', hit: 'true' })
      return { slaveId: slave.id, debugPort: slave.debugPort, lease }
    }

    // Pool miss — spawn new
    this.logger.info('Pool miss, spawning new browser', { providerId, accountId })
    this.metrics.incCounter('chrome_pool_leases_total', { provider: providerId ?? 'generic', hit: 'false' })
    const result = await this.spawnFn(providerId, accountId)
    const lease = new Lease(
      createSlaveId(result.slaveId),
      createProviderId(providerId ?? 'generic'),
      createAccountId(accountId ?? 'anonymous'),
    )
    this.leases.set(result.slaveId, lease)
    return { slaveId: createSlaveId(result.slaveId), debugPort: result.debugPort, lease }
  }

  /**
   * Release a browser back to the pool.
   */
  async release(slaveId: string, healthy = true): Promise<void> {
    const lease = this.leases.get(slaveId)
    if (!lease) return

    this.leases.delete(slaveId)

    // Find the slave
    const slave = this.findSlave(slaveId)
    if (!slave) return

    if (!healthy) {
      // Destroy unhealthy slave
      this.logger.info('Destroying unhealthy slave', { slaveId })
      this.removeSlave(slave)
      return
    }

    // Check if expired
    if (lease.isExpired()) {
      this.logger.info('Destroying expired slave', { slaveId })
      this.removeSlave(slave)
      return
    }

    // Return to appropriate pool
    if (lease.providerId === 'generic' || lease.accountId === 'anonymous') {
      if (this.ephemeralPool.length < this.opts.maxWarm) {
        this.ephemeralPool.push(slave)
        this.logger.info('Returned to ephemeral pool', { slaveId })
      } else {
        this.removeSlave(slave)
      }
    } else {
      // Authenticated slaves are destroyed on release (no session reuse)
      this.logger.info('Destroying authenticated slave', { slaveId, providerId: lease.providerId })
      this.removeSlave(slave)
    }
  }

  /**
   * Drain all browsers from the pool.
   */
  async drain(): Promise<void> {
    this.logger.info('Draining pool')
    this.ephemeralPool = []
    this.authenticatedPool.clear()
    this.leases.clear()
  }

  /**
   * Get pool statistics.
   */
  stats(): { ephemeral: number; authenticated: number; leased: number } {
    return {
      ephemeral: this.ephemeralPool.length,
      authenticated: this.authenticatedPool.size,
      leased: this.leases.size,
    }
  }

  // ── Private Methods ─────────────────────────────────────────────────────

  private async fillPool(): Promise<void> {
    const toSpawn = this.opts.minWarm - this.ephemeralPool.length
    for (let i = 0; i < toSpawn; i++) {
      try {
        const result = await this.spawnFn()
        this.ephemeralPool.push({
          id: createSlaveId(result.slaveId),
          debugPort: result.debugPort,
          profileDir: result.profileDir,
          createdAt: Date.now(),
          lastUsed: Date.now(),
          leaseCount: 0,
        })
      } catch (err) {
        this.logger.error('Failed to pre-warm pool', { error: err instanceof Error ? err.message : String(err) })
      }
    }
  }

  private async maintainWarmPool(): Promise<void> {
    // Remove idle slaves
    const now = Date.now()
    this.ephemeralPool = this.ephemeralPool.filter((slave) => {
      if (now - slave.lastUsed > this.opts.maxIdleMs) {
        this.logger.info('Removing idle slave', { slaveId: slave.id })
        return false
      }
      return true
    })

    // Fill pool if below minimum
    await this.fillPool()
  }

  private findSlave(slaveId: string): PoolSlave | undefined {
    return this.ephemeralPool.find((s) => s.id === slaveId) ??
      Array.from(this.authenticatedPool.values()).find((s) => s.id === slaveId)
  }

  private removeSlave(slave: PoolSlave): void {
    this.ephemeralPool = this.ephemeralPool.filter((s) => s.id !== slave.id)
    for (const [key, s] of this.authenticatedPool) {
      if (s.id === slave.id) {
        this.authenticatedPool.delete(key)
        break
      }
    }
  }
}
