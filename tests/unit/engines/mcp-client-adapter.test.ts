import { beforeEach, describe, expect, mock, test } from 'bun:test'
import { McpClientAdapter } from '../../../src/engines/mcp-client-adapter.js'

const originalFetch = globalThis.fetch

describe('McpClientAdapter', () => {
  let adapter: McpClientAdapter

  beforeEach(() => {
    adapter = new McpClientAdapter()
    globalThis.fetch = originalFetch
  })

  test('connect fetches tools from remote server', async () => {
    const mockFetch = mock(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({ tools: [{ name: 't1', description: 'desc', inputSchema: {} }] }),
          { status: 200 },
        ),
      ),
    )
    globalThis.fetch = mockFetch as any

    await adapter.connect('srv1', 'http://localhost:3000')
    expect(adapter.isConnected('srv1')).toBe(true)

    const tools = await adapter.listTools('srv1')
    expect(tools).toHaveLength(1)
    expect(tools[0]?.name).toBe('t1')
  })

  test('connect sets error status on fetch failure', async () => {
    globalThis.fetch = mock(() => Promise.reject(new Error('ECONNREFUSED'))) as any

    await adapter.connect('srv1', 'http://localhost:3000')
    expect(adapter.isConnected('srv1')).toBe(false)

    const conns = adapter.getConnections()
    expect(conns[0]?.status).toBe('error')
  })

  test('callTool sends POST to remote server', async () => {
    const mockFetch = mock((url: string) => {
      if (url.endsWith('/tools')) {
        return Promise.resolve(
          new Response(
            JSON.stringify({ tools: [{ name: 'echo', description: 'echo', inputSchema: {} }] }),
            { status: 200 },
          ),
        )
      }
      return Promise.resolve(
        new Response(JSON.stringify({ content: { echoed: true } }), { status: 200 }),
      )
    })
    globalThis.fetch = mockFetch as any

    await adapter.connect('srv1', 'http://localhost:3000')
    const result = await adapter.callTool('srv1', 'echo', { msg: 'hi' })
    expect(result.content).toEqual({ echoed: true })
  })

  test('disconnect removes connection', async () => {
    globalThis.fetch = mock(() =>
      Promise.resolve(new Response(JSON.stringify({ tools: [] }), { status: 200 })),
    ) as any

    await adapter.connect('srv1', 'http://localhost:3000')
    expect(adapter.isConnected('srv1')).toBe(true)

    await adapter.disconnect('srv1')
    expect(adapter.isConnected('srv1')).toBe(false)
    expect(adapter.getConnections()).toHaveLength(0)
  })
})
