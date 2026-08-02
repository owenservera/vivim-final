// tests/unit/lib/tunnel-shared/shared.test.ts
// tunnel-shared: constants, errors, types

import { describe, expect, it } from 'bun:test'

describe('tunnel-shared constants', () => {
  it('PROTOCOL_VERSION is "1.0"', async () => {
    const { PROTOCOL_VERSION } = await import('../../../../src/lib/tunnel-shared/constants.js')
    expect(PROTOCOL_VERSION).toBe('1.0')
  })

  it('TUNNEL_DEFAULTS has required fields', async () => {
    const { TUNNEL_DEFAULTS } = await import('../../../../src/lib/tunnel-shared/constants.js')
    expect(TUNNEL_DEFAULTS.HEARTBEAT_INTERVAL_MS).toBe(30_000)
    expect(TUNNEL_DEFAULTS.HEARTBEAT_TIMEOUT_MS).toBe(10_000)
    expect(TUNNEL_DEFAULTS.RECONNECT_INITIAL_DELAY_MS).toBe(1_000)
    expect(TUNNEL_DEFAULTS.RECONNECT_MAX_DELAY_MS).toBe(60_000)
    expect(TUNNEL_DEFAULTS.RECONNECT_JITTER_FACTOR).toBe(0.25)
    expect(TUNNEL_DEFAULTS.MAX_CONCURRENT_REQUESTS).toBe(50)
    expect(TUNNEL_DEFAULTS.REQUEST_TIMEOUT_MS).toBe(30_000)
  })

  it('P2P_PROTOCOLS has correct paths', async () => {
    const { P2P_PROTOCOLS } = await import('../../../../src/lib/tunnel-shared/constants.js')
    expect(P2P_PROTOCOLS.FILE_SYNC).toBe('/vivim/file-sync/1.0.0')
    expect(P2P_PROTOCOLS.CRDT_SYNC).toBe('/vivim/crdt-sync/1.0.0')
    expect(P2P_PROTOCOLS.PRESENCE).toBe('/vivim/presence/1.0.0')
  })

  it('P2P_DEFAULTS has correct values', async () => {
    const { P2P_DEFAULTS } = await import('../../../../src/lib/tunnel-shared/constants.js')
    expect(P2P_DEFAULTS.MDNS_INTERVAL).toBe(10_000)
    expect(P2P_DEFAULTS.MAX_PEERS).toBe(50)
    expect(P2P_DEFAULTS.MAX_FILE_SIZE).toBe(500 * 1024 * 1024)
    expect(P2P_DEFAULTS.CHUNK_SIZE).toBe(65_536)
  })

  it('TUNNEL_CLOSE_CODES has all codes', async () => {
    const { TUNNEL_CLOSE_CODES } = await import('../../../../src/lib/tunnel-shared/constants.js')
    expect(TUNNEL_CLOSE_CODES.NORMAL).toBe(1000)
    expect(TUNNEL_CLOSE_CODES.INVALID_JWT).toBe(4001)
    expect(TUNNEL_CLOSE_CODES.SUBDOMAIN_CONFLICT).toBe(4002)
    expect(TUNNEL_CLOSE_CODES.PROTOCOL_MISMATCH).toBe(4004)
  })

  it('RESERVED_SUBDOMAINS contains expected entries', async () => {
    const { RESERVED_SUBDOMAINS } = await import('../../../../src/lib/tunnel-shared/constants.js')
    expect(RESERVED_SUBDOMAINS.has('www')).toBe(true)
    expect(RESERVED_SUBDOMAINS.has('api')).toBe(true)
    expect(RESERVED_SUBDOMAINS.has('admin')).toBe(true)
    expect(RESERVED_SUBDOMAINS.has('not-reserved')).toBe(false)
  })

  it('TUNNEL_EVENTS has all event types', async () => {
    const { TUNNEL_EVENTS } = await import('../../../../src/lib/tunnel-shared/constants.js')
    expect(TUNNEL_EVENTS.CONNECTED).toBe('tunnel:connected')
    expect(TUNNEL_EVENTS.DISCONNECTED).toBe('tunnel:disconnected')
    expect(TUNNEL_EVENTS.ERROR).toBe('tunnel:error')
  })

  it('P2P_EVENTS has all event types', async () => {
    const { P2P_EVENTS } = await import('../../../../src/lib/tunnel-shared/constants.js')
    expect(P2P_EVENTS.PEER_DISCOVERED).toBe('p2p:peer:discovered')
    expect(P2P_EVENTS.FILE_RECEIVED).toBe('p2p:file:received')
    expect(P2P_EVENTS.ERROR).toBe('p2p:error')
  })
})

