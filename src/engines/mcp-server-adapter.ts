// src/engines/mcp-server-adapter.ts
// McpServerAdapter — expose Governor + capabilities as MCP tools via WebSocket

import { catchDebug } from '../lib/catch-logger.js'
import type { ChromeGovernor } from './chrome-governor.js'
import type { UnifiedCapabilityRegistry } from './unified-registry.js'

// ── Types ───────────────────────────────────────────────────────────────

export interface McpToolDefinition {
  name: string
  description: string
  inputSchema: Record<string, unknown>
}

export interface McpToolCallResult {
  content: unknown
  isError?: boolean
}

export interface McpServerConfig {
  port: number
  hostname?: string
}

// ── Engine ──────────────────────────────────────────────────────────────

export class McpServerAdapter {
  private tools: McpToolDefinition[] = []
  private running = false
  private server?: ReturnType<typeof Bun.serve>

  constructor(
    private readonly governor: ChromeGovernor,
    private readonly registry?: UnifiedCapabilityRegistry,
  ) {
    this.registerTools()
  }

  private registerTools(): void {
    // Base Chrome tools
    this.tools = [
      {
        name: 'chrome_launch',
        description: 'Launch a Chrome browser instance',
        inputSchema: {
          type: 'object',
          properties: {
            providerId: { type: 'string', description: 'Provider ID' },
          },
        },
      },
      {
        name: 'chrome_navigate',
        description: 'Navigate to a URL',
        inputSchema: {
          type: 'object',
          properties: {
            slaveId: { type: 'string', description: 'Browser slave ID' },
            url: { type: 'string', description: 'URL to navigate to' },
          },
          required: ['slaveId', 'url'],
        },
      },
      {
        name: 'chrome_click',
        description: 'Click an element on the page',
        inputSchema: {
          type: 'object',
          properties: {
            slaveId: { type: 'string', description: 'Browser slave ID' },
            selector: { type: 'string', description: 'CSS selector' },
          },
          required: ['slaveId', 'selector'],
        },
      },
      {
        name: 'chrome_send_keys',
        description: 'Type text into an input element',
        inputSchema: {
          type: 'object',
          properties: {
            slaveId: { type: 'string', description: 'Browser slave ID' },
            selector: { type: 'string', description: 'CSS selector' },
            text: { type: 'string', description: 'Text to type' },
          },
          required: ['slaveId', 'selector', 'text'],
        },
      },
      {
        name: 'chrome_screenshot',
        description: 'Take a screenshot of the current page',
        inputSchema: {
          type: 'object',
          properties: {
            slaveId: { type: 'string', description: 'Browser slave ID' },
          },
          required: ['slaveId'],
        },
      },
      {
        name: 'chrome_get_state',
        description: 'Get the current page state',
        inputSchema: {
          type: 'object',
          properties: {
            slaveId: { type: 'string', description: 'Browser slave ID' },
          },
          required: ['slaveId'],
        },
      },
      {
        name: 'provider_list',
        description: 'List all registered providers',
        inputSchema: { type: 'object', properties: {} },
      },
      {
        name: 'provider_get_capabilities',
        description: 'Get capabilities for a provider',
        inputSchema: {
          type: 'object',
          properties: {
            providerId: { type: 'string', description: 'Provider ID' },
          },
          required: ['providerId'],
        },
      },
      {
        name: 'conversation_send',
        description: 'Send a message to a conversation',
        inputSchema: {
          type: 'object',
          properties: {
            conversationId: { type: 'string', description: 'Conversation ID' },
            message: { type: 'string', description: 'Message content' },
          },
          required: ['conversationId', 'message'],
        },
      },
    ]

    // Add tools from UnifiedCapabilityRegistry (18.10)
    if (this.registry) {
      const mcpTools = this.registry.exportForMcp()
      for (const tool of mcpTools) {
        this.tools.push({
          name: tool.name,
          description: tool.description,
          inputSchema: tool.inputSchema,
        })
      }
    }
  }

