// src/engines/tool-use-protocol.ts
// ToolUseProtocol — standardized tool-calling interface, MCP-compatible

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
