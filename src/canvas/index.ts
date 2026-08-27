// src/canvas/index.ts
// vivim-canvas — public barrel.
//
// The shell is pure HTML (P2); everything below is re-programmable by
// design (P1). Future-proof and plugin-ready: every surface is a contract.

export type {
  CanvasDefinitionInput,
  CanvasDefinitionRow,
  CanvasInstanceInput,
  CanvasInstanceRow,
  CanvasStore,
} from '../storage/contracts/canvas-store.js'
export {
  definitionToRow,
  rowToDefinition,
} from '../storage/contracts/canvas-store.js'
export * from './canvas-agent-tools.js'
export * from './canvas-engine.js'
export * from './canvas-mirror.js'
export * from './canvas-registry.js'
export * from './capability-bridge.js'
export * from './designer.js'
export { InMemoryCanvasStore } from './in-memory-store.js'
export * from './layer-mounter.js'
export * from './oracle-reader.js'
export * from './primitives.js'
export * from './schema.js'
export * from './types.js'
