// src/framing/schemas.ts
// Phase 2 of ROADMAP-REPROGRAMMABLE-CANVAS.md — HarnessFraming core.
//
// The NormalizedRequest and NormalizedResponse envelopes. These are the
// SINGLE shapes that flow through:
//   - ConversationManager (the send/dispatch entry point)
//   - HarnessExecutorEngine (the recipe DAG executor)
//   - StreamParserEngine (the response decoder)
//   - NLCL executors (provider-llm-executor, etc.)
//   - ChromeGovernor (the CDP owner)
//
// Provider-specific shapes live ONLY inside FramingAdapter implementations.
// Anywhere else, you speak NormalizedRequest / NormalizedResponse.
//
// Design choice: `NormalizedBlock` REUSES the existing `ContentPart`
// union from src/schema/streaming.ts. The audit (`audit-harness-io-layer`)
// found 5 different response shapes coexisting. We promote ContentPart
// to be the canonical block type — it's already the richest and most
// used. This avoids introducing a 6th shape.
//
// FRAME_VERSION: 1

import { z } from 'zod'
import type { ContentPart } from '../schema/streaming.js'

// Re-export for framing consumers.
export type { ContentPart }

// ── NormalizedMessage ───────────────────────────────────────────────────────

export const NormalizedRoleSchema = z.enum(['system', 'user', 'assistant', 'tool'])
export type NormalizedRole = z.infer<typeof NormalizedRoleSchema>

/**
 * A message in a NormalizedRequest. Messages contain an array of
 * ContentParts (so a single message can have text + image + tool_call).
 */
export interface NormalizedMessage {
  role: NormalizedRole
  content: ContentPart[]
  /** Optional id for tool-call correlation. */
  id?: string
  /** Optional name for tool role messages. */
  name?: string
}

// ── NormalizedRequest ───────────────────────────────────────────────────────

export const NormalizedToolSchema = z.object({
  name: z.string().min(1),
  description: z.string().max(2000).optional(),
  inputSchema: z.record(z.string(), z.unknown()),
})
export type NormalizedTool = z.infer<typeof NormalizedToolSchema>

export const NormalizedAttachmentSchema = z.object({
  kind: z.enum(['image', 'audio', 'video', 'file']),
  mimeType: z.string(),
  /** URL or data URL. */
  url: z.string(),
  filename: z.string().optional(),
})
export type NormalizedAttachment = z.infer<typeof NormalizedAttachmentSchema>

export const FrameProvenanceSchema = z.object({
  source: z.enum(['composer', 'nlcl', 'llm-harness', 'workflow', 'plugin', 'system']),
  traceId: z.string().min(1),
  /** Optional parent request id (for chained calls). */
  parentRequestId: z.string().optional(),
})
export type FrameProvenance = z.infer<typeof FrameProvenanceSchema>

export const FramingMetadataSchema = z.object({
  /** Provider-specific target URL (API transport) or WebApp URL. */
  targetUrl: z.string().url().optional(),
  /** DOM selector for the composer input (WebApp transport). */
  composerSelector: z.string().optional(),
  /** DOM capture pattern (WebApp transport). */
  capturePattern: z.enum(['sse', 'ws', 'chunked-fetch', 'xhr-poll', 'dom-mutation']).optional(),
  /** Whether to stream the response. */
  stream: z.boolean().default(true),
  /** Optional model override (provider-specific). */
  model: z.string().optional(),
  /** Optional provider-specific options bag (NOT for business logic). */
  providerOptions: z.record(z.string(), z.unknown()).optional(),
})
export type FramingMetadata = z.infer<typeof FramingMetadataSchema>

export const NormalizedRequestInputSchema = z.object({
  systemPrompt: z.string().optional(),
  messages: z.array(
    z.object({
      role: NormalizedRoleSchema,
      content: z.array(z.unknown()), // ContentPart[] — typed loosely in Zod for forward-compat
      id: z.string().optional(),
      name: z.string().optional(),
    }),
  ),
  tools: z.array(NormalizedToolSchema).optional(),
  attachments: z.array(NormalizedAttachmentSchema).optional(),
  stopSequences: z.array(z.string()).optional(),
  maxTokens: z.number().int().positive().optional(),
  temperature: z.number().min(0).max(2).optional(),
})
export type NormalizedRequestInput = z.infer<typeof NormalizedRequestInputSchema>

export const NormalizedRequestSchema = z.object({
  frameVersion: z.literal(1),
  requestId: z.string().min(1),
  conversationId: z.string().min(1),
  providerId: z.string().min(1),
  transport: z.enum(['webapp', 'api', 'local']),

  input: NormalizedRequestInputSchema,
  framing: FramingMetadataSchema,
  provenance: FrameProvenanceSchema,
})
export type NormalizedRequest = z.infer<typeof NormalizedRequestSchema>

// ── NormalizedResponse ──────────────────────────────────────────────────────

export const NormalizedBlockBaseSchema = z.object({
  /** Stream index (0-based) for ordering. */
  streamIndex: z.number().int().min(0).optional(),
  /** Whether this is the final block in the stream. */
  isFinal: z.boolean().optional(),
})

export const ProviderMetadataSchema = z.object({
  model: z.string().optional(),
  usage: z
    .object({
      inputTokens: z.number().int().nonnegative().optional(),
      outputTokens: z.number().int().nonnegative().optional(),
      costUsd: z.number().nonnegative().optional(),
    })
    .optional(),
  finishReason: z.enum(['stop', 'length', 'tool_call', 'error', 'filtered']).optional(),
  rawResponseSize: z.number().int().nonnegative().optional(),
  /** Provider-specific metadata bag (debugging only, NOT for business logic). */
  raw: z.record(z.string(), z.unknown()).optional(),
})
export type ProviderMetadata = z.infer<typeof ProviderMetadataSchema>

export const FrameErrorSchema = z.object({
  kind: z.enum([
    'transport',
    'protocol',
    'auth',
    'rate_limit',
    'content_filter',
    'timeout',
    'unknown',
  ]),
  message: z.string(),
  retryable: z.boolean().default(false),
  /** Optional provider-specific error code. */
  providerCode: z.string().optional(),
})
export type FrameError = z.infer<typeof FrameErrorSchema>

export const NormalizedResponseSchema = z.object({
  frameVersion: z.literal(1),
  requestId: z.string().min(1),
  providerId: z.string().min(1),
  transport: z.enum(['webapp', 'api', 'local']),

  /** The streamed or final blocks. Each block is a ContentPart. */
  blocks: z.array(z.unknown()), // ContentPart[] — typed loosely in Zod

  providerMetadata: ProviderMetadataSchema.optional(),
  error: FrameErrorSchema.optional(),
})
export type NormalizedResponse = z.infer<typeof NormalizedResponseSchema>

// ── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Build an empty NormalizedResponse (for adapters that produce no blocks).
 */
export function emptyResponse(req: NormalizedRequest): NormalizedResponse {
  return {
    frameVersion: 1,
    requestId: req.requestId,
    providerId: req.providerId,
    transport: req.transport,
    blocks: [],
  }
}

/**
 * Build an error NormalizedResponse.
 */
export function errorResponse(
  req: NormalizedRequest,
  error: FrameError,
  providerMetadata?: ProviderMetadata,
): NormalizedResponse {
  return {
    frameVersion: 1,
    requestId: req.requestId,
    providerId: req.providerId,
    transport: req.transport,
    blocks: [],
    error,
    providerMetadata,
  }
}
