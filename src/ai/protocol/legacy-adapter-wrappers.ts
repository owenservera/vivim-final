// src/ai/protocol/legacy-adapter-wrappers.ts
// C1 convergence: wraps existing LocalModelAdapter and ApiProviderAdapter so they
// satisfy IProviderAdapter WITHOUT modifying them. This is the "interface-implementation"
// approach from CONVERGENCE-PLAN §4 C1 — the legacy classes keep working as-is,
// and the gateway can use them through the canonical contract.
//
// Per [AUDIT R-3]: IntentDecomposer takes `llm?` as a constructor dependency —
// there is no shared registry lookup. The gateway route and IntentDecomposer
// should be injected with the SAME adapter instance (constructor-injection identity).

import type { ApiProviderAdapter } from '../../engines/api-provider-adapter.js'
import type { LocalModelAdapter } from '../../engines/local-model-adapter.js'
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
import { VIVIM_AI_PROTOCOL, createEventId, modelId } from '../core/types.js'
import type { IProviderAdapter, ProviderConnection } from './adapter.js'

/**
 * Wraps an existing LocalModelAdapter (Ollama/llama.cpp HTTP) as an IProviderAdapter.
 * The LocalModelAdapter is NOT modified — this is a pure wrapper.
 */
export class LocalModelAdapterWrapper implements IProviderAdapter {
  private connection?: ProviderConnection
  private readonly cachedManifest: ProviderManifest

  constructor(
    private readonly inner: LocalModelAdapter,
    readonly providerId: ProviderId,
    displayName: string,
  ) {
    this.cachedManifest = {
      id: providerId,
      pluginId: `legacy:local:${providerId}` as never,
      name: displayName,
      version: '1.0.0',
      protocolVersion: VIVIM_AI_PROTOCOL.version,
      kind: 'local',
      trust: 'official',
      description: `Wrapped LocalModelAdapter for ${displayName}`,
      capabilities: {
        chat: { supported: true, level: 'basic' },
        streaming: { supported: true, level: 'basic' },
        'usage-reporting': { supported: true, level: 'basic' },
        cancellation: { supported: true, level: 'basic' },
      },
    }
  }

  get manifest(): ProviderManifest {
    return this.cachedManifest
  }

  async initialize(connection: ProviderConnection): Promise<void> {
    this.connection = connection
  }

  async health(): Promise<ProviderHealth> {
    if (!this.connection) {
      return { status: 'unknown', state: 'discovered', checkedAt: new Date().toISOString() }
    }
    try {
      const ping = await this.inner.ping()
      return {
        status: ping.ok ? 'healthy' : 'unhealthy',
        state: ping.ok ? 'active' : 'unhealthy',
        checkedAt: new Date().toISOString(),
        latencyMs: ping.latencyMs,
      }
    } catch (err) {
      return {
        status: 'unhealthy',
        state: 'unhealthy',
        checkedAt: new Date().toISOString(),
        message: String(err),
      }
    }
  }

  async listModels(): Promise<readonly ModelDescriptor[]> {
    const models = await this.inner.listModels()
    return models.map((name) => ({
      id: modelId(`${this.providerId}:${name}`),
      providerId: this.providerId,
      name,
      modalities: { input: ['text'], output: ['text'] },
      capabilities: this.cachedManifest.capabilities,
    }))
  }

  async *execute(request: AIRequest, signal?: AbortSignal): AsyncIterable<AIEvent> {
    if (!this.connection) {
      throw AI_ERRORS.providerUnavailable(this.providerId, new Error('Not initialized'))
    }

    const requestId = request.requestId
    const now = () => new Date().toISOString()
    let seq = 0
    const next = () => seq++

    yield {
      eventId: createEventId(),
      requestId,
      sequence: next(),
      timestamp: now(),
      type: 'request.started',
    } as AIEvent
    const modelIdForEvents = request.model?.modelId ?? modelId(`${this.providerId}:default`)
    yield {
      eventId: createEventId(),
      requestId,
      sequence: next(),
      timestamp: now(),
      type: 'response.started',
      providerId: this.providerId,
      modelId: modelIdForEvents,
    } as AIEvent

    // Extract prompt text from messages
    const promptText = (request.messages ?? [])
      .flatMap((m) => m.content)
      .filter((c): c is { type: 'text'; text: string } => c.type === 'text')
      .map((c) => c.text)
      .join('\n')

    try {
      // Use the streaming generator
      let totalText = ''
      for await (const token of this.inner.generateStream(promptText)) {
        if (signal?.aborted) break
        totalText += token
        yield {
          eventId: createEventId(),
          requestId,
          sequence: next(),
          timestamp: now(),
          type: 'output.text.delta',
          text: token,
        } as AIEvent
      }
      yield {
        eventId: createEventId(),
        requestId,
        sequence: next(),
        timestamp: now(),
        type: 'usage.updated',
        usage: { outputTokens: Math.ceil(totalText.length / 4) },
      } as AIEvent
      yield {
        eventId: createEventId(),
        requestId,
        sequence: next(),
        timestamp: now(),
        type: 'response.completed',
      } as AIEvent
    } catch (err) {
      yield {
        eventId: createEventId(),
        requestId,
        sequence: next(),
        timestamp: now(),
        type: 'response.failed',
        error: {
          code: 'PROVIDER_UNAVAILABLE',
          message: String(err),
          retryable: true,
          providerId: this.providerId,
        },
      } as AIEvent
    }
  }

