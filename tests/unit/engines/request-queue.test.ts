// tests/unit/engines/request-queue.test.ts
// Unit 8.3 — Request queueing + backpressure.

import { describe, expect, it } from 'bun:test'
import { RequestQueue } from '../../../src/engines/request-queue.js'

describe('RequestQueue (Unit 8.3)', () => {
  it('runs enqueued work immediately when under the concurrency limit', async () => {
    const q = new RequestQueue<number>({
      maxConcurrent: 2,
      maxQueued: 10,
      perProviderMaxConcurrent: 2,
    })
    const r = await q.enqueue(async () => 42)
    expect(r).toBe(42)
    expect(q.getStats().inFlight).toBe(0)
  })

  it('limits concurrency and drains the queue', async () => {
    const q = new RequestQueue<number>({
      maxConcurrent: 1,
      maxQueued: 10,
      perProviderMaxConcurrent: 1,
    })
    let active = 0
    let maxActive = 0
    const mk = () =>
      q.enqueue(async () => {
        active++
        maxActive = Math.max(maxActive, active)
        await new Promise((r) => setTimeout(r, 20))
        active--
        return active
      })
    await Promise.all([mk(), mk(), mk()])
    expect(maxActive).toBe(1)
  })

  it('respects priority when draining a queued backlog', async () => {
    const order: number[] = []
    const q = new RequestQueue<number>({
      maxConcurrent: 1,
      maxQueued: 10,
      perProviderMaxConcurrent: 1,
    })
    const slow = q.enqueue(async () => {
      await new Promise((r) => setTimeout(r, 30))
      order.push(0)
      return 0
    })
    const low = q.enqueue(async () => {
      order.push(1)
      return 1
    }, { priority: 1 })
    const high = q.enqueue(async () => {
      order.push(10)
      return 10
    }, { priority: 10 })
    await Promise.all([slow, low, high])
    expect(order[0]).toBe(0) // first enqueue grabs the only slot
    expect(order[1]).toBe(10) // higher priority drains first
    expect(order[2]).toBe(1)
  })

  it('rejects when per-provider concurrency is exceeded', async () => {
    const q = new RequestQueue<number>({
      maxConcurrent: 10,
      maxQueued: 50,
      perProviderMaxConcurrent: 1,
    })
    const first = q.enqueue(async () => {
      await new Promise((r) => setTimeout(r, 20))
      return 1
    }, { providerId: 'p1' })
    const second = q.enqueue(async () => 2, { providerId: 'p1' })
    await expect(second).rejects.toThrow(/at capacity/)
    await first
  })

  it('sheds the newest queued request when the queue is full', async () => {
    const q = new RequestQueue<number>({
      maxConcurrent: 1,
      maxQueued: 1,
      perProviderMaxConcurrent: 1,
      shedStrategy: 'reject_newest',
      queueTimeoutMs: 1000,
    })
    const slow = q.enqueue(async () => {
      await new Promise((r) => setTimeout(r, 50))
      return 0
    })
    const queued = q.enqueue(async () => 1)
    const newest = q.enqueue(async () => 2)
    await expect(queued).rejects.toThrow(/shedding/)
    expect(await newest).toBe(2)
    await slow
  })

  it('times out a queued request', async () => {
    const q = new RequestQueue<number>({
      maxConcurrent: 1,
      maxQueued: 5,
      perProviderMaxConcurrent: 5,
      queueTimeoutMs: 1000,
    })
    const slow = q.enqueue(async () => {
      await new Promise((r) => setTimeout(r, 60))
      return 0
    })
    const timed = q.enqueue(async () => 1, { timeoutMs: 20 })
    await expect(timed).rejects.toThrow(/Queue timeout/)
    await slow
  })
})
