/**
 * VIVIM AI Gateway — OpenAI-Compatible Adapter
 * @module ai/protocol/openai-compatible/adapter
 *
 * THE generic adapter that handles ALL OpenAI-schema providers. One class,
 * manifest-driven. Adding a new OpenAI-compatible provider = adding a JSON
 * manifest, zero code change.
 */

import { AI_ERRORS } from '../../core/errors.js'
import type {
  AIEvent,
  AIRequest,
  ModelDescriptor,
  ProviderHealth,
  ProviderId,
  ProviderManifest,
  RequestId,
} from '../../core/types.js'
import { VIVIM_AI_PROTOCOL, modelId } from '../../core/types.js'
import type { IProviderAdapter, ProviderConnection } from '../adapter.js'
import { resolveAuthHeaders } from './auth.js'
import { mapOpenAIError } from './error-mapper.js'
import type { ModelManifestEntry, OpenAICompatibleManifest } from './manifest.js'
import { modelEntryToCapabilityMap } from './manifest.js'
import { buildChatCompletionRequest } from './request-builder.js'
import { parseSSEStream } from './stream-parser.js'

export class OpenAICompatibleAdapter implements IProviderAdapter {
  private connection?: ProviderConnection
  private runtimeModels: ModelDescriptor[] = []
  private cachedManifest?: ProviderManifest

  constructor(private readonly spec: OpenAICompatibleManifest) {}

  get providerId(): ProviderId {
    return this.spec.providerId
  }

  get manifest(): ProviderManifest {
    if (this.cachedManifest) return this.cachedManifest
    this.cachedManifest = this.deriveProviderManifest()
    return this.cachedManifest
  }

  private deriveProviderManifest(): ProviderManifest {
    // Build a CapabilityMap from the manifest's declared capabilities
    const caps: Partial<
      Record<string, { supported: true; level?: 'basic' | 'advanced' | 'strict' }>
    > = {}
    for (const cap of this.spec.capabilities) {
      caps[cap] = { supported: true, level: 'basic' }
    }

    return {
      id: this.spec.providerId,
      pluginId: `openai-compatible:${this.spec.providerId}` as never,
      name: this.spec.displayName,
      version: '1.0.0',
      protocolVersion: VIVIM_AI_PROTOCOL.version,
      kind: this.spec.providerKind,
      trust: this.spec.trust,
      description: `OpenAI-compatible provider: ${this.spec.displayName}`,
      capabilities: caps as never,
    }
  }

  async initialize(connection: ProviderConnection): Promise<void> {
    this.connection = connection
    // Try to discover models via GET /v1/models (best-effort)
    await this.discoverModels().catch(() => {
  // [audit] log the error with context here
      // Non-fatal: fall back to manifest-declared models
    })
  }

  private async discoverModels(): Promise<void> {
    if (!this.connection?.baseUrl) return
    try {
      const headers = this.buildHeaders()
      const response = await fetch(`${this.connection.baseUrl}/models`, {
        method: 'GET',
        headers,
      })
      if (!response.ok) return
      const data = (await response.json()) as { data?: Array<{ id: string }> }
      if (!data.data) return
      this.runtimeModels = data.data.map((m) => this.translateDiscoveredModel(m.id))
    } catch {
  // [audit] log the error with context here
      // Non-fatal
    }
  }

  private translateDiscoveredModel(openAIModelName: string): ModelDescriptor {
    // Check if the manifest declares this model
    const entry = this.spec.models.find((m) => m.openAIModelName === openAIModelName)
    if (entry) {
      return this.modelEntryToDescriptor(entry)
    }
    // Otherwise, synthesize a minimal descriptor
    return {
      id: modelId(`${this.spec.providerId}:${openAIModelName}`),
      providerId: this.spec.providerId,
      name: openAIModelName,
      modalities: { input: ['text'], output: ['text'] },
      capabilities: {} as never,
    }
  }

