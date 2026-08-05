// tests/unit/lib/ledger-client/ledger-client.test.ts
// LedgerClient — signup, sync, mint tunnel JWT

import { beforeEach, describe, expect, it, mock } from 'bun:test'
import { LedgerClient } from '../../../../src/lib/ledger-client/ledger-client.js'
import type { LedgerClientConfig } from '../../../../src/lib/ledger-client/types.js'

function makeConfig(overrides?: Partial<LedgerClientConfig>): LedgerClientConfig {
  return {
    baseUrl: 'https://ledger.test.local',
    userToken: null,
    subdomain: null,
    userId: null,
    publicKeyHex: '00'.repeat(32),
    syncIntervalMs: 60_000,
    ...overrides,
  }
}

describe('LedgerClient', () => {
  let fetchMock: ReturnType<typeof mock>

  beforeEach(() => {
    fetchMock = mock()
    globalThis.fetch = fetchMock as never
  })

  describe('signup', () => {
    it('calls POST /api/v1/beta/signup with email', async () => {
      fetchMock.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            userId: 'u1',
            token: 'tok_abc',
            subdomain: 'user-test',
            entitledProviderCount: 6,
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
      )

      const client = new LedgerClient(makeConfig())
      const result = await client.signup('test@example.com')

      expect(fetchMock).toHaveBeenCalledTimes(1)
      const [url, opts] = fetchMock.mock.calls[0]!
      expect(url).toBe('https://ledger.test.local/api/v1/beta/signup')
      expect(opts.method).toBe('POST')
      expect(result.userId).toBe('u1')
      expect(result.token).toBe('tok_abc')
      expect(result.subdomain).toBe('user-test')
    })

    it('stores credentials after signup', async () => {
      fetchMock.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            userId: 'u2',
            token: 'tok_xyz',
            subdomain: 'user-xyz',
            entitledProviderCount: 3,
          }),
          { status: 200 },
        ),
      )

      const config = makeConfig()
      const client = new LedgerClient(config)
      await client.signup('new@example.com')

      expect(config.userToken).toBe('tok_xyz')
      expect(config.subdomain).toBe('user-xyz')
      expect(config.userId).toBe('u2')
    })

    it('throws on HTTP error', async () => {
      fetchMock.mockResolvedValueOnce(new Response('Bad Request', { status: 400 }))

      const client = new LedgerClient(makeConfig())
      await expect(client.signup('bad')).rejects.toThrow('HTTP 400')
    })
  })

  describe('mintTunnelToken', () => {
    it('calls POST /api/v1/tunnel/token with auth header', async () => {
      fetchMock.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            token: 'jwt_abc',
            subdomain: 'user-test',
            publicUrl: 'https://user-test.vivim.live/',
            connectUrl: 'wss://tunnel.vivim.live/connect',
            expiresIn: 3600,
          }),
          { status: 200 },
        ),
      )

      const client = new LedgerClient(makeConfig({ userToken: 'existing_token' }))
      const result = await client.mintTunnelToken()

      const [url, opts] = fetchMock.mock.calls[0]!
      expect(url).toBe('https://ledger.test.local/api/v1/tunnel/token')
      expect(opts.headers).toEqual({ Authorization: 'Bearer existing_token' })
      expect(result.token).toBe('jwt_abc')
      expect(result.subdomain).toBe('user-test')
    })

    it('throws if no user token', async () => {
      const client = new LedgerClient(makeConfig())
      await expect(client.mintTunnelToken()).rejects.toThrow('No user token')
    })
  })

  describe('sync', () => {
    it('calls GET /api/v1/ledger/sync with auth header', async () => {
      fetchMock.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            entries: [],
            hasMore: false,
            newSyncCursor: null,
          }),
          { status: 200 },
        ),
      )

      const client = new LedgerClient(makeConfig({ userToken: 'tok' }))
      const result = await client.sync()

      const [url, opts] = fetchMock.mock.calls[0]!
      expect(url).toContain('/api/v1/ledger/sync')
      expect(opts.headers).toEqual({ Authorization: 'Bearer tok' })
      expect(result.applied).toBe(0)
    })

    it('throws if no user token', async () => {
      const client = new LedgerClient(makeConfig())
      await expect(client.sync()).rejects.toThrow('No user token')
    })
  })

  describe('health', () => {
    it('calls GET /api/v1/health', async () => {
      fetchMock.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            chainLength: 42,
            lastHash: 'abc123',
            publicKey: 'deadbeef',
          }),
          { status: 200 },
        ),
      )

      const client = new LedgerClient(makeConfig())
      const result = await client.health()

      expect(result.chainLength).toBe(42)
      expect(result.lastHash).toBe('abc123')
    })
  })

  describe('state', () => {
    it('starts uninitialized without credentials', () => {
      const client = new LedgerClient(makeConfig())
      expect(client.getState()).toBe('uninitialized')
      expect(client.hasCredentials()).toBe(false)
    })

    it('reports hasCredentials when all fields present', () => {
      const client = new LedgerClient(
        makeConfig({
          userToken: 'tok',
          subdomain: 'sub',
          userId: 'uid',
        }),
      )
      expect(client.hasCredentials()).toBe(true)
    })
  })
})
