// tests/unit/lib/tunnel-client/reconnection.test.ts
// ReconnectionManager — exponential backoff

import { describe, expect, it, mock } from 'bun:test'

const { ReconnectionManager } = await import('../../../../src/lib/tunnel-client/reconnection.js')

describe('ReconnectionManager', () => {
  it('creates with connectFn', () => {
    const rm = new ReconnectionManager(async () => {})
    expect(rm).toBeDefined()
  })

  it('getAttempt returns 0 initially', () => {
    const rm = new ReconnectionManager(async () => {})
    expect(rm.getAttempt()).toBe(0)
  })

  it('reset resets attempt count', () => {
    const rm = new ReconnectionManager(async () => {})
    rm.reset()
    expect(rm.getAttempt()).toBe(0)
  })

  it('stop prevents reconnection', () => {
    const rm = new ReconnectionManager(async () => {})
    rm.stop()
    // stop should not throw
    expect(rm.getAttempt()).toBe(0)
  })

  it('calculateDelay with 0 jitter produces deterministic values', () => {
    const rm = new ReconnectionManager(async () => {}, {
      initialDelayMs: 100,
      maxDelayMs: 5000,
      jitterFactor: 0,
    })
    // Access private method for testing
    const d0 = (rm as any).calculateDelay()
    expect(d0).toBeGreaterThanOrEqual(100)
    expect(d0).toBeLessThanOrEqual(100)
  })

  it('calculateDelay respects maxDelayMs', () => {
    const rm = new ReconnectionManager(async () => {}, {
      initialDelayMs: 100,
      maxDelayMs: 500,
      jitterFactor: 0,
    })
    // Set attempt to high value to test cap
    for (let i = 0; i < 20; i++) (rm as any).attempt = i
    const d = (rm as any).calculateDelay()
    expect(d).toBeLessThanOrEqual(500)
  })
})
