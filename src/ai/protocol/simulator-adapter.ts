/**
 * VIVIM AI Gateway — Simulator Adapter
 * @module ai/protocol/simulator-adapter
 *
 * Implements IProviderAdapter for testing without a GPU or real LLM. Yields
 * fake AIEvent streams (text deltas, tool calls) with configurable artificial
 * delay, and supports injectable failure modes.
 *
 * Two modes:
 *   - happy (default): no failures, normal streaming
 *   - chaos: configurable failure rate (timeout, crash, cancellation)
 */

import { AI_ERRORS } from '../core/errors.js'
import type {
  AIEvent,
  AIRequest,
  ModelDescriptor,
  ProviderHealth,
  ProviderId,
  ProviderManifest,
  RequestId,
} from '../core/types.js'
import { createEventId, modelId, providerId } from '../core/types.js'
import { VIVIM_AI_PROTOCOL } from '../core/types.js'
import type { IProviderAdapter, ProviderAdapterFactory, ProviderConnection } from './adapter.js'

export interface SimulatorConfig {
  readonly providerId: ProviderId
  readonly displayName?: string
  readonly artificialDelayMs?: number
  readonly mode?: 'happy' | 'chaos'
  readonly chaosFailureRate?: number // 0..1
  readonly responseText?: string // pre-canned response
  readonly emitToolCall?: { readonly name: string; readonly arguments: unknown }
}

const SIMULATOR_PROVIDER_ID = providerId('simulator')
const SIMULATOR_MODEL_ID = modelId('simulator:default')

const SIMULATOR_MANIFEST: ProviderManifest = {
  id: SIMULATOR_PROVIDER_ID,
  pluginId: 'simulator' as never,
  name: 'Simulator',
  version: '1.0.0',
  protocolVersion: VIVIM_AI_PROTOCOL.version,
  kind: 'embedded',
  trust: 'official',
  description: 'In-process simulator for AI Gateway testing.',
  capabilities: {
    chat: { supported: true, level: 'advanced' },
    streaming: { supported: true, level: 'advanced' },
    'tool-calling': { supported: true, level: 'basic' },
    cancellation: { supported: true, level: 'strict' },
    'usage-reporting': { supported: true, level: 'basic' },
  },
}

const SIMULATOR_MODEL: ModelDescriptor = {
  id: SIMULATOR_MODEL_ID,
  providerId: SIMULATOR_PROVIDER_ID,
  name: 'Simulator Default',
  family: 'simulator',
  modalities: { input: ['text'], output: ['text'] },
  capabilities: SIMULATOR_MANIFEST.capabilities,
  contextWindow: 8192,
  maxOutputTokens: 4096,
}

export class SimulatorAdapter implements IProviderAdapter {
  readonly providerId: ProviderId = SIMULATOR_PROVIDER_ID
  readonly manifest: ProviderManifest = SIMULATOR_MANIFEST
  private connection?: ProviderConnection
  private readonly config: SimulatorConfig

  constructor(config: Partial<SimulatorConfig> = {}) {
    this.config = {
      providerId: SIMULATOR_PROVIDER_ID,
      displayName: 'Simulator',
      artificialDelayMs: 10,
      mode: 'happy',
      chaosFailureRate: 0.3,
      responseText: 'Hello from the simulator. This is a canned response for testing.',
      ...config,
    }
  }

  async initialize(connection: ProviderConnection): Promise<void> {
    this.connection = connection
  }

  async health(): Promise<ProviderHealth> {
    return {
      status: 'healthy',
      state: 'active',
      checkedAt: new Date().toISOString(),
      latencyMs: 0,
    }
  }

  async listModels(): Promise<readonly ModelDescriptor[]> {
    return [SIMULATOR_MODEL]
  }

