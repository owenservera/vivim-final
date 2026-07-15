// src/engines/eviction-manager.ts
// Unit 8.1 — Idle slave TTL + configurable eviction policy.

import type { CapabilityEventBus } from './capability-event-bus.js'
import type { ChromeGovernor, ChromeSlave } from './chrome-governor.js'

export interface EvictionPolicy {
  enabled: boolean
  idleTtlMs: number
  maxConcurrentSlaves: number
  maxPerProvider: number
  evictionStrategy: 'lru' | 'lfu' | 'fifo' | 'idle_first'
  checkIntervalMs: number
  warmPoolSize: number
  onEvict: 'kill' | 'suspend'
  minUptimeBeforeEvictMs: number
}

const DEFAULT_POLICY: EvictionPolicy = {
  enabled: true,
  idleTtlMs: 5 * 60_000,
  maxConcurrentSlaves: 12,
  maxPerProvider: 4,
  evictionStrategy: 'idle_first',
  checkIntervalMs: 60_000,
  warmPoolSize: 1,
  onEvict: 'kill',
  minUptimeBeforeEvictMs: 30_000,
}

interface AccessRecord {
  lastAccess: number
  accessCount: number
  createdAt: number
}

export class EvictionManager {
  private timer: ReturnType<typeof setInterval> | null = null
  private accessLog = new Map<string, AccessRecord>()
  private policy: EvictionPolicy = DEFAULT_POLICY

  constructor(
    private governor: ChromeGovernor,
    private eventBus: CapabilityEventBus,
  ) {
    this.eventBus.on(
      'capability:executed' as any,
      ((e: any) => {
        if (e.slaveId) this.recordAccess(e.slaveId)
      }) as any,
    )
  }

  start(): void {
    this.stop()
    this.timer = setInterval(() => void this.runCheck(), this.policy.checkIntervalMs)
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer)
    this.timer = null
  }

  recordAccess(slaveId: string): void {
    const existing = this.accessLog.get(slaveId)
    if (existing) {
      existing.lastAccess = Date.now()
      existing.accessCount++
    } else {
      this.accessLog.set(slaveId, {
        lastAccess: Date.now(),
        accessCount: 1,
        createdAt: Date.now(),
      })
    }
  }

  private async runCheck(): Promise<void> {
    try {
      const slaves = this.governor.getAllSlaves()
      const now = Date.now()

      // Enforce max concurrent
      if (slaves.length > this.policy.maxConcurrentSlaves) {
        const excess = slaves.length - this.policy.maxConcurrentSlaves
        const toEvict = this.selectForEviction(slaves, excess, now)
        for (const slave of toEvict) {
          await this.evict(slave.id)
        }
      }

      // Evict idle slaves
      for (const slave of slaves) {
        const record = this.accessLog.get(slave.slaveId)
        const idleTime = record ? now - record.lastAccess : 0
        if (idleTime > this.policy.idleTtlMs) {
          await this.evict(slave.slaveId)
        }
      }
    } catch {
      // Governor may not be ready yet
    }
  }

  private selectForEviction(
    slaves: ChromeSlave[],
    count: number,
    now: number,
  ): Array<{ id: string }> {
    const scored = slaves.map((s) => {
      const record = this.accessLog.get(s.slaveId)
      const idleTime = record ? now - record.lastAccess : 0
      const score =
        this.policy.evictionStrategy === 'lfu'
          ? -(record?.accessCount ?? 0)
          : this.policy.evictionStrategy === 'fifo'
            ? 0
            : idleTime
      return { id: s.slaveId, score }
    })
    scored.sort((a, b) => a.score - b.score)
    return scored.slice(0, count)
  }

  private async evict(slaveId: string): Promise<void> {
    try {
      if (this.policy.onEvict === 'kill') {
        await this.governor.kill(slaveId)
      }
      this.accessLog.delete(slaveId)
    } catch {
      // Slave may already be dead
    }
  }
}
