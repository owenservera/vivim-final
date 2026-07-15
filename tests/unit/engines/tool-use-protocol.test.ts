import { beforeEach, describe, expect, mock, test } from 'bun:test'
import type { McpClientAdapter } from '../../../src/engines/mcp-client-adapter.js'
import { ToolUseProtocolImpl } from '../../../src/engines/tool-use-protocol.js'

function makeClient(): McpClientAdapter {
  return {
    listTools: mock(() =>
      Promise.resolve([
        { name: 'echo', description: 'echo tool', inputSchema: { type: 'object' } },
      ]),
    ),
    callTool: mock(() => Promise.resolve({ content: { result: 42 } })),
    connect: mock(() => Promise.resolve()),
    disconnect: mock(() => Promise.resolve()),
    getConnections: mock(() => []),
    isConnected: mock(() => true),
  } as any
}

describe('ToolUseProtocolImpl', () => {
  let client: McpClientAdapter
  let protocol: ToolUseProtocolImpl

  beforeEach(() => {
    client = makeClient()
    protocol = new ToolUseProtocolImpl(client)
  })

  test('listTools fetches from client and maps to ToolDefinition', async () => {
    const tools = await protocol.listTools('srv1')
    expect(tools).toHaveLength(1)
    expect(tools[0]?.name).toBe('echo')
    expect(tools[0]?.outputSchema).toEqual({})
  })

  test('executeTool calls client.callTool and returns success', async () => {
    const result = await protocol.executeTool('srv1', 'echo', { msg: 'hi' })
    expect(client.callTool).toHaveBeenCalledWith('srv1', 'echo', { msg: 'hi' })
    expect(result.success).toBe(true)
    expect(result.output).toEqual({ result: 42 })
  })

  test('executeTool returns error on client failure', async () => {
    ;(client.callTool as any).mockRejectedValue(new Error('connection lost'))
    const result = await protocol.executeTool('srv1', 'echo', {})
    expect(result.success).toBe(false)
    expect(result.error).toBe('connection lost')
  })
})
