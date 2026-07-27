// src/framing/adapter.ts
// Phase 2 of ROADMAP-REPROGRAMMABLE-CANVAS.md — HarnessFraming core.
//
// The FramingAdapter contract. Each AI WebApp provider implements this
// to convert between the normalized envelope and its native shape.
//
// FRAME_VERSION: 1

import type { NormalizedRequest, NormalizedResponse } from './schemas.js'
import type { FrameTransport } from './frame-version.js'
import type { ContentPart } from '../schema/streaming.js'

/**
 * A framed request — the per-transport native representation.
 *
 * - `webapp` transport: `recipeSteps` (the CDP recipe DAG)
 * - `api` transport: `apiUrl` + `apiHeaders` + `apiBody`
 * - `local` transport: `localModelArgs`
 *
 * An adapter may produce MORE than one (e.g. WebApp with API fallback)
 * by setting multiple fields. The HarnessExecutorEngine picks the right
 * one based on the transport declared in the request.
 */
export interface FramedRequest {
  /** WebApp transport — the recipe DAG steps. */
  recipeSteps?: unknown[]
  /** API transport — the fetch URL. */
  apiUrl?: string
  /** API transport — the fetch headers. */
  apiHeaders?: Record<string, string>
  /** API transport — the fetch body (will be JSON-stringified). */
  apiBody?: unknown
  /** Local transport — the local model invocation args. */
  localModelArgs?: unknown
  /** Optional: a different transport than the request declared (fallback). */
  effectiveTransport?: FrameTransport
}

/**
 * Context passed to `parseResponse` for each chunk.
 */
export interface ParseContext {
  requestId: string
  providerId: string
  /** The index of this chunk in the stream (0-based). */
  chunkIndex: number
  /** Accumulated state across chunks (adapter-specific). */
  state?: Record<string, unknown>
}

/**
 * Result of an adapter health check.
 */
export interface HealthCheckResult {
  providerId: string
  healthy: boolean
  /** What was checked. */
  checks: Array<{
    name: string
    passed: boolean
    detail?: string
  }>
  /** When the check ran. */
  checkedAt: number
}

/**
 * The contract every AI WebApp provider adapter implements.
 *
 * Implementations live in `src/framing/adapters/<provider>.ts`.
 *
 * Adapters MUST:
 *   - Be stateless between requests (any state goes in `ParseContext.state`).
 *   - Never throw — return error responses via `errorResponse()`.
 *   - Validate their own config in `healthCheck()`.
 *   - Emit `isFinal: true` on the last block of a stream.
 */
export interface FramingAdapter {
  /** The provider id this adapter handles (e.g. 'chatgpt', 'claude'). */
  readonly providerId: string
  /** The transport this adapter uses. */
  readonly transport: FrameTransport

  /**
   * Convert a NormalizedRequest into the native shape this provider expects.
   *
   * Implementations should:
   *   - Look up provider config (URL, selectors, etc.) from ProviderRegistry.
   *   - Build the recipe DAG (WebApp) or fetch body (API) or model args (local).
   *   - NEVER make network calls — `frameRequest` is pure.
   */
  frameRequest(req: NormalizedRequest): Promise<FramedRequest>

  /**
   * Parse a native response chunk into NormalizedBlocks.
   *
   * This is an async generator so adapters can:
   *   - Stream blocks as they're parsed (low latency).
   *   - Maintain state across chunks via `ctx.state`.
   *   - Yield multiple blocks per chunk (e.g. text + tool_call).
   *
   * Implementations should:
   *   - NEVER throw — yield an `error` block on parse failure.
   *   - Yield `{ type: 'error', message }` (a ContentPart) on failure.
   *   - Set `isFinal: true` on the last block when the stream ends.
   */
  parseResponse(
    chunk: unknown,
    ctx: ParseContext,
  ): AsyncGenerator<ContentPart, void, unknown>

  /**
   * Validate that the adapter is correctly configured.
   *
   * Called:
   *   - At boot (registration time).
   *   - Periodically by the mux (every 60s).
   *   - On-demand via `GET /api/framing/health`.
   *
   * Adapters that fail health check are auto-degraded by the mux.
   */
  healthCheck(): Promise<HealthCheckResult>
}

/**
 * Error thrown when an adapter is not registered for a provider.
 */
export class AdapterNotRegisteredError extends Error {
  readonly providerId: string
  constructor(providerId: string) {
    super(`No FramingAdapter registered for provider: ${providerId}`)
    this.name = 'AdapterNotRegisteredError'
    this.providerId = providerId
  }
}

/**
 * Error thrown when an adapter fails to frame a request.
 */
export class FrameRequestError extends Error {
  readonly providerId: string
  readonly cause?: unknown
  constructor(providerId: string, message: string, cause?: unknown) {
    super(`FrameRequest failed for ${providerId}: ${message}`)
    this.name = 'FrameRequestError'
    this.providerId = providerId
    this.cause = cause
  }
}
