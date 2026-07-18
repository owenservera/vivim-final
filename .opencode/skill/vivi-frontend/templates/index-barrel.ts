// templates/index-barrel.ts
// BARREL ADDITIONS — append these exports to web/ui/src/index.ts so the new
// surface, renderers, hook, and types are part of the public `@ui` surface.
// Idempotent: only add lines that are not already present.

// CapabilitySurface host (contract interpreter)
export { CapabilitySurface } from './features/capability-surface.js'
export type { CapabilitySurfaceProps } from './features/capability-surface.js'

// Generic contract-interpreter renderer
export { GenericCapabilityRenderer } from './components/generic-capability-renderer.js'
export type { ResolvedCapability } from './components/generic-capability-renderer.js'

// Result + confirm primitives
export { ResultRenderer } from './components/result-renderer.js'
export type { RenderResult } from './components/result-renderer.js'
export { ConfirmGate } from './components/confirm-gate.js'

// Resolved-capabilities hook
export { useResolvedCapabilities } from './sdk/use-resolved-capabilities.js'
export type { ResolvedSlots, UseResolvedCapabilities } from './sdk/use-resolved-capabilities.js'
