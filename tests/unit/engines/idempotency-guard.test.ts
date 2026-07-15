// tests/unit/engines/idempotency-guard.test.ts
// Unit 7.4 — Double-send protection (default return_cached policy).

import { describe, expect, it } from 'bun:test'
import { IdempotencyGuard } from '../../../src/engines/idempotency-guard.js'

describe('IdempotencyGuard (Unit 7.4)', () => {
  it('computes a stable key for the same input', async () => {
    const g = new IdempotencyGuard()
    const a = await g.check('c1', 'hello')
    const b = await g.check('c1', 'hello')
    expect(a.key).toBe(b.key)
    expect(a.key).toContain('c1:')
    expect(a.duplicate).toBe(false)
  })

  it('returns the cached result on a duplicate within the window', async () => {
    const g = new IdempotencyGuard()
    const first = await g.check('c1', 'dup')
    expect(first.duplicate).toBe(false)
    const fakeResult = { messageId: 'm1', text: 'ok' } as never
    g.record(first.key, fakeResult)
    const second = await g.check('c1', 'dup')
    expect(second.duplicate).toBe(true)
    expect(second.cachedResult).toBe(fakeResult)
  })

  it('treats different messages as distinct keys', async () => {
    const g = new IdempotencyGuard()
    const a = await g.check('c1', 'one')
    const b = await g.check('c1', 'two')
    expect(a.key).not.toBe(b.key)
  })
})
