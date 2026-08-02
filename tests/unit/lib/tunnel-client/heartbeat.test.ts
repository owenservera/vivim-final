// tests/unit/lib/tunnel-client/heartbeat.test.ts
// Heartbeat — ping/pong lifecycle

import { describe, expect, it, mock } from 'bun:test'

const { Heartbeat } = await import('../../../../src/lib/tunnel-client/heartbeat.js')

function makeHeartbeat(overrides?: Partial<{ intervalMs: number; timeoutMs: number }>) {
  const metrics = { lastPingLatencyMs: null } as any
  const sendFn = mock(() => {})
  const onTimeout = mock(() => {})
  return new Heartbeat(sendFn, onTimeout, metrics, overrides)
}

describe('Heartbeat', () => {
  it('creates with required params', () => {
    const hb = makeHeartbeat()
    expect(hb).toBeDefined()
  })

  it('start and stop without error', () => {
    const hb = makeHeartbeat({ intervalMs: 60_000 })
    hb.start()
    hb.stop()
  })

  it('onPong clears pending ping', () => {
    const hb = makeHeartbeat({ intervalMs: 60_000 })
    hb.start()
    hb.onPong()
    expect(hb.getLastPongTime()).toBeGreaterThan(0)
    hb.stop()
  })

  it('getLastPongTime returns 0 initially', () => {
    const hb = makeHeartbeat()
    expect(hb.getLastPongTime()).toBe(0)
  })
})