describe('tunnel-shared errors', () => {
  it('VivimError has correct name and code', async () => {
    const { VivimError } = await import('../../../../src/lib/tunnel-shared/errors.js')
    const err = new VivimError('test', 'TEST_CODE')
    expect(err.name).toBe('VivimError')
    expect(err.code).toBe('TEST_CODE')
    expect(err.message).toBe('test')
    expect(err).toBeInstanceOf(Error)
  })

  it('VivimError supports cause', async () => {
    const { VivimError } = await import('../../../../src/lib/tunnel-shared/errors.js')
    const cause = new Error('original')
    const err = new VivimError('wrapped', 'CODE', cause)
    expect(err.cause).toBe(cause)
  })

  it('TunnelError extends VivimError', async () => {
    const { TunnelError, VivimError } = await import('../../../../src/lib/tunnel-shared/errors.js')
    const err = new TunnelError('tunnel err', 'T_CODE')
    expect(err).toBeInstanceOf(TunnelError)
    expect(err).toBeInstanceOf(VivimError)
    expect(err).toBeInstanceOf(Error)
    expect(err.name).toBe('TunnelError')
  })

  it('TunnelConnectionError has fixed code', async () => {
    const { TunnelConnectionError } = await import('../../../../src/lib/tunnel-shared/errors.js')
    const err = new TunnelConnectionError('connection failed')
    expect(err.code).toBe('TUNNEL_CONNECTION_ERROR')
    expect(err).toBeInstanceOf(Error)
  })

  it('TunnelAuthError has fixed code', async () => {
    const { TunnelAuthError } = await import('../../../../src/lib/tunnel-shared/errors.js')
    const err = new TunnelAuthError('auth failed')
    expect(err.code).toBe('TUNNEL_AUTH_ERROR')
  })

  it('TunnelTimeoutError has fixed code', async () => {
    const { TunnelTimeoutError } = await import('../../../../src/lib/tunnel-shared/errors.js')
    const err = new TunnelTimeoutError('timed out')
    expect(err.code).toBe('TUNNEL_TIMEOUT_ERROR')
  })

  it('TunnelProtocolError has fixed code', async () => {
    const { TunnelProtocolError } = await import('../../../../src/lib/tunnel-shared/errors.js')
    const err = new TunnelProtocolError('bad frame')
    expect(err.code).toBe('TUNNEL_PROTOCOL_ERROR')
  })

  it('TunnelSubdomainError has fixed code', async () => {
    const { TunnelSubdomainError } = await import('../../../../src/lib/tunnel-shared/errors.js')
    const err = new TunnelSubdomainError('conflict')
    expect(err.code).toBe('TUNNEL_SUBDOMAIN_ERROR')
  })

  it('P2PError extends VivimError', async () => {
    const { P2PError, VivimError } = await import('../../../../src/lib/tunnel-shared/errors.js')
    const err = new P2PError('p2p err', 'P_CODE')
    expect(err).toBeInstanceOf(P2PError)
    expect(err).toBeInstanceOf(VivimError)
    expect(err.name).toBe('P2PError')
  })

  it('P2PConnectionError has fixed code', async () => {
    const { P2PConnectionError } = await import('../../../../src/lib/tunnel-shared/errors.js')
    const err = new P2PConnectionError('peer unreachable')
    expect(err.code).toBe('P2P_CONNECTION_ERROR')
  })

  it('P2PFileTransferError has fixed code', async () => {
    const { P2PFileTransferError } = await import('../../../../src/lib/tunnel-shared/errors.js')
    const err = new P2PFileTransferError('transfer failed')
    expect(err.code).toBe('P2P_FILE_TRANSFER_ERROR')
  })

  it('P2PCRTDSyncError has fixed code', async () => {
    const { P2PCRTDSyncError } = await import('../../../../src/lib/tunnel-shared/errors.js')
    const err = new P2PCRTDSyncError('sync conflict')
    expect(err.code).toBe('P2P_CRDT_SYNC_ERROR')
  })

  it('LocalServerError extends VivimError', async () => {
    const { LocalServerError, VivimError } = await import(
      '../../../../src/lib/tunnel-shared/errors.js'
    )
    const err = new LocalServerError('server err', 'LS_CODE')
    expect(err).toBeInstanceOf(LocalServerError)
    expect(err).toBeInstanceOf(VivimError)
    expect(err.name).toBe('LocalServerError')
  })

  it('LocalServerStartError has fixed code', async () => {
    const { LocalServerStartError } = await import('../../../../src/lib/tunnel-shared/errors.js')
    const err = new LocalServerStartError('port in use')
    expect(err.code).toBe('LOCAL_SERVER_START_ERROR')
  })

  it('OrchestratorError extends VivimError', async () => {
    const { OrchestratorError, VivimError } = await import(
      '../../../../src/lib/tunnel-shared/errors.js'
    )
    const err = new OrchestratorError('orch err', 'ORCH_CODE')
    expect(err).toBeInstanceOf(OrchestratorError)
    expect(err).toBeInstanceOf(VivimError)
    expect(err.name).toBe('OrchestratorError')
  })

  it('ServiceCrashError has serviceName and attempt', async () => {
    const { ServiceCrashError } = await import('../../../../src/lib/tunnel-shared/errors.js')
    const err = new ServiceCrashError('tunnel', 3)
    expect(err.serviceName).toBe('tunnel')
    expect(err.attempt).toBe(3)
    expect(err.code).toBe('SERVICE_CRASH_ERROR')
    expect(err.message).toContain('tunnel')
    expect(err.message).toContain('3')
  })

  it('ConfigError has fixed code', async () => {
    const { ConfigError } = await import('../../../../src/lib/tunnel-shared/errors.js')
    const err = new ConfigError('missing field')
    expect(err.code).toBe('CONFIG_ERROR')
  })
})