  private modelEntryToDescriptor(entry: ModelManifestEntry): ModelDescriptor {
    return {
      id: entry.modelId,
      providerId: this.spec.providerId,
      name: entry.displayName,
      family: entry.openAIModelName,
      modalities: { input: ['text'], output: ['text'] },
      capabilities: modelEntryToCapabilityMap(entry),
      contextWindow: entry.contextWindow,
      maxOutputTokens: undefined,
    }
  }

  async health(): Promise<ProviderHealth> {
    if (!this.connection?.baseUrl) {
      return {
        status: 'unknown',
        state: 'discovered',
        checkedAt: new Date().toISOString(),
        message: 'Not initialized',
      }
    }
    try {
      const start = Date.now()
      const headers = this.buildHeaders()
      const response = await fetch(`${this.connection.baseUrl}/models`, {
        method: 'GET',
        headers,
        signal: AbortSignal.timeout(5000),
      })
      const latencyMs = Date.now() - start
      if (response.ok) {
        return {
          status: 'healthy',
          state: 'active',
          checkedAt: new Date().toISOString(),
          latencyMs,
        }
      }
      return {
        status: 'unhealthy',
        state: 'unhealthy',
        checkedAt: new Date().toISOString(),
        latencyMs,
        message: `HTTP ${response.status}`,
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
    // Union of manifest-declared models + runtime-discovered models
    const manifestModels = this.spec.models.map((e) => this.modelEntryToDescriptor(e))
    // Deduplicate by id (runtime models that match manifest entries are already in manifestModels)
    const seen = new Set(manifestModels.map((m) => m.id))
    const extra = this.runtimeModels.filter((m) => !seen.has(m.id))
    return [...manifestModels, ...extra]
  }

  async *execute(request: AIRequest, signal?: AbortSignal): AsyncIterable<AIEvent> {
    if (!this.connection?.baseUrl) {
      throw AI_ERRORS.providerUnavailable(this.providerId, new Error('Not initialized'))
    }

    const body = buildChatCompletionRequest(request, this.spec)
    const headers = this.buildHeaders()

    // Resolve the model name for the response events
    const modelIdForEvents = this.resolveModelId(request)

    let response: Response
    try {
      response = await fetch(`${this.connection.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: { ...headers, Accept: 'text/event-stream' },
        body: JSON.stringify({ ...body, stream: true }),
        signal,
      })
    } catch (err) {
      throw mapOpenAIError(err, this.providerId)
    }

    if (!response.ok) {
      throw mapOpenAIError(
        {
          status: response.status,
          body: await response.text().catch(() => ''),
          message: `HTTP ${response.status}`,
        } as unknown as Error,
        this.providerId,
      )
    }
    if (!response.body) {
      throw AI_ERRORS.protocolError('No response body from /v1/chat/completions')
    }

    try {
      yield* parseSSEStream(
        response.body,
        request.requestId,
        this.providerId,
        modelIdForEvents,
        this.spec,
      )
    } catch (err) {
      throw mapOpenAIError(err, this.providerId)
    }
  }

  async cancel(_requestId: RequestId): Promise<void> {
    // OpenAI-compat doesn't have a standard cancel endpoint.
    // Client-side abort (the signal in execute()) handles it.
  }

  async shutdown(): Promise<void> {
    this.connection = undefined
    this.runtimeModels = []
  }

  private buildHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...resolveAuthHeaders(this.spec.auth),
      ...(this.spec.defaultHeaders ?? {}),
    }
    return headers
  }

  private resolveModelId(request: AIRequest): import('../../core/types.js').ModelId {
    if (request.model?.modelId) return request.model.modelId
    const defaultEntry = this.spec.models.find((m) => m.isDefault) ?? this.spec.models[0]
    if (defaultEntry) return defaultEntry.modelId
    return modelId(`${this.spec.providerId}:default`)
  }
}
