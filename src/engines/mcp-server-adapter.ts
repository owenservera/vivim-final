// src/engines/mcp-server-adapter.ts
// McpServerAdapter — expose Governor + capabilities as MCP tools

import type { ChromeGovernor } from './chrome-governor.js'

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

  constructor(private readonly governor: ChromeGovernor) {
    this.registerTools()
  }

  private registerTools(): void {
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
  }

  async start(port: number): Promise<void> {
    this.running = true
    // MCP server would bind here in production
    void port
  }

  async stop(): Promise<void> {
    this.running = false
  }

  getTools(): McpToolDefinition[] {
    return [...this.tools]
  }

  async callTool(toolName: string, input: Record<string, unknown>): Promise<McpToolCallResult> {
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
