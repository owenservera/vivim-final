// src/framing/engine.ts
// Phase 2 of ROADMAP-REPROGRAMMABLE-CANVAS.md — HarnessFraming core.
//
// The HarnessFramingEngine is the singleton registry + dispatcher for
// FramingAdapters. It is the SINGLE entry point for "send a request to
// an AI WebApp" — all callers (ConversationManager, NLCL executors,
// the LLM harness agent, workflows) go through here.
//
// The engine:
//   1. Looks up the FramingAdapter for the request's providerId.
//   2. Calls `adapter.frameRequest(req)` to get the native shape.
//   3. (Transport execution is delegated to the existing
//       HarnessExecutorEngine / ApiProviderAdapter / LocalModelAdapter —
//       those become transport backends, not entry points.)
//   4. Feeds native response chunks to `adapter.parseResponse(chunk, ctx)`.
//   5. Aggregates blocks into a NormalizedResponse.
//
// In Phase 2, the engine is wired but the existing transport backends
// are not yet retrofitted to call it. Phase 3+ migrates them one by one.
//
// FRAME_VERSION: 1

import type { ContentPart } from '../schema/streaming.js'
import type { FramingAdapter, HealthCheckResult } from './adapter.js'
import { AdapterNotRegisteredError } from './adapter.js'
import type { NormalizedRequest, NormalizedResponse } from './schemas.js'
import { emptyResponse, errorResponse } from './schemas.js'

export interface FramingEngineListener {
  onAdapterRegistered?(adapter: FramingAdapter): void
  onAdapterUnregistered?(providerId: string): void
  onHealthDegraded?(providerId: string, result: HealthCheckResult): void
}

/**
 * The framing engine. Singleton instance exported at the bottom.
 */
export class HarnessFramingEngine {
  private readonly adapters = new Map<string, FramingAdapter>()
  private readonly listeners = new Set<FramingEngineListener>()
  private readonly healthCache = new Map<string, HealthCheckResult>()

  /** Register an adapter. Idempotent — re-registering replaces. */
  registerAdapter(adapter: FramingAdapter): void {
    this.adapters.set(adapter.providerId, adapter)
    for (const l of this.listeners) {
      l.onAdapterRegistered?.(adapter)
    }
  }

  /** Unregister an adapter by provider id. */
  unregisterAdapter(providerId: string): void {
    if (this.adapters.delete(providerId)) {
      this.healthCache.delete(providerId)
      for (const l of this.listeners) {
        l.onAdapterUnregistered?.(providerId)
      }
    }
  }

  /** Get the adapter for a provider, or throw. */
  getAdapter(providerId: string): FramingAdapter {
    const adapter = this.adapters.get(providerId)
    if (!adapter) throw new AdapterNotRegisteredError(providerId)
    return adapter
  }

  /** Check if an adapter is registered. */
  hasAdapter(providerId: string): boolean {
    return this.adapters.has(providerId)
  }

  /** List all registered adapters. */
  listAdapters(): FramingAdapter[] {
    return Array.from(this.adapters.values())
  }

  /** List provider ids. */
  listProviderIds(): string[] {
    return Array.from(this.adapters.keys())
  }

  /**
   * Frame a request — convert NormalizedRequest to native shape via the
   * adapter. Does NOT execute; the caller (transport backend) executes.
   *
   * This is the seam between "what the user wants" and "how the provider
   * expects it".
   */
  async frameRequest(req: NormalizedRequest): Promise<unknown> {
    const adapter = this.getAdapter(req.providerId)
    try {
      return await adapter.frameRequest(req)
    } catch (_err) {
      throw new AdapterNotRegisteredError(req.providerId)
    }
  }

  /**
   * Parse a native response chunk into NormalizedBlocks.
   *
   * The caller (transport backend) feeds each native chunk to this method
   * and accumulates the yielded blocks into a NormalizedResponse.
   *
   * This is the seam between "what the provider returns" and "what the
   * rest of the system understands".
   */
  async *parseResponseChunk(
    providerId: string,
    chunk: unknown,
    chunkIndex: number,
    state?: Record<string, unknown>,
  ): AsyncGenerator<ContentPart, void, unknown> {
    const adapter = this.getAdapter(providerId)
    yield* adapter.parseResponse(chunk, {
      requestId: state?.requestId as string,
      providerId,
      chunkIndex,
      state,
    })
  }

  /**
   * Aggregate a sequence of native chunks into a single NormalizedResponse.
   * Convenience wrapper around `parseResponseChunk`.
   */
  async aggregateResponse(
    req: NormalizedRequest,
    chunks: AsyncIterable<unknown> | Iterable<unknown>,
  ): Promise<NormalizedResponse> {
    const adapter = this.getAdapter(req.providerId)
    const blocks: ContentPart[] = []
    const state: Record<string, unknown> = { requestId: req.requestId }

    let chunkIndex = 0
    try {
      for await (const chunk of chunks) {
        for await (const block of adapter.parseResponse(chunk, {
          requestId: req.requestId,
          providerId: req.providerId,
          chunkIndex,
          state,
        })) {
          blocks.push(block)
        }
        chunkIndex++
      }
    } catch (err) {
      return errorResponse(req, {
        kind: 'protocol',
        message:
          err instanceof Error ? err.message : `Failed to parse response from ${req.providerId}`,
        retryable: false,
      })
    }

    const base = emptyResponse(req)
    return { ...base, blocks }
  }

  /**
   * Run a health check for a provider (or all providers if omitted).
   */
  async checkHealth(providerId?: string): Promise<HealthCheckResult[]> {
    const targets = providerId ? [this.getAdapter(providerId)] : this.listAdapters()
    const results: HealthCheckResult[] = []
    for (const adapter of targets) {
      try {
        const result = await adapter.healthCheck()
        this.healthCache.set(adapter.providerId, result)
        if (!result.healthy) {
          for (const l of this.listeners) {
            l.onHealthDegraded?.(adapter.providerId, result)
          }
        }
        results.push(result)
      } catch (err) {
        const result: HealthCheckResult = {
          providerId: adapter.providerId,
          healthy: false,
          checks: [
            {
              name: 'healthCheck()',
              passed: false,
              detail: err instanceof Error ? err.message : String(err),
            },
          ],
          checkedAt: Date.now(),
        }
        this.healthCache.set(adapter.providerId, result)
        results.push(result)
      }
    }
    return results
  }

  /** Get the cached health result for a provider. */
  getCachedHealth(providerId: string): HealthCheckResult | undefined {
    return this.healthCache.get(providerId)
  }

  /** Subscribe to engine events. Returns an unsubscribe function. */
  subscribe(listener: FramingEngineListener): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  /** Clear all adapters. Mainly for tests. */
  clear(): void {
    this.adapters.clear()
    this.healthCache.clear()
  }
}

/**
 * Singleton instance. The entire app imports this.
 */
export const framingEngine = new HarnessFramingEngine()
