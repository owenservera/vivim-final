// src/mcp/server.ts
// MCP Server scaffold — Phase 22.9

import { registerDiscoveryTools } from './discovery-tools.js'
import type { DiscoveryServerContext } from './types.js'

export class DiscoveryMcpServer {
  private tools: Map<
    string,
    {
      description: string
      handler: (
        args: Record<string, unknown>,
      ) => Promise<{ content: Array<{ type: 'text'; text: string }>; isError?: boolean }>
    }
  > = new Map()
  private ctx: DiscoveryServerContext

  constructor(ctx: DiscoveryServerContext) {
    this.ctx = ctx
    registerDiscoveryTools(this, ctx)
  }

  tool(
    name: string,
    description: string,
    _schema: Record<string, unknown>,
    handler: (
      args: Record<string, unknown>,
    ) => Promise<{ content: Array<{ type: 'text'; text: string }>; isError?: boolean }>,
  ): void {
    this.tools.set(name, { description, handler })
  }

  async callTool(
    name: string,
    args: Record<string, unknown>,
  ): Promise<{ content: Array<{ type: 'text'; text: string }>; isError?: boolean }> {
    const tool = this.tools.get(name)
    if (!tool) {
      return { content: [{ type: 'text', text: `Unknown tool: ${name}` }], isError: true }
    }
    return tool.handler(args)
  }

  listTools(): Array<{ name: string; description: string }> {
    return [...this.tools.entries()].map(([name, { description }]) => ({ name, description }))
  }

  async connect(): Promise<void> {
    // Stdio transport would be connected here in production
  }

  async close(): Promise<void> {
    this.tools.clear()
  }
}

export async function createDiscoveryMcpServer(
  ctx: DiscoveryServerContext,
): Promise<DiscoveryMcpServer> {
  const server = new DiscoveryMcpServer(ctx)
  await server.connect()
  return server
}
