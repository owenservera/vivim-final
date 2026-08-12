// devops/llm-testing/adapters/mcp-adapter.ts
// MCP WebSocket adapter — connects to MCP server, discovers tools, invokes them.

import { getLogger } from '../../../src/lib/logger.js'
import type { UnifiedCapabilityRegistry } from '../../../src/engines/unified-registry.js'
import type { TestCase, TestConfig, TestResult, TestSurface } from '../types.js'
import type { SurfaceAdapter } from './surface-adapter.js'

const log = getLogger('llm-testing:mcp')

interface McpTool {
  name: string
  description: string
  inputSchema: Record<string, unknown>
}

export class McpAdapter implements SurfaceAdapter {
  readonly name: TestSurface = 'mcp'
  private config!: TestConfig
  private ws: WebSocket | null = null
  private requestId = 0
  private pending = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }>()

  async init(config: TestConfig, _registry?: UnifiedCapabilityRegistry): Promise<void> {
    this.config = config
  }

  async discoverCapabilities(): Promise<TestCase[]> {
    try {
      await this.connect()
      const tools = await this.listTools()

      return tools.map((t, i) => ({
        id: `mcp-${t.name}`,
        surface: 'mcp' as TestSurface,
        capability: t.name,
        action: `Invoke MCP tool: ${t.name}`,
        expected: `Tool ${t.name} executes successfully`,
        input: { toolName: t.name, toolArgs: {} },
      }))
    } catch (err) {
      log.warn({ err }, 'MCP discovery failed, returning empty list')
      return []
    }
  }

  async execute(test: TestCase): Promise<TestResult> {
    const start = Date.now()
    const toolName = (test.input?.toolName as string) ?? test.capability
    const toolArgs = (test.input?.toolArgs as Record<string, unknown>) ?? {}

    try {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        await this.connect()
      }

      const result = await this.callTool(toolName, toolArgs)
      const durationMs = Date.now() - start

      return {
        id: test.id,
        surface: test.surface,
        capability: test.capability,
        action: test.action,
        expected: test.expected,
        actual: JSON.stringify(result).slice(0, 1000),
        status: 'pass',
        durationMs,
        timestamp: new Date().toISOString(),
      }
    } catch (err) {
      const durationMs = Date.now() - start
      const msg = err instanceof Error ? err.message : String(err)

      return {
        id: test.id,
        surface: test.surface,
        capability: test.capability,
        action: test.action,
        expected: test.expected,
        actual: msg,
        status: 'fail',
        durationMs,
        timestamp: new Date().toISOString(),
        error: msg,
        fix: `Check MCP server is running on port ${this.config.backendPort}`,
      }
    }
  }

  async cleanup(): Promise<void> {
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
    this.pending.clear()
  }

  private connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      // The MCP server runs on its own port (backendPort+1 by convention, or
      // MCP_PORT env). It is NOT mounted under the backend's /mcp path.
      const mcpPort = Number(process.env.MCP_PORT ?? 0) || this.config.backendPort + 1
      this.ws = new WebSocket(`ws://localhost:${mcpPort}/mcp`)

      const timer = setTimeout(() => {
        this.ws?.close()
        reject(new Error('MCP WebSocket connection timed out'))
      }, 5000)

      this.ws.onopen = () => {
        clearTimeout(timer)
        resolve()
      }

      this.ws.onerror = (ev) => {
        clearTimeout(timer)
        reject(new Error(`MCP WebSocket error: ${ev}`))
      }

      this.ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(String(ev.data)) as { id?: number; result?: unknown; error?: unknown }
          if (msg.id !== undefined && this.pending.has(msg.id)) {
            const p = this.pending.get(msg.id)!
            this.pending.delete(msg.id)
            if (msg.error) {
              p.reject(new Error(JSON.stringify(msg.error)))
            } else {
              // Server responds { result: { tools: [...] } } — unwrap to the array.
              const tools = (msg.result as { tools?: McpTool[] } | undefined)?.tools ?? []
              p.resolve(tools)
            }
          }
        } catch {
  // [audit] log the error with context here
          // ignore non-JSON messages
        }
      }
    })
  }

  private listTools(): Promise<McpTool[]> {
    return new Promise((resolve, reject) => {
      const id = ++this.requestId
      this.pending.set(id, { resolve: resolve as (v: unknown) => void, reject })
      this.ws?.send(JSON.stringify({ jsonrpc: '2.0', id, method: 'tools/list', params: {} }))
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id)
          reject(new Error('tools/list timed out'))
        }
      }, this.config.timeoutMs)
    })
  }

  private callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const id = ++this.requestId
      this.pending.set(id, { resolve, reject })
      this.ws?.send(
        JSON.stringify({
          jsonrpc: '2.0',
          id,
          method: 'tools/call',
          params: { name, arguments: args },
        }),
      )
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id)
          reject(new Error(`tools/call ${name} timed out`))
        }
      }, this.config.timeoutMs)
    })
  }
}
