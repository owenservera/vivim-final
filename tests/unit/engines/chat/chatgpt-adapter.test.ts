// tests/unit/engines/chat/chatgpt-adapter.test.ts
// Unit tests for ChatGPTAdapter — inline auth extraction, API calls, DAG parser.

import { describe, expect, mock, test } from 'bun:test'
import { ChatGPTAdapter } from '../../../../src/engines/adapters/chatgpt-adapter.js'
import type { AuthContext } from '../../../../src/engines/provider-conversation-adapter.js'
import { AdapterError } from '../../../../src/engines/provider-conversation-adapter.js'

// ── Mock governor ───────────────────────────────────────────────────────────

// Cast mock through unknown to satisfy globalThis.fetch's preconnect requirement
const mockFetch = (fn: (url: string | URL | Request) => Promise<Response>) =>
  fn as unknown as typeof globalThis.fetch

function createMockGovernor(cookieValue = 'test-session-token') {
  const cookies = [
    {
      name: '__Secure-next-auth.session-token',
      value: cookieValue,
      domain: '.chatgpt.com',
      path: '/',
      expires: Date.now() / 1000 + 3600,
      httpOnly: true,
      secure: true,
    },
    {
      name: '__cf_bm',
      value: 'cf-bm-val',
      domain: '.chatgpt.com',
      path: '/',
      expires: Date.now() / 1000 + 3600,
      httpOnly: true,
      secure: true,
    },
  ]

  return {
    send: mock(async (_slaveId: string, method: string, _params?: Record<string, unknown>) => {
      if (method === 'Network.getCookies') {
        return { cookies }
      }
      return null
    }),
  }
}

function createMockGovernorNoSession() {
  return {
    send: mock(async (_slaveId: string, method: string) => {
      if (method === 'Network.getCookies') {
        return {
          cookies: [
            {
              name: 'other_cookie',
              value: 'x',
              domain: '.chatgpt.com',
              path: '/',
              expires: 0,
              httpOnly: false,
              secure: false,
            },
          ],
        }
      }
      return null
    }),
  }
}

// ── Auth extraction ─────────────────────────────────────────────────────────

