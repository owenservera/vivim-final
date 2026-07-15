// tests/unit/engines/lock-manager.test.ts
// Unit 7.3 — Conversation locking (mutex strategy, default policy).

import { describe, expect, it } from 'bun:test'
import { LockManager } from '../../../src/engines/lock-manager.js'

describe('LockManager (Unit 7.3)', () => {
  it('acquires and reports lock state', async () => {
    const lm = new LockManager()
    await lm.acquire('conv:1', 'ownerA')
    expect(lm.isLocked('conv:1')).toBe(true)
    expect(lm.getLockOwner('conv:1')).toBe('ownerA')
    lm.release('conv:1', 'ownerA')
    expect(lm.isLocked('conv:1')).toBe(false)
    expect(lm.getLockOwner('conv:1')).toBe(null)
  })

  it('release is a no-op for a non-owner', async () => {
    const lm = new LockManager()
    await lm.acquire('conv:2', 'ownerA')
    lm.release('conv:2', 'ownerB') // wrong owner — lock must persist
    expect(lm.isLocked('conv:2')).toBe(true)
    lm.release('conv:2', 'ownerA')
    expect(lm.isLocked('conv:2')).toBe(false)
  })

  it('serializes concurrent acquirers (mutex)', async () => {
    const lm = new LockManager()
    await lm.acquire('conv:3', 'first')
    let secondResolved = false
    const pending = lm
      .acquire('conv:3', 'second')
      .then(() => {
        secondResolved = true
      })
    await new Promise((r) => setTimeout(r, 80))
    expect(secondResolved).toBe(false)
    lm.release('conv:3', 'first')
    await pending
    expect(secondResolved).toBe(true)
    expect(lm.getLockOwner('conv:3')).toBe('second')
    lm.release('conv:3', 'second')
  })
})