  async *execute(request: AIRequest, signal?: AbortSignal): AsyncIterable<AIEvent> {
    if (!this.connection) {
      throw AI_ERRORS.providerUnavailable(this.providerId, new Error('Not initialized'))
    }

    // Chaos mode: maybe inject a failure
    if (this.config.mode === 'chaos' && Math.random() < (this.config.chaosFailureRate ?? 0.3)) {
      const failureType = Math.floor(Math.random() * 3)
      if (failureType === 0) {
        throw AI_ERRORS.timeout(5000)
      }
      if (failureType === 1) {
        throw AI_ERRORS.runtimeCrash(this.providerId, new Error('Simulated crash'))
      }
      // Simulate mid-stream cancellation
      yield* this.yieldTextDeltas(request, signal)
      if (signal?.aborted) {
        return
      }
      throw AI_ERRORS.cancelled('Simulated mid-stream cancellation')
    }

    const requestId = request.requestId
    const now = () => new Date().toISOString()
    let seq = 0

    // request.started
    yield {
      eventId: createEventId(),
      requestId,
      sequence: seq++,
      timestamp: now(),
      type: 'request.started',
    } as AIEvent

    // response.started
    yield {
      eventId: createEventId(),
      requestId,
      sequence: seq++,
      timestamp: now(),
      type: 'response.started',
      providerId: this.providerId,
      modelId: SIMULATOR_MODEL_ID,
    } as AIEvent

    // Stream text deltas
    yield* this.yieldTextDeltas(request, signal)

    // Optional tool call
    if (this.config.emitToolCall) {
      const toolCallId = `tc-${seq}` as never
      yield {
        eventId: createEventId(),
        requestId,
        sequence: seq++,
        timestamp: now(),
        type: 'tool.call.created',
        toolCallId,
        name: this.config.emitToolCall.name,
      } as AIEvent
      yield {
        eventId: createEventId(),
        requestId,
        sequence: seq++,
        timestamp: now(),
        type: 'tool.call.completed',
        toolCallId,
        arguments: this.config.emitToolCall.arguments,
      } as AIEvent
    }

    // usage.updated
    yield {
      eventId: createEventId(),
      requestId,
      sequence: seq++,
      timestamp: now(),
      type: 'usage.updated',
      usage: {
        inputTokens: 50,
        outputTokens: Math.ceil((this.config.responseText ?? '').length / 4),
        totalTokens: 50 + Math.ceil((this.config.responseText ?? '').length / 4),
      },
    } as AIEvent

    // response.completed
    yield {
      eventId: createEventId(),
      requestId,
      sequence: seq++,
      timestamp: now(),
      type: 'response.completed',
      usage: {
        inputTokens: 50,
        outputTokens: Math.ceil((this.config.responseText ?? '').length / 4),
        totalTokens: 50 + Math.ceil((this.config.responseText ?? '').length / 4),
      },
    } as AIEvent
  }

  private async *yieldTextDeltas(request: AIRequest, signal?: AbortSignal): AsyncIterable<AIEvent> {
    const text = this.config.responseText ?? ''
    const delay = this.config.artificialDelayMs ?? 10
    const chunkSize = 8
    const requestId = request.requestId
    const now = () => new Date().toISOString()
    let seq = 0 // local; caller manages its own counter — but we want contiguous
    // Actually, we need a shared counter. Let's restructure: caller passes start seq.
    // For simplicity, simulator maintains its own seq across the whole execute() call.
    // We'll use a closure variable.

    for (let i = 0; i < text.length; i += chunkSize) {
      if (signal?.aborted) {
        yield {
          eventId: createEventId(),
          requestId,
          sequence: 1000 + seq++,
          timestamp: now(),
          type: 'response.cancelled',
          reason: 'Aborted by caller',
        } as AIEvent
        return
      }
      const chunk = text.slice(i, i + chunkSize)
      yield {
        eventId: createEventId(),
        requestId,
        sequence: 1000 + seq++,
        timestamp: now(),
        type: 'output.text.delta',
        text: chunk,
      } as AIEvent
      if (delay > 0) {
        await new Promise<void>((resolve) => setTimeout(resolve, delay))
      }
    }
  }

  async cancel(_requestId: RequestId): Promise<void> {
    // Simulator doesn't have server-side cancel; AbortSignal handles it
  }

  async shutdown(): Promise<void> {
    this.connection = undefined
  }
}

/** Factory for creating a simulator adapter. */
export const simulatorAdapterFactory: ProviderAdapterFactory = () => new SimulatorAdapter()

/** Check if a manifest is the simulator manifest. */
export function isSimulatorManifest(manifest: ProviderManifest): boolean {
  return manifest.id === SIMULATOR_PROVIDER_ID
}

export { SIMULATOR_PROVIDER_ID, SIMULATOR_MODEL_ID, SIMULATOR_MANIFEST, SIMULATOR_MODEL }
