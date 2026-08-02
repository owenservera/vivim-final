// tests/unit/lib/tunnel-client/frame-protocol.test.ts
// Frame encode/decode + query-from-path parsing

import { describe, expect, it } from 'bun:test'
import {
  createHttpAbortFrame,
  createHttpResponseFrame,
  createPingFrame,
  createStatusFrame,
  decodeFrame,
  encodeFrame,
} from '../../../../src/lib/tunnel-client/frame-protocol.js'

describe('frame-protocol', () => {
  describe('encodeFrame', () => {
    it('encodes a frame to JSON string', () => {
      const frame = createPingFrame(42)
      const encoded = encodeFrame(frame)
      const parsed = JSON.parse(encoded)
      expect(parsed.type).toBe('ping')
      expect(parsed.latencyHint).toBe(42)
    })
  })

  describe('decodeFrame', () => {
    it('decodes http.request frame', () => {
      const raw = JSON.stringify({
        id: 'req-1',
        type: 'http.request',
        timestamp: Date.now(),
        version: '1.0',
        method: 'GET',
        path: '/api/health',
        query: { foo: 'bar' },
        headers: { host: 'localhost' },
        body: null,
        bodySize: 0,
        remoteAddress: '127.0.0.1',
        protocol: 'https',
        host: 'localhost',
      })

      const frame = decodeFrame(raw)
      expect(frame.type).toBe('http.request')
      expect((frame as any).method).toBe('GET')
      expect((frame as any).path).toBe('/api/health')
      expect((frame as any).query.foo).toBe('bar')
    })

    it('parses query from path when query field is missing', () => {
      const raw = JSON.stringify({
        id: 'req-2',
        type: 'http.request',
        timestamp: Date.now(),
        version: '1.0',
        method: 'GET',
        path: '/api/search?q=hello&limit=10',
        headers: {},
        body: null,
        bodySize: 0,
        remoteAddress: '127.0.0.1',
        protocol: 'https',
        host: 'localhost',
      })

      const frame = decodeFrame(raw)
      expect((frame as any).path).toBe('/api/search')
      expect((frame as any).query.q).toBe('hello')
      expect((frame as any).query.limit).toBe('10')
    })

    it('uses existing query field when present (even if path has query string)', () => {
      const raw = JSON.stringify({
        id: 'req-3',
        type: 'http.request',
        timestamp: Date.now(),
        version: '1.0',
        method: 'POST',
        path: '/api/data?ignored=yes',
        query: { real: 'value' },
        headers: {},
        body: null,
        bodySize: 0,
        remoteAddress: '127.0.0.1',
        protocol: 'https',
        host: 'localhost',
      })

      const frame = decodeFrame(raw)
      expect((frame as any).path).toBe('/api/data')
      expect((frame as any).query.real).toBe('value')
      expect((frame as any).query.ignored).toBeUndefined()
    })

    it('decodes pong frame', () => {
      const raw = JSON.stringify({
        id: 'p-1',
        type: 'pong',
        timestamp: Date.now(),
        version: '1.0',
        serverTime: 12345,
      })

      const frame = decodeFrame(raw)
      expect(frame.type).toBe('pong')
      expect((frame as any).serverTime).toBe(12345)
    })

    it('decodes assigned frame', () => {
      const raw = JSON.stringify({
        id: 'a-1',
        type: 'assigned',
        timestamp: Date.now(),
        version: '1.0',
        subdomain: 'user-test',
        protocolVersion: '1.0',
        relayUrl: 'wss://relay.example.com',
        serverTime: Date.now(),
      })

      const frame = decodeFrame(raw)
      expect(frame.type).toBe('assigned')
      expect((frame as any).subdomain).toBe('user-test')
    })

    it('decodes error frame', () => {
      const raw = JSON.stringify({
        id: 'e-1',
        type: 'error',
        timestamp: Date.now(),
        version: '1.0',
        code: 'AUTH_FAILED',
        message: 'Invalid token',
        fatal: true,
      })

      const frame = decodeFrame(raw)
      expect(frame.type).toBe('error')
      expect((frame as any).code).toBe('AUTH_FAILED')
      expect((frame as any).fatal).toBe(true)
    })

    it('throws on missing id', () => {
      expect(() =>
        decodeFrame(JSON.stringify({ type: 'ping', timestamp: 1, version: '1.0' })),
      ).toThrow('Missing required fields')
    })

    it('throws on missing type', () => {
      expect(() => decodeFrame(JSON.stringify({ id: 'x', timestamp: 1, version: '1.0' }))).toThrow(
        'Missing required fields',
      )
    })

    it('throws on invalid JSON', () => {
      expect(() => decodeFrame('not json')).toThrow('Invalid JSON')
    })

    it('does not throw on missing version or timestamp (gateway compatibility)', () => {
      const raw = JSON.stringify({ id: 'x', type: 'pong', serverTime: 1 })
      const frame = decodeFrame(raw)
      expect(frame.type).toBe('pong')
    })
  })

  describe('createHttpResponseFrame', () => {
    it('creates frame with requestId field', () => {
      const frame = createHttpResponseFrame(
        'req-1',
        200,
        { 'content-type': 'application/json' },
        Buffer.from('{"ok":true}').toString('base64'),
        13,
        false,
        42,
      )
      expect(frame.type).toBe('http.response')
      expect(frame.requestId).toBe('req-1')
      expect(frame.status).toBe(200)
      expect(frame.duration).toBe(42)
    })
  })

  describe('createHttpAbortFrame', () => {
    it('creates abort frame with reason and code', () => {
      const frame = createHttpAbortFrame('req-1', 'Timeout', 'REQUEST_TIMEOUT')
      expect(frame.type).toBe('http.abort')
      expect(frame.requestId).toBe('req-1')
      expect(frame.reason).toBe('Timeout')
      expect(frame.code).toBe('REQUEST_TIMEOUT')
    })
  })

  describe('createStatusFrame', () => {
    it('creates status frame with subsystem states', () => {
      const frame = createStatusFrame(
        { running: true, port: 8080, requestCount: 42 },
        { running: true, peerCount: 3, relayed: false },
        { cpu: 0.5, memory: 128, uptime: 3600 },
      )
      expect(frame.type).toBe('status')
      expect(frame.localServer.running).toBe(true)
      expect(frame.p2pNode.peerCount).toBe(3)
      expect(frame.system.uptime).toBe(3600)
    })
  })
})
