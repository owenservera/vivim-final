// src/engines/tool-use-protocol.ts
// ToolUseProtocol — standardized tool-calling interface, MCP-compatible

import type { McpClientAdapter } from './mcp-client-adapter.js'

export interface ToolDefinition {
  name: string
  description: string
  inputSchema: Record<string, unknown>
  outputSchema: Record<string, unknown>
}

export interface ToolResult {
  success: boolean
  output?: unknown
  error?: string
}

export interface ToolUseProtocol {
  listTools(slaveId: string): Promise<ToolDefinition[]>
  executeTool(
    slaveId: string,
    toolName: string,
    input: Record<string, unknown>,
  ): Promise<ToolResult>
}

// ── Implementation ──────────────────────────────────────────────────────

export class ToolUseProtocolImpl implements ToolUseProtocol {
  constructor(private readonly client: McpClientAdapter) {}

  async listTools(serverId: string): Promise<ToolDefinition[]> {
    const tools = await this.client.listTools(serverId)
    return tools.map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema,
      outputSchema: {},
    }))
  }

  async executeTool(
    serverId: string,
    toolName: string,
    input: Record<string, unknown>,
  ): Promise<ToolResult> {
    try {
      // C3: Route through tool orchestrator when available.
      const { callToolViaOrchestrator } = await import('./tool-orchestrator-facade.js')
      const result = (await callToolViaOrchestrator(this.client, serverId, toolName, input)) as {
        isError?: boolean
        content: unknown
      }
      return { success: !result.isError, output: result.content }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) }
    }
  }
}
