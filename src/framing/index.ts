// src/framing/index.ts
// Phase 2 of ROADMAP-REPROGRAMMABLE-CANVAS.md — HarnessFraming core.
//
// Barrel export for the framing package.
//
// FRAME_VERSION: 1

export { FRAME_VERSION, FRAME_TRANSPORTS } from './frame-version.js'
export type { FrameTransport } from './frame-version.js'

export {
  NormalizedRequestSchema,
  NormalizedResponseSchema,
  NormalizedRoleSchema,
  NormalizedToolSchema,
  NormalizedAttachmentSchema,
  FrameProvenanceSchema,
  FramingMetadataSchema,
  NormalizedRequestInputSchema,
  ProviderMetadataSchema,
  FrameErrorSchema,
  NormalizedBlockBaseSchema,
  emptyResponse,
  errorResponse,
} from './schemas.js'
export type {
  NormalizedRequest,
  NormalizedResponse,
  NormalizedMessage,
  NormalizedRole,
  NormalizedTool,
  NormalizedAttachment,
  FrameProvenance,
  FramingMetadata,
  NormalizedRequestInput,
  ProviderMetadata,
  FrameError,
  ContentPart,
} from './schemas.js'

export type {
  FramingAdapter,
  FramedRequest,
  ParseContext,
  HealthCheckResult,
} from './adapter.js'
export {
  AdapterNotRegisteredError,
  FrameRequestError,
} from './adapter.js'

export { HarnessFramingEngine, framingEngine } from './engine.js'
export type { FramingEngineListener } from './engine.js'

export { NoopFramingAdapter } from './adapters/noop.js'
export { StubChatGptFramingAdapter } from './adapters/stub-chatgpt.js'
