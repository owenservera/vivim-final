import { describe, expect, mock, test } from 'bun:test'
import { createJsonRpcHandler } from '../../../src/mcp/browser-mcp.js'
import type { McpTool } from '../../../src/mcp/types.js'

function makeHandler() {
  const tools: McpTool[] = [
    {
      name: 'browser_nav_navigate',
      description: 'navigate',
      inputSchema: { type: 'object', properties: { url: { type: 'string' } }, required: ['url'] },
      handler: async (args) => ({
        content: [{ type: 'text', text: JSON.stringify({ ok: true, url: args.url }) }],
      }),
    },
    {
      name: 'browser_status',
      description: 'status',
      inputSchema: { type: 'object', properties: {}, required: [] },
      handler: async () => ({
        content: [{ type: 'text', text: JSON.stringify({ ok: true, slaveId: 's1' }) }],
      }),
    },
    {
      name: 'browser_explode',
      description: 'always throws',
      inputSchema: { type: 'object', properties: {}, required: [] },
      handler: async () => {
        throw new Error('boom')
      },
    },
  ]
  const shutdown = mock(() => Promise.resolve())
  const handle = createJsonRpcHandler({ tools, onShutdown: shutdown })
  return { handle, shutdown }
}

function send(handle: (l: string) => Promise<string | null>, msg: unknown) {
  return handle(JSON.stringify(msg))
}

describe('browser MCP JSON-RPC protocol', () => {
  test('initialize returns protocol info', async () => {
    const { handle } = makeHandler()
    const res = await send(handle, {
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 'test' } },
    })
    const parsed = JSON.parse(res!)
    expect(parsed.id).toBe(1)
    expect(parsed.result.protocolVersion).toBeTruthy()
    expect(parsed.result.capabilities.tools).toBeTruthy()
    expect(parsed.result.serverInfo.name).toBeTruthy()
  })

  test('notifications/initialized produces no response', async () => {
    const { handle } = makeHandler()
    const res = await send(handle, { jsonrpc: '2.0', method: 'notifications/initialized' })
    expect(res).toBeNull()
  })

  test('tools/list returns the tool surface', async () => {
    const { handle } = makeHandler()
    const res = await send(handle, { jsonrpc: '2.0', id: 2, method: 'tools/list' })
    const parsed = JSON.parse(res!)
    expect(parsed.result.tools.length).toBe(3)
    expect(parsed.result.tools[0]!.name).toBe('browser_nav_navigate')
    expect(parsed.result.tools[0]!.inputSchema.type).toBe('object')
  })

  test('tools/call routes to the tool handler', async () => {
    const { handle } = makeHandler()
    const res = await send(handle, {
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/call',
      params: { name: 'browser_nav_navigate', arguments: { url: 'https://a.com' } },
    })
    const parsed = JSON.parse(res!)
    expect(parsed.result.content[0]!.type).toBe('text')
    const payload = JSON.parse(parsed.result.content[0]!.text)
    expect(payload.ok).toBe(true)
    expect(payload.url).toBe('https://a.com')
    expect(parsed.result.isError).toBeFalsy()
  })

  test('tools/call for a throwing handler returns isError', async () => {
    const { handle } = makeHandler()
    const res = await send(handle, {
      jsonrpc: '2.0',
      id: 4,
      method: 'tools/call',
      params: { name: 'browser_explode', arguments: {} },
    })
    const parsed = JSON.parse(res!)
    expect(parsed.result.isError).toBe(true)
    expect(parsed.result.content[0]!.text).toContain('boom')
  })

  test('unknown tool returns isError', async () => {
    const { handle } = makeHandler()
    const res = await send(handle, {
      jsonrpc: '2.0',
      id: 5,
      method: 'tools/call',
      params: { name: 'nope', arguments: {} },
    })
    const parsed = JSON.parse(res!)
    expect(parsed.result.isError).toBe(true)
  })

  test('unknown method → -32601', async () => {
    const { handle } = makeHandler()
    const res = await send(handle, { jsonrpc: '2.0', id: 6, method: 'bogus' })
    const parsed = JSON.parse(res!)
    expect(parsed.error.code).toBe(-32601)
  })

  test('malformed JSON → -32700', async () => {
    const { handle } = makeHandler()
    const res = await handle('{not json')
    const parsed = JSON.parse(res!)
    expect(parsed.error.code).toBe(-32700)
  })

  test('missing method → -32600', async () => {
    const { handle } = makeHandler()
    const res = await send(handle, { jsonrpc: '2.0', id: 7 })
    const parsed = JSON.parse(res!)
    expect(parsed.error.code).toBe(-32600)
  })

  test('ping returns empty result', async () => {
    const { handle } = makeHandler()
    const res = await send(handle, { jsonrpc: '2.0', id: 8, method: 'ping' })
    const parsed = JSON.parse(res!)
    expect(parsed.result).toEqual({})
  })

  test('shutdown triggers onShutdown and returns null result', async () => {
    const { handle, shutdown } = makeHandler()
    const res = await send(handle, { jsonrpc: '2.0', id: 9, method: 'shutdown' })
    const parsed = JSON.parse(res!)
    expect(parsed.result).toBeNull()
    expect(shutdown).toHaveBeenCalled()
  })

  test('notifications/cancelled produces no response', async () => {
    const { handle } = makeHandler()
    const res = await send(handle, {
      jsonrpc: '2.0',
      method: 'notifications/cancelled',
      params: {},
    })
    expect(res).toBeNull()
  })
})
