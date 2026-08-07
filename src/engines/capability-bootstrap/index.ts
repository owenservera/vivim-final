// src/engines/capability-bootstrap/index.ts
// Barrel export for the capability-bootstrap subsystem.
// Session 7 (2026-08-07): Created as part of the capability-bootstrap.ts split.

export { makeCapability, type BootstrapServices, ALL_SURFACES } from './types.js'
export { registerDefaultCapabilities } from './default.js'
export { seedLocalAgentProvider } from './seed.js'
export { registerNlInterpretCapability } from './nl-interpret.js'
export { registerKernelCapabilities } from './kernel.js'
export { registerDiscoveryCapabilities } from './discovery.js'
