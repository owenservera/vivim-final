// devops/llm-testing/adapters/index.ts
// Barrel exports for surface adapters.

export type { SurfaceAdapter } from './surface-adapter.js'
export { CliAdapter } from './cli-adapter.js'
export { ApiAdapter } from './api-adapter.js'
export { UiAdapter, type PlaywrightBridge } from './ui-adapter.js'
export { McpAdapter } from './mcp-adapter.js'
export { WorkflowAdapter } from './workflow-adapter.js'
export { ProviderAdapter, type ChromeToolBridge } from './provider-adapter.js'
