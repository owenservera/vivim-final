// tests/unit/lib/tunnel-client/connection-manager.test.ts
// ConnectionManager — auth headers on WebSocket connect

import { beforeEach, describe, expect, it } from 'bun:test'

// Mock WebSocket before importing connection-manager
let lastConnectOptions: { headers?: Record<string, string> } = {}
class MockWebSocket {
  static OPEN = 1
  static CLOSED = 3
  readyState = 1
  url: string
  options: { headers?: Record<string, string> }
  listeners: Record<string, ((...args: unknown[]) => void)[]> = {}

  constructor(url: string, options?: { headers?: Record<string, string> }) {
    this.url = url
    this.options = options ?? {}
    lastConnectOptions = this.options
    // Simulate immediate open
    setTimeout(() => this.emit('open'), 0)
  }

  addEventListener(event: string, fn: (...args: unknown[]) => void) {
    if (!this.listeners[event]) this.listeners[event] = []
    this.listeners[event].push(fn)
  }

  send(_data: string) {}
  close(_code?: number, _reason?: string) {}

  emit(event: string, ...args: unknown[]) {
    for (const fn of this.listeners[event] ?? []) fn(...args)
  }
}
;(globalThis as any).WebSocket = MockWebSocket

// Now import after mock
const { ConnectionManager } = await import(
  '../../../../src/lib/tunnel-client/connection-manager.js'
)

describe('ConnectionManager', () => {
  beforeEach(() => {
    lastConnectOptions = {}
  })

  it('sends Authorization header when authToken is set', async () => {
    const cm = new ConnectionManager({
      tunnel: {
        enabled: true,
        serverUrl: 'wss://tunnel.test/connect',
        subdomain: 'user-test',
        protocolVersion: '1.0',
        heartbeatIntervalMs: 30_000,
        heartbeatTimeoutMs: 10_000,
        reconnectInitialDelayMs: 1_000,
        reconnectMaxDelayMs: 60_000,
        reconnectJitterFactor: 0.25,
        maxConcurrentRequests: 50,
        requestTimeoutMs: 30_000,
        authToken: 'my-jwt-token',
      },
      p2p: {} as any,
      localServer: {} as any,
      orchestrator: {} as any,
      logging: {} as any,
      ledger: {} as any,
    } as any)

    await cm.connect()

    expect(lastConnectOptions.headers).toBeDefined()
    expect(lastConnectOptions.headers?.Authorization).toBe('Bearer my-jwt-token')
  })

  it('sends X-Subdomain header when subdomain is set', async () => {
    const cm = new ConnectionManager({
      tunnel: {
        enabled: true,
        serverUrl: 'wss://tunnel.test/connect',
        subdomain: 'user-test',
        protocolVersion: '1.0',
        heartbeatIntervalMs: 30_000,
        heartbeatTimeoutMs: 10_000,
        reconnectInitialDelayMs: 1_000,
        reconnectMaxDelayMs: 60_000,
        reconnectJitterFactor: 0.25,
        maxConcurrentRequests: 50,
        requestTimeoutMs: 30_000,
        authToken: 'token',
      },
      p2p: {} as any,
      localServer: {} as any,
      orchestrator: {} as any,
      logging: {} as any,
      ledger: {} as any,
    } as any)

    await cm.connect()

    expect(lastConnectOptions.headers?.['X-Subdomain']).toBe('user-test')
  })

  it('omits Authorization when authToken is null', async () => {
    const cm = new ConnectionManager({
      tunnel: {
        enabled: true,
        serverUrl: 'wss://tunnel.test/connect',
        subdomain: 'test',
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
      p2p: {} as any,
      localServer: {} as any,
      orchestrator: {} as any,
      logging: {} as any,
      ledger: {} as any,
    } as any)

    await cm.connect()

    expect(lastConnectOptions.headers?.Authorization).toBeUndefined()
  })

  it('omits X-Subdomain when subdomain is empty', async () => {
    const cm = new ConnectionManager({
      tunnel: {
        enabled: true,
        serverUrl: 'wss://tunnel.test/connect',
        subdomain: '',
        protocolVersion: '1.0',
        heartbeatIntervalMs: 30_000,
        heartbeatTimeoutMs: 10_000,
        reconnectInitialDelayMs: 1_000,
        reconnectMaxDelayMs: 60_000,
        reconnectJitterFactor: 0.25,
        maxConcurrentRequests: 50,
        requestTimeoutMs: 30_000,
        authToken: 'token',
      },
      p2p: {} as any,
      localServer: {} as any,
      orchestrator: {} as any,
      logging: {} as any,
      ledger: {} as any,
    } as any)

    await cm.connect()

    expect(lastConnectOptions.headers?.['X-Subdomain']).toBeUndefined()
  })
})
