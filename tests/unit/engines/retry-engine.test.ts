// tests/unit/engines/retry-engine.test.ts
// Unit 7.7 — Configurable retry policy engine.

import { describe, expect, it } from 'bun:test'
import { RetryEngine } from '../../../src/engines/retry-engine.js'

describe('RetryEngine (Unit 7.7)', () => {
  it('returns the result on success', async () => {
    const re = new RetryEngine()
    const r = await re.execute('op', async () => 7)
    expect(r).toBe(7)
  })

  it('retries a retryable error and then succeeds', async () => {
    const re = new RetryEngine()
    re.setPolicy('op', {
      maxAttempts: 3,
      initialDelayMs: 1,
      backoffStrategy: 'fixed',
      retryableErrors: ['boom'],
    })
    let calls = 0
    const r = await re.execute('op', async () => {
      calls++
      if (calls < 2) throw new Error('boom')
      return 'ok'
    })
    expect(r).toBe('ok')
    expect(calls).toBe(2)
  })

  it('throws immediately on a non-retryable error', async () => {
    const re = new RetryEngine()
    re.setPolicy('op', {
      maxAttempts: 5,
      initialDelayMs: 1,
      nonRetryableErrors: ['fatal'],
    })
    let calls = 0
    await expect(
      re.execute('op', async () => {
        calls++
        throw new Error('fatal issue')
      }),
    ).rejects.toThrow(/fatal/)
    expect(calls).toBe(1)
  })

  it('exhausts attempts then throws after retries', async () => {
    const re = new RetryEngine()
    re.setPolicy('op', {
      maxAttempts: 2,
      initialDelayMs: 1,
      backoffStrategy: 'fixed',
      retryableErrors: ['x'],
    })
    let calls = 0
    await expect(
      re.execute('op', async () => {
        calls++
        throw new Error('x failed')
      }),
    ).rejects.toThrow()
    expect(calls).toBe(2)
  })

  it('waits between retries per the policy delay', async () => {
    const re = new RetryEngine()
    re.setPolicy('op', {
      maxAttempts: 2,
      initialDelayMs: 50,
      backoffStrategy: 'fixed',
      retryableErrors: ['y'],
    })
    const start = Date.now()
    await expect(
      re.execute('op', async () => {
        throw new Error('y')
      }),
    ).rejects.toThrow()
    expect(Date.now() - start).toBeGreaterThanOrEqual(40)
  })
})
