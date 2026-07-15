// src/engines/lock-manager.ts
// Unit 7.3 — Conversation locking: configurable lock policy.

import { EngineError } from '../errors.js'

export interface LockPolicy {
  scope: 'conversation' | 'provider' | 'global'
  strategy: 'mutex' | 'queue' | 'reject'
  timeoutMs: number
  queueMaxSize: number
}

interface LockEntry {
  owner: string
  acquiredAt: number
  timeout: ReturnType<typeof setTimeout>
}

const DEFAULT_POLICY: LockPolicy = {
  scope: 'conversation',
  strategy: 'mutex',
  timeoutMs: 60_000,
  queueMaxSize: 5,
}

export class LockManager {
  private locks = new Map<string, LockEntry>()
  private queues = new Map<string, Array<{ resolve: () => void; reject: (e: Error) => void }>>()
  private policy: LockPolicy = DEFAULT_POLICY

  async acquire(key: string, owner: string): Promise<void> {
    if (this.policy.strategy === 'reject') {
      const existing = this.locks.get(key)
      if (existing) {
        throw new EngineError(`Lock held by ${existing.owner}`)
      }
    }

    if (this.policy.strategy === 'queue') {
      return this.acquireQueued(key, owner)
    }

    // Mutex strategy
    return this.acquireMutex(key, owner)
  }

  release(key: string, owner: string): void {
    const entry = this.locks.get(key)
    if (entry && entry.owner === owner) {
      clearTimeout(entry.timeout)
      this.locks.delete(key)

      // Wake next in queue
      const queue = this.queues.get(key)
      if (queue && queue.length > 0) {
        const next = queue.shift()!
        this.locks.set(key, {
          owner,
          acquiredAt: Date.now(),
          timeout: setTimeout(() => this.release(key, owner), this.policy.timeoutMs),
        })
        next.resolve()
      }
    }
  }

  isLocked(key: string): boolean {
    return this.locks.has(key)
  }

  getLockOwner(key: string): string | null {
    return this.locks.get(key)?.owner ?? null
  }

  private async acquireMutex(key: string, owner: string): Promise<void> {
    const existing = this.locks.get(key)
    if (!existing) {
      this.locks.set(key, {
        owner,
        acquiredAt: Date.now(),
        timeout: setTimeout(() => this.release(key, owner), this.policy.timeoutMs),
      })
      return
    }

    // Wait for release
    return new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new EngineError(`Lock timeout after ${this.policy.timeoutMs}ms`))
      }, this.policy.timeoutMs)

      const check = setInterval(() => {
        if (!this.locks.has(key)) {
          clearInterval(check)
          clearTimeout(timeout)
          this.locks.set(key, {
            owner,
            acquiredAt: Date.now(),
            timeout: setTimeout(() => this.release(key, owner), this.policy.timeoutMs),
          })
          resolve()
        }
      }, 50)
    })
  }

  private async acquireQueued(key: string, owner: string): Promise<void> {
    const existing = this.locks.get(key)
    if (!existing) {
      this.locks.set(key, {
        owner,
        acquiredAt: Date.now(),
        timeout: setTimeout(() => this.release(key, owner), this.policy.timeoutMs),
      })
      return
    }

    const queue = this.queues.get(key) ?? []
    if (queue.length >= this.policy.queueMaxSize) {
      throw new EngineError(`Lock queue full (${this.policy.queueMaxSize})`)
    }

    return new Promise<void>((resolve, reject) => {
      queue.push({ resolve, reject })
      this.queues.set(key, queue)
    })
  }
}
