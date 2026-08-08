// src/mcp/types.ts
// Shared MCP types for discovery server

export interface DiscoveryServerContext {
  discoveryEngine: import('../engines/provider-discovery.js').ProviderDiscoveryEngine
  manifestInference: import('../engines/manifest-inference.js').ManifestInferenceEngine
  shapeRegistry: import('../engines/capability-shape-registry.js').CapabilityShapeRegistry
  providerRegistrar: import('../engines/provider-registrar.js').ProviderRegistrar
}

export interface McpToolResult {
  content: Array<{ type: 'text'; text: string }>
  isError?: boolean
}

// ── Browser MCP shared types ─────────────────────────────────────────────────

/** A tool exposed over MCP (maps 1:1 to a registry capability or a convenience tool). */
export interface McpTool {
  name: string
  description: string
  inputSchema: Record<string, unknown>
  /** Axis / trust metadata attached for introspection (also surfaced via browser_list_caps). */
  meta?: { axis?: string; trust?: Record<string, unknown>; id?: string }
  handler: (args: Record<string, unknown>) => Promise<McpToolResult>
}

// ── JSON-RPC 2.0 wire messages (MCP spec over stdio) ─────────────────────────

export interface JsonRpcRequest {
  jsonrpc: '2.0'
  id?: number | string | null
  method: string
  params?: unknown
}

export interface JsonRpcSuccess {
  jsonrpc: '2.0'
  id: number | string
  result: unknown
}

export interface JsonRpcError {
  jsonrpc: '2.0'
  id: number | string | null
  error: { code: number; message: string; data?: unknown }
}

export type JsonRpcResponse = JsonRpcSuccess | JsonRpcError
