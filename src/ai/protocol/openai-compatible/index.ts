/**
 * VIVIM AI Gateway — OpenAI-Compatible Module Barrel
 * @module ai/protocol/openai-compatible
 */

export { OpenAICompatibleAdapter } from './adapter.js'
export { resolveAuthHeaders } from './auth.js'
export { assertOkResponse, mapOpenAIError } from './error-mapper.js'
export {
  type AuthMethod,
  loadManifestFromFile,
  type ModelManifestEntry,
  modelEntryToCapabilityMap,
  type OpenAICompatibleManifest,
  validateManifest,
} from './manifest.js'
export { buildChatCompletionRequest } from './request-builder.js'
export { parseSSEStream } from './stream-parser.js'
