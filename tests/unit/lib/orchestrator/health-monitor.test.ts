// tests/unit/lib/orchestrator/health-monitor.test.ts
// HealthMonitor — service registration, status, lifecycle

import { describe, expect, it, mock } from 'bun:test'

const { HealthMonitor } = await import('../../../../src/lib/orchestrator/health-monitor.js')

function makeConfig() {
  return {
    tunnel: { enabled: true, serverUrl: '', subdomain: '', protocolVersion: '1.0', heartbeatIntervalMs: 30_000, heartbeatTimeoutMs: 10_000, reconnectInitialDelayMs: 1_000, reconnectMaxDelayMs: 60_000, reconnectJitterFactor: 0.25, maxConcurrentRequests: 50, requestTimeoutMs: 30_000, authToken: null },
    p2p: { enabled: true, bootstrapNodes: [], mdnsEnabled: false, mdnsInterval: 0, dhtEnabled: false, relayEnabled: false, maxPeers: 10, maxConcurrentTransfers: 3, maxFileSize: 104857600, identityPath: '' },
    localServer: { enabled: true, host: '127.0.0.1', port: 8080, corsEnabled: false, corsOrigins: [], rateLimitPerMinute: 60, maxRequestBodyBytes: 1048576, staticDir: '' },
    orchestrator: { healthCheckIntervalMs: 5_000, restartDelayMs: 1_000, maxRestartAttempts: 3, statusReportIntervalMs: 60_000 },
    logging: { level: 'info' as const, pretty: false, logDir: null },
    ledger: { enabled: false, baseUrl: '', syncIntervalMs: 300_000, publicKeyHex: '', userToken: null, subdomain: null, userId: null, email: null },
  }
}

describe('HealthMonitor', () => {
  it('creates instance', () => {
    const hm = new HealthMonitor(makeConfig() as any)
    expect(hm).toBeDefined()
  })

  it('registerService adds a service', () => {
    const hm = new HealthMonitor(makeConfig() as any)
    hm.registerService('tunnel')
    const status = hm.getStatus()
    expect(status.services).toHaveProperty('tunnel')
  })

  it('registerService multiple services', () => {
    const hm = new HealthMonitor(makeConfig() as any)
    hm.registerService('tunnel')
    hm.registerService('p2p')
    hm.registerService('localServer')
    const status = hm.getStatus()
    expect(Object.keys(status.services)).toHaveLength(3)
  })

  it('updateServiceStatus changes status', () => {
    const hm = new HealthMonitor(makeConfig() as any)
    hm.registerService('tunnel')
    hm.updateServiceStatus('tunnel', 'running')
    const status = hm.getStatus()
    expect(status.services.tunnel.status).toBe('running')
  })

  it('updateServiceStatus with error', () => {
    const hm = new HealthMonitor(makeConfig() as any)
    hm.registerService('tunnel')
    hm.updateServiceStatus('tunnel', 'error', 'connection lost')
    const status = hm.getStatus()
    expect(status.services.tunnel.status).toBe('error')
    expect(status.services.tunnel.lastError).toBe('connection lost')
  })

  it('start and stop without error', () => {
    const hm = new HealthMonitor(makeConfig() as any)
    hm.registerService('tunnel')
    hm.start()
    hm.stop()
  })

  it('on registers event listeners', () => {
    const hm = new HealthMonitor(makeConfig() as any)
    const handler = mock(() => {})
    hm.on('crash', handler)
    expect(handler).toBeDefined()
  })

  it('getStatus returns OrchestratorStatus structure', () => {
    const hm = new HealthMonitor(makeConfig() as any)
    const status = hm.getStatus()
    expect(status).toHaveProperty('services')
    expect(status).toHaveProperty('uptime')
    expect(status).toHaveProperty('tunnel')
    expect(status).toHaveProperty('p2p')
    expect(status).toHaveProperty('localServer')
  })
})
