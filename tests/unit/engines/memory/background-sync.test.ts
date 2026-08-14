// tests/unit/engines/memory/background-sync.test.ts
// Unit tests for BackgroundSyncQueue — single-worker FIFO, non-blocking submit,
// bounded drain (decision D6 / FR-008).

import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import {
  _SYNC_DRAIN_TIMEOUT_MS,
  BackgroundSyncQueue,
} from '../../../../src/engines/memory/background-sync.js'

describe('BackgroundSyncQueue', () => {
  let q: BackgroundSyncQueue
  beforeEach(() => {
    q = new BackgroundSyncQueue()
  })
  afterEach(async () => {
    await q.drain(10).catch(() => undefined)
  })

  it('runs tasks in FIFO order', async () => {
    const order: number[] = []
    const a = q.submit(async () => {
      await Bun.sleep(5)
      order.push(1)
    })
    const b = q.submit(async () => {
      order.push(2)
    })
    await Promise.all([a, b])
    expect(order).toEqual([1, 2])
  })

  it('resolves the submitted promise with the task result', async () => {
    const r = await q.submit(async () => 42)
    expect(r).toBe(42)
  })

  it('does not throw on a failing task (rejects the promise)', async () => {
    const p = q.submit(async () => {
      throw new Error('boom')
    })
    await expect(p).rejects.toThrow('boom')
  })

  it('drain abandons pending unstarted tasks and reports counts', async () => {
    // Block the single worker; submit a second task that is still queued when
    // drain runs synchronously (before any microtask executor fires).
    const blocking = q.submit(async () => {
      await Bun.sleep(50)
    })
    const pending = q.submit(async () => 2)
    const res = await q.drain(10)
    expect(res.abandoned_writes).toBe(2)
    await expect(pending).rejects.toThrow()
    await blocking.catch(() => undefined)
  })

  it('flush resolves within the bounded timeout', async () => {
    const t0 = Date.now()
    await q.flush(_SYNC_DRAIN_TIMEOUT_MS)
    expect(Date.now() - t0).toBeLessThan(_SYNC_DRAIN_TIMEOUT_MS + 50)
  })
})