describe('ChatGPTAdapter', () => {
  describe('getAuthContext', () => {
    test('extracts session cookie from CDP', async () => {
      const governor = createMockGovernor('my-jwt-token')
      const adapter = new ChatGPTAdapter(governor)

      const ctx = await adapter.getAuthContext('slave-1')

      expect(ctx.bearerToken).toBe('my-jwt-token')
      expect(ctx.headers?.Authorization).toBe('Bearer my-jwt-token')
      expect(ctx.cookies?.length).toBeGreaterThan(0)
      expect(governor.send).toHaveBeenCalledWith('slave-1', 'Network.getCookies', {
        urls: ['https://chatgpt.com/*'],
      })
    })

    test('throws AdapterError when no session cookie', async () => {
      const governor = createMockGovernorNoSession()
      const adapter = new ChatGPTAdapter(governor)

      await expect(adapter.getAuthContext('slave-1')).rejects.toThrow(AdapterError)
    })

    test('caches auth context for 60s', async () => {
      const governor = createMockGovernor('cached-token')
      const adapter = new ChatGPTAdapter(governor)

      const ctx1 = await adapter.getAuthContext('slave-1')
      const ctx2 = await adapter.getAuthContext('slave-1')

      expect(governor.send).toHaveBeenCalledTimes(1)
      expect(ctx1.bearerToken).toBe(ctx2.bearerToken)
    })

    test('clearAuthCache forces re-extraction', async () => {
      const governor = createMockGovernor('fresh-token')
      const adapter = new ChatGPTAdapter(governor)

      await adapter.getAuthContext('slave-1')
      adapter.clearAuthCache('slave-1')
      await adapter.getAuthContext('slave-1')

      expect(governor.send).toHaveBeenCalledTimes(2)
    })
  })

  // ── listConversations ─────────────────────────────────────────────────────

  describe('listConversations', () => {
    test('returns paginated conversation headers', async () => {
      const governor = createMockGovernor()
      const adapter = new ChatGPTAdapter(governor)
      const auth: AuthContext = { bearerToken: 'token', headers: { Authorization: 'Bearer token' } }

      globalThis.fetch = mockFetch(async (url: string | URL | Request) => {
        const urlStr = typeof url === 'string' ? url : url instanceof URL ? url.toString() : url.url
        if (urlStr.includes('/conversations?')) {
          return new Response(
            JSON.stringify({
              items: [
                {
                  id: 'conv-1',
                  title: 'Test Chat',
                  create_time: 1700000000,
                  update_time: 1700001000,
                },
                {
                  id: 'conv-2',
                  title: 'Another Chat',
                  create_time: 1699000000,
                  update_time: 1699001000,
                },
              ],
              total: 2,
            }),
            { status: 200, headers: { 'content-type': 'application/json' } },
          )
        }
        return new Response('Not Found', { status: 404 })
      })

      const result = await adapter.listConversations('account-1', auth, { limit: 100 })

      expect(result.items).toHaveLength(2)
      const first = result.items[0]
      if (first) {
        expect(first.id).toBe('conv-1')
        expect(first.title).toBe('Test Chat')
      }
      expect(result.total).toBe(2)
      expect(result.nextCursor).toBeUndefined()
    })

    test('returns nextCursor when more pages exist', async () => {
      const governor = createMockGovernor()
      const adapter = new ChatGPTAdapter(governor)
      const auth: AuthContext = { bearerToken: 'token' }

      globalThis.fetch = mockFetch(async () => {
        return new Response(
          JSON.stringify({
            items: [
              { id: 'c1', title: 'Chat 1', create_time: 1700000000, update_time: 1700001000 },
            ],
            total: 200,
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        )
      })

      const result = await adapter.listConversations('account-1', auth, { limit: 100 })

      expect(result.nextCursor).toBe('100')
    })

    test('filters out archived conversations', async () => {
      const governor = createMockGovernor()
      const adapter = new ChatGPTAdapter(governor)
      const auth: AuthContext = { bearerToken: 'token' }

      globalThis.fetch = mockFetch(async () => {
        return new Response(
          JSON.stringify({
            items: [
              { id: 'conv-1', title: 'Active', create_time: 1700000000, update_time: 1700001000 },
              {
                id: 'conv-2',
                title: 'Archived',
                create_time: 1700000000,
                update_time: 1700001000,
                is_archived: true,
              },
            ],
            total: 2,
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        )
      })

      const result = await adapter.listConversations('account-1', auth)

      expect(result.items).toHaveLength(1)
      const first = result.items[0]
      if (first) {
        expect(first.id).toBe('conv-1')
      }
    })
  })

  // ── getConversation (DAG parser) ──────────────────────────────────────────

  describe('getConversation', () => {
    test('parses DAG mapping into linear message list', async () => {
      const governor = createMockGovernor()
      const adapter = new ChatGPTAdapter(governor)
      const auth: AuthContext = { bearerToken: 'token' }

      globalThis.fetch = mockFetch(async () => {
        return new Response(
          JSON.stringify({
            title: 'My Chat',
            mapping: {
              'node-root': {
                id: 'node-root',
                parent: null,
                message: {
                  author: { role: 'system' },
                  content: { content_type: 'text', parts: ['You are helpful.'] },
                  create_time: 1700000000,
                },
              },
              'node-1': {
                id: 'node-1',
                parent: 'node-root',
                message: {
                  author: { role: 'user' },
                  content: { content_type: 'text', parts: ['Hello'] },
                  create_time: 1700000001,
                },
              },
              'node-2': {
                id: 'node-2',
                parent: 'node-1',
                message: {
                  author: { role: 'assistant' },
                  content: { content_type: 'text', parts: ['Hi there!'] },
                  create_time: 1700000002,
                },
              },
            },
            create_time: 1700000000,
            update_time: 1700000002,
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        )
      })

      const result = await adapter.getConversation('account-1', auth, 'conv-1')

      expect(result).not.toBeNull()
      expect(result?.title).toBe('My Chat')
      expect(result?.messages).toHaveLength(3)
      // Messages sorted by timestamp
      const msgs = result?.messages
      expect(msgs[0]?.role).toBe('system')
      expect(msgs[0]?.content).toBe('You are helpful.')
      expect(msgs[1]?.role).toBe('user')
      expect(msgs[1]?.content).toBe('Hello')
      expect(msgs[2]?.role).toBe('assistant')
      expect(msgs[2]?.content).toBe('Hi there!')
    })

    test('handles multimodal content (images)', async () => {
      const governor = createMockGovernor()
      const adapter = new ChatGPTAdapter(governor)
      const auth: AuthContext = { bearerToken: 'token' }

      globalThis.fetch = mockFetch(async () => {
        return new Response(
          JSON.stringify({
            title: 'Image Chat',
            mapping: {
              n1: {
                id: 'n1',
                parent: null,
                message: {
                  author: { role: 'user' },
                  content: {
                    content_type: 'multimodal_text',
                    parts: [
                      'What is this?',
                      {
                        content_type: 'image_asset_pointer',
                        metadata: { dalle: { prompt: 'a cat' } },
                      },
                    ],
                  },
                  create_time: 1700000000,
                },
              },
            },
            create_time: 1700000000,
            update_time: 1700000000,
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        )
      })

      const result = await adapter.getConversation('account-1', auth, 'conv-1')

      expect(result?.messages).toHaveLength(1)
      const msg = result?.messages[0]
      expect(msg?.content).toContain('What is this?')
      expect(msg?.content).toContain('[Image: a cat]')
      expect(msg?.artifacts).toHaveLength(1)
      expect(msg?.artifacts?.[0]?.kind).toBe('image')
    })

    test('fixes orphaned parent references', async () => {
      const governor = createMockGovernor()
      const adapter = new ChatGPTAdapter(governor)
      const auth: AuthContext = { bearerToken: 'token' }

      globalThis.fetch = mockFetch(async () => {
        return new Response(
          JSON.stringify({
            title: 'Orphan Chat',
            mapping: {
              n1: {
                id: 'n1',
                parent: 'nonexistent',
                message: {
                  author: { role: 'user' },
                  content: { content_type: 'text', parts: ['Hello'] },
                  create_time: 1700000000,
                },
              },
              n2: {
                id: 'n2',
                parent: 'n1',
                message: {
                  author: { role: 'assistant' },
                  content: { content_type: 'text', parts: ['Hi'] },
                  create_time: 1700000001,
                },
              },
            },
            create_time: 1700000000,
            update_time: 1700000001,
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        )
      })

      const result = await adapter.getConversation('account-1', auth, 'conv-1')

      // n1's parent 'nonexistent' should be resolved to null
      expect(result?.messages[0]?.parentId).toBeNull()
    })

    test('returns null for 404', async () => {
      const governor = createMockGovernor()
      const adapter = new ChatGPTAdapter(governor)
      const auth: AuthContext = { bearerToken: 'token' }

      globalThis.fetch = mockFetch(async () => new Response('Not Found', { status: 404 }))

      const result = await adapter.getConversation('account-1', auth, 'nonexistent')
      expect(result).toBeNull()
    })
  })

  // ── searchConversations ───────────────────────────────────────────────────

  describe('searchConversations', () => {
    test('returns matching conversations', async () => {
      const governor = createMockGovernor()
      const adapter = new ChatGPTAdapter(governor)
      const auth: AuthContext = { bearerToken: 'token' }

      globalThis.fetch = mockFetch(async () => {
        return new Response(
          JSON.stringify({
            items: [
              { conversation_id: 'c1', title: 'TypeScript help', update_time: 1700001000 },
              { conversation_id: 'c2', title: 'Python help', update_time: 1700000500 },
            ],
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        )
      })

      const results = await adapter.searchConversations('account-1', auth, 'help')

      expect(results).toHaveLength(2)
      const first = results[0]
      if (first) {
        expect(first.id).toBe('c1')
        expect(first.title).toBe('TypeScript help')
      }
    })

    test('returns empty array for no results', async () => {
      const governor = createMockGovernor()
      const adapter = new ChatGPTAdapter(governor)
      const auth: AuthContext = { bearerToken: 'token' }

      globalThis.fetch = mockFetch(async () => {
        return new Response(JSON.stringify({ items: [] }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      })

      const results = await adapter.searchConversations('account-1', auth, 'nonexistent')
      expect(results).toHaveLength(0)
    })
  })

  // ── Error handling ────────────────────────────────────────────────────────

  describe('error handling', () => {
    test('throws AUTH_EXPIRED on 401', async () => {
      const governor = createMockGovernor()
      const adapter = new ChatGPTAdapter(governor)
      const auth: AuthContext = { bearerToken: 'expired-token' }

      globalThis.fetch = mockFetch(async () => new Response('Unauthorized', { status: 401 }))

      await expect(adapter.listConversations('account-1', auth)).rejects.toThrow(AdapterError)
    })

    test('throws RATE_LIMITED on 429', async () => {
      const governor = createMockGovernor()
      const adapter = new ChatGPTAdapter(governor)
      const auth: AuthContext = { bearerToken: 'token' }

      globalThis.fetch = mockFetch(
        async () =>
          new Response('Rate Limited', {
            status: 429,
            headers: { 'Retry-After': '30' },
          }),
      )

      await expect(adapter.listConversations('account-1', auth)).rejects.toThrow(AdapterError)
    })
  })
})