  async cancel(_requestId: RequestId): Promise<void> {
    // LocalModelAdapter doesn't support server-side cancel; AbortSignal handles it.
  }

  async shutdown(): Promise<void> {
    this.connection = undefined
  }
}

/**
 * Wraps an existing ApiProviderAdapter (OpenAI/Anthropic/OpenRouter) as an IProviderAdapter.
 * The ApiProviderAdapter is NOT modified — this is a pure wrapper.
 */
export class ApiProviderAdapterWrapper implements IProviderAdapter {
  private connection?: ProviderConnection
  private readonly cachedManifest: ProviderManifest

  constructor(
    private readonly inner: ApiProviderAdapter,
    readonly providerId: ProviderId,
    displayName: string,
  ) {
    this.cachedManifest = {
      id: providerId,
      pluginId: `legacy:api:${providerId}` as never,
      name: displayName,
      version: '1.0.0',
      protocolVersion: VIVIM_AI_PROTOCOL.version,
      kind: 'remote',
      trust: 'official',
      description: `Wrapped ApiProviderAdapter for ${displayName}`,
      capabilities: {
        chat: { supported: true, level: 'basic' },
        streaming: { supported: true, level: 'basic' },
      },
    }
  }

  get manifest(): ProviderManifest {
    return this.cachedManifest
  }

  async initialize(connection: ProviderConnection): Promise<void> {
    this.connection = connection
  }

  async health(): Promise<ProviderHealth> {
    if (!this.connection) {
      return { status: 'unknown', state: 'discovered', checkedAt: new Date().toISOString() }
    }
    return { status: 'healthy', state: 'active', checkedAt: new Date().toISOString() }
  }

  async listModels(): Promise<readonly ModelDescriptor[]> {
    // ApiProviderAdapter doesn't have listModels; return a default
    return [
      {
        id: modelId(`${this.providerId}:default`),
        providerId: this.providerId,
        name: 'default',
        modalities: { input: ['text'], output: ['text'] },
        capabilities: this.cachedManifest.capabilities,
      },
    ]
  }

  async *execute(request: AIRequest, _signal?: AbortSignal): AsyncIterable<AIEvent> {
    if (!this.connection) {
      throw AI_ERRORS.providerUnavailable(this.providerId, new Error('Not initialized'))
    }

    const requestId = request.requestId
    const now = () => new Date().toISOString()
    let seq = 0
    const next = () => seq++

    yield {
      eventId: createEventId(),
      requestId,
      sequence: next(),
      timestamp: now(),
      type: 'request.started',
    } as AIEvent
    const modelIdForEvents = request.model?.modelId ?? modelId(`${this.providerId}:default`)
    yield {
      eventId: createEventId(),
      requestId,
      sequence: next(),
      timestamp: now(),
      type: 'response.started',
      providerId: this.providerId,
      modelId: modelIdForEvents,
    } as AIEvent

    const promptText = (request.messages ?? [])
      .flatMap((m) => m.content)
      .filter((c): c is { type: 'text'; text: string } => c.type === 'text')
      .map((c) => c.text)
      .join('\n')

    try {
      let totalText = ''
      const modelName = (request.model?.modelId as string)?.split(':').pop() ?? 'default'
      await this.inner.send(promptText, modelName, (token) => {
        totalText += token
      })
      if (totalText) {
        yield {
          eventId: createEventId(),
          requestId,
          sequence: next(),
          timestamp: now(),
          type: 'output.text.delta',
          text: totalText,
        } as AIEvent
      }
      yield {
        eventId: createEventId(),
        requestId,
        sequence: next(),
        timestamp: now(),
        type: 'usage.updated',
        usage: { outputTokens: Math.ceil(totalText.length / 4) },
      } as AIEvent
      yield {
        eventId: createEventId(),
        requestId,
        sequence: next(),
        timestamp: now(),
        type: 'response.completed',
      } as AIEvent
    } catch (err) {
      yield {
        eventId: createEventId(),
        requestId,
        sequence: next(),
        timestamp: now(),
        type: 'response.failed',
        error: {
          code: 'PROVIDER_UNAVAILABLE',
          message: String(err),
          retryable: true,
          providerId: this.providerId,
        },
      } as AIEvent
    }
  }

  async cancel(_requestId: RequestId): Promise<void> {
    // ApiProviderAdapter doesn't support server-side cancel; AbortSignal handles it.
  }

  async shutdown(): Promise<void> {
    this.connection = undefined
  }
}
