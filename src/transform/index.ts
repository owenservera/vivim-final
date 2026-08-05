// src/transform/index.ts
// Data transformation layer — single entry point.
//
// Usage:
//   import { createTransformEngine, transformConversation } from '@/transform/index.js'
//   const engine = createTransformEngine()
//   const { data, warnings } = engine.transform('conversation', row)

export { TransformEngine } from './transform-engine.js'
export * from './types.js'
export * from './specs/index.js'

import {
  capabilityTransformSpec,
  conversationTransformSpec,
  messageTransformSpec,
  providerTransformSpec,
} from './specs/index.js'
import { TransformEngine } from './transform-engine.js'
import type { ApiVersion } from './types.js'

/**
 * Create a pre-configured TransformEngine with all built-in specs registered.
 *
 * @param version  The API version to use for field inclusion/exclusion.
 */
export function createTransformEngine(version?: ApiVersion): TransformEngine {
  const engine = new TransformEngine(version)

  // Register all entity specs.
  engine.register(conversationTransformSpec)
  engine.register(messageTransformSpec)
  engine.register(providerTransformSpec)
  engine.register(capabilityTransformSpec)

  return engine
}
