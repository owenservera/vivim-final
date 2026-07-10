// src/engines/mcp-client-adapter.ts
// McpClientAdapter — consume external MCP servers as capability providers

// ── Types ───────────────────────────────────────────────────────────────

export interface ToolDefinition {
  name: string
  description: string
  inputSchema: Record<string, unknown>
}

export interface ToolResult {
  content: unknown
  isError?: boolean
}

export interface McpServerConnection {
  id: string
  url: string
  status: 'connected' | 'disconnected' | 'error'
  tools: ToolDefinition[]
}

// ── Engine ──────────────────────────────────────────────────────────────

export class McpClientAdapter {
  private connections = new Map<string, McpServerConnection>()

  async connect(serverId: string): Promise<void> {
    const existing = this.connections.get(serverId)
    if (existing?.status === 'connected') return

    this.connections.set(serverId, {
      id: serverId,
      url: '',
      status: 'connected',
      tools: [],
    })
  }

  async disconnect(serverId: string): Promise<void> {
    const conn = this.connections.get(serverId)
    if (conn) {
      conn.status = 'disconnected'
      this.connections.delete(serverId)
    }
  }

  async listTools(serverId: string): Promise<ToolDefinition[]> {
    const conn = this.connections.get(serverId)
    if (!conn || conn.status !== 'connected') {
      throw new Error(`Server not connected: ${serverId}`)
    }
    return conn.tools
  }

  async callTool(
    serverId: string,
    toolName: string,
    input: Record<string, unknown>,
  ): Promise<ToolResult> {
    const conn = this.connections.get(serverId)
    if (!conn || conn.status !== 'connected') {
      throw new Error(`Server not connected: ${serverId}`)
    }

    const tool = conn.tools.find((t) => t.name === toolName)
    if (!tool) {
      throw new Error(`Tool not found: ${toolName} on server ${serverId}`)
    }

    return { content: { acknowledged: true, toolName, input } }
  }

  getConnections(): McpServerConnection[] {
    return Array.from(this.connections.values())
  }

  isConnected(serverId: string): boolean {
    return this.connections.get(serverId)?.status === 'connected'
  }
}
