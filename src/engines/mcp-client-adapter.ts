// src/engines/mcp-client-adapter.ts
// McpClientAdapter — consume external MCP servers as capability providers

import { EngineError } from '../errors.js'

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
  private urls = new Map<string, string>()

  async connect(serverId: string, url: string): Promise<void> {
    const existing = this.connections.get(serverId)
    if (existing?.status === 'connected') return

    this.urls.set(serverId, url)

    try {
      const res = await fetch(`${url}/tools`, { method: 'GET' })
      if (!res.ok) {
        this.connections.set(serverId, {
          id: serverId,
          url,
          status: 'error',
          tools: [],
        })
        return
      }

      const body = (await res.json()) as { tools: ToolDefinition[] }
      this.connections.set(serverId, {
        id: serverId,
        url,
        status: 'connected',
        tools: body.tools ?? [],
      })
    } catch {
      this.connections.set(serverId, {
        id: serverId,
        url,
        status: 'error',
        tools: [],
      })
    }
  }

  async disconnect(serverId: string): Promise<void> {
    this.connections.delete(serverId)
    this.urls.delete(serverId)
  }

  async listTools(serverId: string): Promise<ToolDefinition[]> {
    const conn = this.connections.get(serverId)
    if (!conn || conn.status !== 'connected') {
      throw new EngineError(`Server not connected: ${serverId}`)
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
      throw new EngineError(`Server not connected: ${serverId}`)
    }

    const tool = conn.tools.find((t) => t.name === toolName)
    if (!tool) {
      throw new EngineError(`Tool not found: ${toolName} on server ${serverId}`)
    }

    const url = this.urls.get(serverId)
    if (!url) {
      throw new EngineError(`No URL for server: ${serverId}`)
    }

    try {
      const res = await fetch(`${url}/tools/call`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: toolName, input }),
      })
      if (!res.ok) {
        return { content: { error: `HTTP ${res.status}` }, isError: true }
      }
      return (await res.json()) as ToolResult
    } catch (err) {
      return {
        content: { error: err instanceof Error ? err.message : String(err) },
        isError: true,
      }
    }
  }

  getConnections(): McpServerConnection[] {
    return Array.from(this.connections.values())
  }

  isConnected(serverId: string): boolean {
    return this.connections.get(serverId)?.status === 'connected'
  }
}
