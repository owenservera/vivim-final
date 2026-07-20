// tests/unit/executor/async-mutex.test.ts
import { describe, expect, it } from 'bun:test'
import { AsyncMutex } from '../../../src/executor/async-mutex.js'

describe('AsyncMutex', () => {
  it('is unlocked initially', () => {
    const m = new AsyncMutex()
    expect(m.isLocked()).toBe(false)
  })

  it('first acquire resolves immediately and locks', async () => {
    const m = new AsyncMutex()
    await m.acquire()
    expect(m.isLocked()).toBe(true)
  })

  it('serializes concurrent acquirers in FIFO order', async () => {
    const m = new AsyncMutex()
    const order: number[] = []
    const releaseOrder: number[] = []

    const mk = async (id: number) => {
      await m.acquire()
      order.push(id)
      releaseOrder.push(id)
      m.release()
    }

    const p1 = mk(1)
    const p2 = mk(2)
    const p3 = mk(3)
    // none should have entered the critical section yet (still locked by p1)
    expect(order).toEqual([])

    m.release() // release p1
    await Promise.all([p1, p2, p3])

    expect(order).toEqual([1, 2, 3])
    expect(releaseOrder).toEqual([1, 2, 3])
    expect(m.isLocked()).toBe(false)
  })

  it('unlocks when queue drains', async () => {
    const m = new AsyncMutex()
    await m.acquire()
    const p = m.acquire()
    expect(m.isLocked()).toBe(true)
    m.release()
    await p
    m.release()
    expect(m.isLocked()).toBe(false)
  })
})
