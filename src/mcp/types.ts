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
