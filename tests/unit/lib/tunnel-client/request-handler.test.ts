// tests/unit/lib/tunnel-client/request-handler.test.ts
// RequestHandler — HTTP request forwarding

import { describe, expect, it, mock } from 'bun:test'

const { RequestHandler } = await import('../../../../src/lib/tunnel-client/request-handler.js')

describe('RequestHandler', () => {
  it('creates with sendFn and metrics', () => {
    const sendFn = mock(() => {})
    const metrics = {
      totalRequests: 0, totalResponses: 0, totalBytesIn: 0,
      totalBytesOut: 0, averageLatencyMs: 0, reconnectCount: 0,
      uptimeSeconds: 0, lastPingLatencyMs: null,
    }
    const rh = new RequestHandler(sendFn, metrics)
    expect(rh).toBeDefined()
  })

  it('handleRequest rejects when concurrency limit reached', async () => {
    const sendFn = mock(() => {})
    const metrics = {
      totalRequests: 0, totalResponses: 0, totalBytesIn: 0,
      totalBytesOut: 0, averageLatencyMs: 0, reconnectCount: 0,
      uptimeSeconds: 0, lastPingLatencyMs: null,
    }
    const rh = new RequestHandler(sendFn, metrics, { maxConcurrentRequests: 0 })
    const frame = {
      id: 'req-1', type: 'http.request' as const, method: 'GET',
      path: '/test', headers: {}, body: null, timestamp: Date.now(), version: '1.0',
    }
    await rh.handleRequest(frame)
    // Should send abort frame
    expect(sendFn).toHaveBeenCalled()
  })
})
