// src/framing/index.ts
// Phase 2 of ROADMAP-REPROGRAMMABLE-CANVAS.md — HarnessFraming core.
//
// Barrel export for the framing package.
//
// FRAME_VERSION: 1

export type {
  FramedRequest,
  FramingAdapter,
  HealthCheckResult,
  ParseContext,
} from './adapter.js'
export {
  AdapterNotRegisteredError,
  FrameRequestError,
} from './adapter.js'
export { NoopFramingAdapter } from './adapters/noop.js'
export { StubChatGptFramingAdapter } from './adapters/stub-chatgpt.js'
export type { FramingEngineListener } from './engine.js'
export { framingEngine, HarnessFramingEngine } from './engine.js'
export type { FrameTransport } from './frame-version.js'
export { FRAME_TRANSPORTS, FRAME_VERSION } from './frame-version.js'
export type {
  ContentPart,
  FrameError,
  FrameProvenance,
  FramingMetadata,
  NormalizedAttachment,
  NormalizedMessage,
  NormalizedRequest,
  NormalizedRequestInput,
  NormalizedResponse,
  NormalizedRole,
  NormalizedTool,
  ProviderMetadata,
} from './schemas.js'
export {
  emptyResponse,
  errorResponse,
  FrameErrorSchema,
  FrameProvenanceSchema,
  FramingMetadataSchema,
  NormalizedAttachmentSchema,
  NormalizedBlockBaseSchema,
  NormalizedRequestInputSchema,
  NormalizedRequestSchema,
  NormalizedResponseSchema,
  NormalizedRoleSchema,
  NormalizedToolSchema,
  ProviderMetadataSchema,
} from './schemas.js'
