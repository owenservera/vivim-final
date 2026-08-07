// src/engines/capability-bootstrap.ts
// Registers the default capabilities every vivim instance ships with.
// Called once from createServerWithEngines after the UnifiedCapabilityRegistry is built.
//
// Session 7 (2026-08-07): Split into 7 focused modules under
// src/engines/capability-bootstrap/. This file is now a thin re-export
// so existing `import { ... } from './capability-bootstrap.js'` continues
// to work without changes.

export {
  makeCapability,
  type BootstrapServices,
} from './capability-bootstrap/types.js'
export { registerDefaultCapabilities } from './capability-bootstrap/default.js'
export { seedLocalAgentProvider } from './capability-bootstrap/seed.js'
export { registerNlInterpretCapability } from './capability-bootstrap/nl-interpret.js'
export { registerKernelCapabilities } from './capability-bootstrap/kernel.js'
export { registerDiscoveryCapabilities } from './capability-bootstrap/discovery.js'