  async start(config: McpServerConfig): Promise<void> {
    if (this.running) return
    this.running = true

    this.server = Bun.serve({
      port: config.port,
      hostname: config.hostname ?? '0.0.0.0',
      fetch: async (req, server) => {
        if (req.headers.get('upgrade') === 'websocket') {
          const success = server.upgrade(req, { data: {} })
          return success ? undefined : new Response('WebSocket upgrade failed', { status: 500 })
        }

        const url = new URL(req.url)

        if (url.pathname === '/tools' && req.method === 'GET') {
          return Response.json({ tools: this.tools })
        }

        if (url.pathname === '/tools/call' && req.method === 'POST') {
          try {
            const body = (await req.json()) as { name: string; input: Record<string, unknown> }
            const result = await this.callTool(body.name, body.input)
            return Response.json(result)
          } catch (err) {
            return Response.json(
              { error: err instanceof Error ? err.message : String(err) },
              { status: 400 },
            )
          }
        }

        return new Response('MCP Server', { status: 200 })
      },
      websocket: {
        message: async (ws, message) => {
          try {
            const msg = JSON.parse(typeof message === 'string' ? message : message.toString())
            if (msg.method === 'tools/list') {
              ws.send(
                JSON.stringify({
                  jsonrpc: '2.0',
                  id: msg.id,
                  result: { tools: this.tools },
                }),
              )
            } else if (msg.method === 'tools/call') {
              const { name, arguments: args } = msg.params ?? {}
              const result = await this.callTool(name, args ?? {})
              ws.send(
                JSON.stringify({
                  jsonrpc: '2.0',
                  id: msg.id,
                  result,
                }),
              )
            }
          } catch (err) {
            catchDebug(err, 'engines:mcp-server-adapter:211')
            // Ignore malformed messages
          }
        },
      },
    })
  }

  async stop(): Promise<void> {
    if (this.server) {
      this.server.stop()
      this.server = undefined
    }
    this.running = false
  }

  isRunning(): boolean {
    return this.running
  }

  getTools(): McpToolDefinition[] {
    return [...this.tools]
  }

  async callTool(toolName: string, input: Record<string, unknown>): Promise<McpToolCallResult> {
    // Route to UnifiedCapabilityRegistry if available (18.10)
    if (this.registry) {
      const cap = this.registry.list({ surface: 'mcp' }).find((c) => c.mcpToolName === toolName)
      if (cap) {
        try {
          const result = await this.registry.execute(cap.id, input, { metadata: {} })
          return { content: result }
        } catch (err) {
          return {
            content: { error: err instanceof Error ? err.message : String(err) },
            isError: true,
          }
        }
      }
    }

    // Fallback to built-in Chrome tools
    switch (toolName) {
      case 'chrome_launch': {
        const result = await this.governor.launch(input.providerId as string)
        return { content: result }
      }

      case 'chrome_navigate': {
        await this.governor.cdp.send(input.slaveId as string, 'Page.navigate', {
          url: input.url as string,
        })
        return { content: { success: true } }
      }

      case 'chrome_click': {
        await this.governor.cdp.send(input.slaveId as string, 'Runtime.evaluate', {
          expression: `document.querySelector('${input.selector as string}')?.click()`,
        })
        return { content: { success: true } }
      }

      case 'chrome_send_keys': {
        await this.governor.cdp.send(input.slaveId as string, 'Runtime.evaluate', {
          expression: `document.querySelector('${input.selector as string}').value = '${input.text as string}'`,
        })
        return { content: { success: true } }
      }

      case 'chrome_screenshot': {
        const data = await this.governor.cdp.send(
          input.slaveId as string,
          'Page.captureScreenshot',
          { format: 'png' },
        )
        return { content: data }
      }

      case 'chrome_get_state': {
        const state = await this.governor.cdp.getPageState(input.slaveId as string)
        return { content: state }
      }

      case 'provider_list': {
        return { content: [] }
      }

      case 'provider_get_capabilities': {
        return { content: [] }
      }

      case 'conversation_send': {
        return { content: { acknowledged: true } }
      }

      default:
        return {
          content: { error: `Unknown tool: ${toolName}` },
          isError: true,
        }
    }
  }
}
