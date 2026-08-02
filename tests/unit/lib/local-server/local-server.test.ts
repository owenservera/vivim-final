// tests/unit/lib/local-server/local-server.test.ts
// LocalServer — structural tests (Bun.serve mocked)

import { describe, expect, it } from 'bun:test'

const { LocalServer } = await import('../../../../src/lib/local-server/index.js')

function makeConfig(enabled = true) {
  return {
    tunnel: {
      enabled: false,
      serverUrl: '',
      subdomain: '',
      protocolVersion: '1.0',
      heartbeatIntervalMs: 30_000,
      heartbeatTimeoutMs: 10_000,
      reconnectInitialDelayMs: 1_000,
      reconnectMaxDelayMs: 60_000,
      reconnectJitterFactor: 0.25,
      maxConcurrentRequests: 50,
      requestTimeoutMs: 30_000,
      authToken: null,
    },
    p2p: {
      enabled: false,
      bootstrapNodes: [],
      mdnsEnabled: false,
      mdnsInterval: 0,
      dhtEnabled: false,
      relayEnabled: false,
      maxPeers: 10,
      maxConcurrentTransfers: 3,
      maxFileSize: 104857600,
      identityPath: '',
    },
    localServer: {
      enabled,
      host: '127.0.0.1',
      port: 18080,
      corsEnabled: false,
      corsOrigins: [],
      rateLimitPerMinute: 60,
      maxRequestBodyBytes: 1048576,
      staticDir: '',
    },
    orchestrator: {
      healthCheckIntervalMs: 5_000,
      restartDelayMs: 1_000,
      maxRestartAttempts: 3,
      statusReportIntervalMs: 60_000,
    },
    logging: { level: 'info' as const, pretty: false, logDir: null },
    ledger: {
      enabled: false,
      baseUrl: '',
      syncIntervalMs: 300_000,
      publicKeyHex: '',
      userToken: null,
      subdomain: null,
      userId: null,
      email: null,
    },
  }
}

describe('LocalServer', () => {
  it('creates instance', () => {
    const ls = new LocalServer(makeConfig() as any)
    expect(ls).toBeDefined()
  })

  it('getRequestCount starts at 0', () => {
    const ls = new LocalServer(makeConfig() as any)
    expect(ls.getRequestCount()).toBe(0)
  })

  it('isRunning starts false', () => {
    const ls = new LocalServer(makeConfig() as any)
    expect(ls.isRunning()).toBe(false)
  })

  it('getPort returns configured port', () => {
    const ls = new LocalServer(makeConfig() as any)
    expect(ls.getPort()).toBe(18080)
  })

  it('start skips when disabled', async () => {
    const ls = new LocalServer(makeConfig(false) as any)
    await ls.start()
    expect(ls.isRunning()).toBe(false)
  })
})
