// tests/unit/lib/orchestrator/service-manager.test.ts
// ServiceManager — orchestrator lifecycle (structural tests)

import { describe, expect, it, mock, beforeEach } from 'bun:test'

// Mock dependencies before importing ServiceManager
mock.module('../../../../src/lib/tunnel-client/index.js', () => ({
  TunnelClient: class {
    start = mock(async () => {})
    stop = mock(async () => {})
    isConnected = mock(() => false)
    getSubdomain = mock(() => null)
    getMetrics = mock(() => ({ reconnectCount: 0 }))
  },
}))

mock.module('../../../../src/lib/p2p-node/index.js', () => ({
  P2PNode: class {
    start = mock(async () => {})
    stop = mock(async () => {})
    isRunning = mock(() => false)
    getMetrics = mock(() => ({ peerCount: 0, relayedConnections: 0 }))
  },
}))

mock.module('../../../../src/lib/local-server/index.js', () => ({
  LocalServer: class {
    start = mock(async () => {})
    stop = mock(async () => {})
    isRunning = mock(() => false)
    getPort = mock(() => 8080)
    getRequestCount = mock(() => 0)
  },
}))

mock.module('../../../../src/lib/orchestrator/health-monitor.js', () => ({
  HealthMonitor: class {
    registerService = mock(() => {})
    start = mock(() => {})
    stop = mock(() => {})
    updateServiceStatus = mock(() => {})
    on = mock(() => {})
    getStatus = mock(() => ({}))
  },
}))

const { ServiceManager } = await import('../../../../src/lib/orchestrator/service-manager.js')

function makeConfig(ledgerEnabled = false) {
  return {
    tunnel: {
      enabled: true,
      serverUrl: 'wss://test',
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
    p2p: { enabled: true, bootstrapNodes: [], mdnsEnabled: false, mdnsInterval: 0, dhtEnabled: false, relayEnabled: false, maxPeers: 10, maxConcurrentTransfers: 3, maxFileSize: 104857600, identityPath: '' },
    localServer: { enabled: true, host: '127.0.0.1', port: 8080, corsEnabled: false, corsOrigins: [], rateLimitPerMinute: 60, maxRequestBodyBytes: 1048576, staticDir: '' },
    orchestrator: { healthCheckIntervalMs: 30_000, restartDelayMs: 1_000, maxRestartAttempts: 3, statusReportIntervalMs: 60_000 },
    logging: { level: 'info' as const, pretty: false, logDir: null },
    ledger: {
      enabled: ledgerEnabled,
      baseUrl: 'https://ledger.test',
      syncIntervalMs: 300_000,
      publicKeyHex: '00'.repeat(32),
      userToken: ledgerEnabled ? 'existing-token' : null,
      subdomain: null,
      userId: null,
      email: null,
    },
  }
}

describe('ServiceManager', () => {
  it('creates instance with valid config', () => {
    const sm = new ServiceManager(makeConfig(false) as any)
    expect(sm).toBeDefined()
  })

  it('has start and stop methods', () => {
    const sm = new ServiceManager(makeConfig(false) as any)
    expect(typeof sm.start).toBe('function')
    expect(typeof sm.stop).toBe('function')
  })

  it('has getStatus method', () => {
    const sm = new ServiceManager(makeConfig(false) as any)
    expect(typeof sm.getStatus).toBe('function')
  })

  it('getStatus returns structured object', async () => {
    const sm = new ServiceManager(makeConfig(false) as any)
    await sm.start()
    const status = sm.getStatus()

    expect(status).toHaveProperty('uptime')
    expect(typeof status.uptime).toBe('number')
  })
})
