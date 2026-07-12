// src/engines/request-queue.ts
// Unit 8.3 — Request queueing + backpressure with policy.

export interface BackpressurePolicy {
  maxConcurrent: number
  maxQueued: number
  queueTimeoutMs: number
  priorityLevels: number
  fairnessStrategy: 'fifo' | 'priority' | 'weighted_fair'
  shedStrategy: 'reject_newest' | 'reject_oldest' | 'reject_lowest_priority'
  perProviderMaxConcurrent: number
  onShed: 'reject' | 'return_stale' | 'return_error'
}

const DEFAULT_POLICY: BackpressurePolicy = {
  maxConcurrent: 10,
  maxQueued: 50,
  queueTimeoutMs: 30_000,
  priorityLevels: 3,
  fairnessStrategy: 'priority',
  shedStrategy: 'reject_newest',
  perProviderMaxConcurrent: 4,
  onShed: 'reject',
}

interface QueuedRequest<T> {
  id: string
  priority: number
  enqueuedAt: number
  resolve: (value: T) => void
  reject: (error: Error) => void
  execute: () => Promise<T>
  providerId?: string
}

export class RequestQueue<T = unknown> {
  private queue: QueuedRequest<T>[] = []
  private inFlight = 0
  private perProviderInFlight = new Map<string, number>()
  private policy: BackpressurePolicy = DEFAULT_POLICY
  private idCounter = 0

  constructor(policy?: Partial<BackpressurePolicy>) {
    if (policy) this.policy = { ...DEFAULT_POLICY, ...policy }
  }

  async enqueue(
    execute: () => Promise<T>,
    opts?: { priority?: number; providerId?: string; timeoutMs?: number },
  ): Promise<T> {
    const priority = opts?.priority ?? 0

    // Check per-provider limit
    if (opts?.providerId) {
      const providerCount = this.perProviderInFlight.get(opts.providerId) ?? 0
      if (providerCount >= this.policy.perProviderMaxConcurrent) {
        if (this.policy.onShed === 'reject') {
          throw new Error(`Provider ${opts.providerId} at capacity`)
        }
        throw new Error(`Provider ${opts.providerId} at capacity`)
      }
    }

    // Check global limit
    if (this.inFlight >= this.policy.maxConcurrent) {
      if (this.queue.length >= this.policy.maxQueued) {
        this.shed()
      }

      return new Promise<T>((resolve, reject) => {
        const timeout = setTimeout(() => {
          const idx = this.queue.findIndex((r) => r.id === id)
          if (idx !== -1) this.queue.splice(idx, 1)
          reject(new Error('Queue timeout'))
        }, opts?.timeoutMs ?? this.policy.queueTimeoutMs)

        const id = `q_${++this.idCounter}`
        this.queue.push({
          id,
          priority,
          enqueuedAt: Date.now(),
          resolve: (v) => { clearTimeout(timeout); resolve(v) },
          reject: (e) => { clearTimeout(timeout); reject(e) },
          execute,
          providerId: opts?.providerId,
        })
      })
    }

    return this.run(execute, opts?.providerId)
  }

  private async run(execute: () => Promise<T>, providerId?: string): Promise<T> {
    this.inFlight++
    if (providerId) {
      this.perProviderInFlight.set(providerId, (this.perProviderInFlight.get(providerId) ?? 0) + 1)
    }
    try {
      return await execute()
    } finally {
      this.inFlight--
      if (providerId) {
        const count = (this.perProviderInFlight.get(providerId) ?? 1) - 1
        if (count <= 0) this.perProviderInFlight.delete(providerId)
        else this.perProviderInFlight.set(providerId, count)
      }
      this.processQueue()
    }
  }

  private processQueue(): void {
    if (this.queue.length === 0 || this.inFlight >= this.policy.maxConcurrent) return

    // Sort by priority (highest first)
    if (this.policy.fairnessStrategy === 'priority') {
      this.queue.sort((a, b) => b.priority - a.priority)
    }

    const next = this.queue.shift()
    if (next) {
      this.run(next.execute, next.providerId).then(next.resolve).catch(next.reject)
    }
  }

  private shed(): void {
    if (this.queue.length === 0) return
    switch (this.policy.shedStrategy) {
      case 'reject_newest': {
        const newest = this.queue.pop()
        newest?.reject(new Error('Queue full — shedding newest'))
        break
      }
      case 'reject_oldest': {
        const oldest = this.queue.shift()
        oldest?.reject(new Error('Queue full — shedding oldest'))
        break
      }
      case 'reject_lowest_priority': {
        this.queue.sort((a, b) => a.priority - b.priority)
        const lowest = this.queue.shift()
        lowest?.reject(new Error('Queue full — shedding lowest priority'))
        break
      }
    }
  }

  getStats(): { inFlight: number; queued: number; perProvider: Record<string, number> } {
    const perProvider: Record<string, number> = {}
    for (const [k, v] of this.perProviderInFlight) perProvider[k] = v
    return { inFlight: this.inFlight, queued: this.queue.length, perProvider }
  }
}
