// tests/unit/lib/orchestrator/config.test.ts
// Config — defaults, env overrides, validation

import { describe, expect, it } from 'bun:test'

const { loadConfig } = await import('../../../../src/lib/orchestrator/config.js')

describe('loadConfig', () => {
  it('returns default config when no file exists', () => {
    const config = loadConfig()
    expect(config).toBeDefined()
    expect(config.tunnel).toBeDefined()
    expect(config.p2p).toBeDefined()
    expect(config.localServer).toBeDefined()
    expect(config.orchestrator).toBeDefined()
    expect(config.logging).toBeDefined()
    expect(config.ledger).toBeDefined()
  })

  it('tunnel defaults match TUNNEL_DEFAULTS', () => {
    const config = loadConfig()
    expect(config.tunnel.serverUrl).toBe('wss://tunnel.vivim.live/connect')
    expect(config.tunnel.heartbeatIntervalMs).toBe(30_000)
    expect(config.tunnel.heartbeatTimeoutMs).toBe(10_000)
    expect(config.tunnel.maxConcurrentRequests).toBe(50)
  })

  it('p2p defaults match P2P_DEFAULTS', () => {
    const config = loadConfig()
    expect(config.p2p.maxPeers).toBe(50)
    expect(config.p2p.maxConcurrentTransfers).toBe(5)
    expect(config.p2p.maxFileSize).toBe(500 * 1024 * 1024)
  })

  it('localServer defaults match LOCAL_SERVER_DEFAULTS', () => {
    const config = loadConfig()
    expect(config.localServer.host).toBe('127.0.0.1')
    expect(config.localServer.port).toBe(8080)
  })

  it('orchestrator defaults match ORCHESTRATOR_DEFAULTS', () => {
    const config = loadConfig()
    expect(config.orchestrator.healthCheckIntervalMs).toBe(5_000)
    expect(config.orchestrator.restartDelayMs).toBe(2_000)
    expect(config.orchestrator.maxRestartAttempts).toBe(5)
  })

  it('ledger section exists with defaults', () => {
    const config = loadConfig()
    expect(config.ledger).toBeDefined()
    expect(typeof config.ledger.enabled).toBe('boolean')
    expect(config.ledger.syncIntervalMs).toBe(300_000)
  })
})
