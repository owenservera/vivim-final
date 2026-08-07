// src/engines/memory/background-sync.ts
// BackgroundSyncQueue - single-worker FIFO promise chain for memory writes/prefetches.
// Non-blocking submit; bounded drain on shutdown (decision D6).
//
// Hermes port: MemoryManager background sync (memory_manager.py). Here it is
// per-MemoryFabric-instance and shared across all agent subsystems.

import { MemoryError } from '../../errors.js'
import { catchDebug } from '../../lib/catch-logger.js'

export const _SYNC_DRAIN_TIMEOUT_MS = 5000
export const _EXTERNAL_PREFETCH_TIMEOUT_MS = 8000

type SyncKind = 'write' | 'prefetch' | 'prune'

interface QueuedTask {
  kind: SyncKind
  fn: () => Promise<unknown>
  resolve: (v: unknown) => void
  reject: (e: unknown) => void
}

export class BackgroundSyncQueue {
  private chain: Promise<unknown> = Promise.resolve()
  private tasks: QueuedTask[] = []
  private draining = false

  /** Submit a task; resolves when its FIFO predecessor completes. Never throws. */
  submit<T>(fn: () => Promise<T>, kind: SyncKind = 'write'): Promise<T> {
    let resolve!: (v: T) => void
    let reject!: (e: unknown) => void
    const promise = new Promise<T>((res, rej) => {
      resolve = res
      reject = rej
    })
    const task: QueuedTask = {
      kind,
      fn,
      resolve: resolve as (v: unknown) => void,
      reject,
    }
    this.tasks.push(task)
    // Chain preserves FIFO ordering across all task types.
    this.chain = this.chain.then(async () => {
      const idx = this.tasks.indexOf(task)
      if (idx === -1) return
      this.tasks.splice(idx, 1)
      try {
        const result = await task.fn()
        task.resolve(result)
      } catch (err) {
        task.reject(err)
      }
    })
    return promise
  }

  /** Barrier: resolves once all queued tasks before this call have settled. */
  async flush(timeout: number = _SYNC_DRAIN_TIMEOUT_MS): Promise<void> {
    const sentinel = this.chain.then(() => undefined)
    const race = Promise.race([
      sentinel,
      new Promise<void>((_, rej) =>
        setTimeout(() => rej(new MemoryError('flush timeout')), timeout),
      ),
    ])
    try {
      await race
    } catch (err) {
      catchDebug(err, 'engines:memory:background-sync:68')
      // bounded: leave in-flight, report via drain
    }
  }

  /** Bounded shutdown: cancel pending (unstarted) tasks, report abandoned. */
  async drain(timeoutMs: number = _SYNC_DRAIN_TIMEOUT_MS): Promise<{
    abandoned_writes: number
    abandoned_prefetches: number
  }> {
    if (this.draining) {
      return { abandoned_writes: 0, abandoned_prefetches: 0 }
    }
    this.draining = true
    const pending = [...this.tasks]
    this.tasks = []
    let abandoned_writes = 0
    let abandoned_prefetches = 0
    for (const t of pending) {
      if (t.kind === 'write') abandoned_writes++
      else abandoned_prefetches++
      t.reject(new MemoryError(`drain: task ${t.kind} abandoned`))
    }
    const limit = new Promise<void>((resolve) => setTimeout(resolve, timeoutMs))
    await Promise.race([this.chain.then(() => undefined), limit])
    this.draining = false
    return { abandoned_writes, abandoned_prefetches }
  }
}
