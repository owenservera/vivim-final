/**
 * VIVIM AI Gateway — OpenAI-Compatible Module Barrel
 * @module ai/protocol/openai-compatible
 */

export { OpenAICompatibleAdapter } from './adapter.js'
export {
  type OpenAICompatibleManifest,
  type ModelManifestEntry,
  type AuthMethod,
  validateManifest,
  loadManifestFromFile,
  modelEntryToCapabilityMap,
} from './manifest.js'
export { resolveAuthHeaders } from './auth.js'
export { buildChatCompletionRequest } from './request-builder.js'
export { parseSSEStream } from './stream-parser.js'
export { mapOpenAIError, assertOkResponse } from './error-mapper.js'
