// tests/unit/lib/p2p-node/node-manager.test.ts
// NodeManager — lifecycle, state transitions, metrics

import { beforeEach, describe, expect, it, mock } from 'bun:test'

// Mock libp2p — must be before import
const mockNode = {
  peerId: { toString: () => 'test-peer-id-123' },
  getPeers: mock(() => []),
  getConnectionsWithPeer: mock(() => []),
  getConnections: mock(() => []),
  start: mock(() => Promise.resolve()),
  stop: mock(() => Promise.resolve()),
  addEventListener: mock(() => {}),
  peerStore: { getPeers: mock(() => Promise.resolve([])) },
  peerRouting: {},
  contentRouting: {},
  logger: { forComponent: mock(() => ({ warn: mock(() => {}), error: mock(() => {}), info: mock(() => {}), debug: mock(() => {}) })) },
  dial: mock(() => Promise.resolve(null)),
  hangUp: mock(() => Promise.resolve()),
  getProtocols: mock(() => []),
  getMultiaddrs: mock(() => []),
  getAddresses: mock(() => []),
  status: 'started',
  services: {},
} as any

mock.module('libp2p', () => ({
  createLibp2p: mock(() => Promise.resolve(mockNode)),
}))

import { NodeManager } from '../../../../src/lib/p2p-node/node-manager.js'
import type { VivimConfig } from '../../../../src/lib/tunnel-shared/types.js'

const DEFAULT_CONFIG: VivimConfig = {
  p2p: {
    enabled: true,
    bootstrapNodes: [],
    mdnsEnabled: false,
    mdnsInterval: 60_000,
    dhtEnabled: false,
    relayEnabled: true,
    maxPeers: 10,
    maxConcurrentTransfers: 5,
    maxFileSize: 1_048_576,
    identityPath: '',
  },
  tunnel: {
    enabled: true,
    serverUrl: 'wss://test.example.com',
    subdomain: 'test',
    protocolVersion: '1.0',
    heartbeatIntervalMs: 30_000,
    heartbeatTimeoutMs: 10_000,
    reconnectInitialDelayMs: 1000,
    reconnectMaxDelayMs: 30_000,
    reconnectJitterFactor: 0.1,
    maxConcurrentRequests: 100,
    requestTimeoutMs: 30_000,
    authToken: 'test-token',
  },
  localServer: {
    enabled: false,
    host: '127.0.0.1',
    port: 9500,
    corsEnabled: false,
    corsOrigins: [],
    rateLimitPerMinute: 100,
    maxRequestBodyBytes: 1_048_576,
    staticDir: '',
  },
  orchestrator: {
    healthCheckIntervalMs: 30_000,
    restartDelayMs: 5000,
    maxRestartAttempts: 3,
    statusReportIntervalMs: 60_000,
  },
  logging: {
    level: 'info',
    pretty: false,
    logDir: null,
  },
  ledger: {
    enabled: false,
    baseUrl: '',
    syncIntervalMs: 60_000,
  },
} as unknown as VivimConfig

describe('NodeManager', () => {
  let manager: NodeManager

  beforeEach(() => {
    mockNode.start.mockClear()
    mockNode.stop.mockClear()
    mockNode.getPeers.mockClear()
    mockNode.getConnections.mockClear()
    mockNode.addEventListener.mockClear()
    manager = new NodeManager(DEFAULT_CONFIG)
  })

  it('constructor initializes in stopped state', () => {
    expect(manager.getState()).toBe('stopped')
    expect(manager.getNode()).toBeNull()
    expect(manager.getPeerId()).toBeNull()
  })

  it('start creates libp2p node and transitions to running', async () => {
    await manager.start()
    expect(manager.getState()).toBe('running')
    expect(manager.getNode()).toBe(mockNode)
    expect(manager.getPeerId()).toBe('test-peer-id-123')
  })

  it('start registers event listeners', async () => {
    await manager.start()
    expect(mockNode.addEventListener).toHaveBeenCalledTimes(3)
  })

  it('stop transitions to stopped', async () => {
    await manager.start()
    await manager.stop()
    expect(manager.getState()).toBe('stopped')
    expect(manager.getNode()).toBeNull()
  })

  it('stop is idempotent when already stopped', async () => {
    await manager.stop() // already stopped
    expect(manager.getState()).toBe('stopped')
  })

  it('getPeers returns empty when node not started', () => {
    expect(manager.getPeers()).toEqual([])
  })

  it('getPeers returns peer info from connections', async () => {
    mockNode.getConnections.mockReturnValue([
      {
        remotePeer: { toString: () => 'peer-abc' },
        remoteAddr: { toString: () => '/ip4/127.0.0.1/tcp/4001/p2p/peer-abc' },
      },
    ])

    await manager.start()
    const peers = manager.getPeers()
    expect(peers).toHaveLength(1)
    expect(peers[0]!.peerId).toBe('peer-abc')
    expect(peers[0]!.isRelayed).toBe(false)
  })

  it('getPeers detects relayed connections', async () => {
    mockNode.getConnections.mockReturnValue([
      {
        remotePeer: { toString: () => 'peer-relay' },
        remoteAddr: { toString: () => '/p2p-circuit/p2p/peer-relay' },
      },
    ])

    await manager.start()
    const peers = manager.getPeers()
    expect(peers[0]!.isRelayed).toBe(true)
  })

  it('getMetrics returns initial metrics when stopped', () => {
    const metrics = manager.getMetrics()
    expect(metrics.peerCount).toBe(0)
    expect(metrics.uptimeSeconds).toBe(0)
    expect(metrics.fileTransfersCompleted).toBe(0)
    expect(metrics.crdtSyncsCompleted).toBe(0)
  })

  it('getMetrics calculates uptime after start', async () => {
    await manager.start()
    const metrics = manager.getMetrics()
    expect(metrics.uptimeSeconds).toBeGreaterThanOrEqual(0)
  })

  it('emits stateChanged on start', async () => {
    const states: string[] = []
    manager.on('stateChanged', (state) => states.push(state))

    await manager.start()
    expect(states).toContain('starting')
    expect(states).toContain('running')
  })

  it('emits stateChanged on stop', async () => {
    await manager.start()

    const states: string[] = []
    manager.on('stateChanged', (state) => states.push(state))

    await manager.stop()
    expect(states).toContain('stopping')
    expect(states).toContain('stopped')
  })

  it('double start is no-op', async () => {
    await manager.start()
    await manager.start() // second call
    expect(manager.getState()).toBe('running')
  })
})
