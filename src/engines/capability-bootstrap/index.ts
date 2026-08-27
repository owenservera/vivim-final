// src/engines/capability-bootstrap/index.ts
// Barrel export for the capability-bootstrap subsystem.
// Session 7 (2026-08-07): Created as part of the capability-bootstrap.ts split.

export { registerDefaultCapabilities } from './default.js'
export { registerDiscoveryCapabilities } from './discovery.js'
export { registerKernelCapabilities } from './kernel.js'
export { registerNlInterpretCapability } from './nl-interpret.js'
export { seedLocalAgentProvider } from './seed.js'
export { ALL_SURFACES, type BootstrapServices, makeCapability } from './types.js'
