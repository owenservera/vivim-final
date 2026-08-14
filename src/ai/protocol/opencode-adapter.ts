/**
 * VIVIM AI Gateway — OpenCode Native Adapter
 * @module ai/protocol/opencode-adapter
 *
 * Wraps the existing OpenCodeClient (src/engines/opencode/opencode-client.ts)
 * WITHOUT modifying it. Implements IProviderAdapter so OpenCode becomes a
 * first-class AI Gateway provider.
 *
 * OpenCode serve uses a session-based protocol (POST /session, POST /session/:id/message,
 * GET /event?session= SSE), NOT /v1/chat/completions. So this is a NATIVE adapter
 * (Option B2 from DESIGN-OPENAI-COMPATIBLE-ADAPTER.md §9), not an instance of
 * OpenAICompatibleAdapter.
 *
 * The existing OpenCodeClient, OpenCodeSupervisor, OpenCodeIngest, and OpenCodeExecutor
 * are NOT modified. This adapter simply wraps the client's chat-execution methods
 * and translates OpencodeEvent SSE → canonical AIEvent stream.
 */

import type { OpenCodeClient } from '../../engines/opencode/opencode-client.js'
import type { OpencodeEvent } from '../../engines/opencode/types.js'
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
import { createEventId, modelId, providerId, VIVIM_AI_PROTOCOL } from '../core/types.js'
import type { IProviderAdapter, ProviderConnection } from './adapter.js'

const OPENCODE_PROVIDER_ID = providerId('opencode-serve')
const OPENCODE_DEFAULT_MODEL = modelId('opencode:default')

const OPENCODE_MANIFEST: ProviderManifest = {
  id: OPENCODE_PROVIDER_ID,
  pluginId: 'opencode-serve' as never,
  name: 'OpenCode Local Agent (serve)',
  version: '1.0.0',
  protocolVersion: VIVIM_AI_PROTOCOL.version,
  kind: 'local',
  trust: 'official',
  description: 'OpenCode serve — local AI agent with session-based protocol.',
  capabilities: {
    chat: { supported: true, level: 'advanced' },
    streaming: { supported: true, level: 'advanced' },
    'tool-calling': { supported: true, level: 'advanced' },
    cancellation: { supported: true, level: 'basic' },
    'usage-reporting': { supported: true, level: 'basic' },
  },
}

const OPENCODE_DEFAULT_MODEL_DESCRIPTOR: ModelDescriptor = {
  id: OPENCODE_DEFAULT_MODEL,
  providerId: OPENCODE_PROVIDER_ID,
  name: 'OpenCode Default Model',
  family: 'opencode',
  modalities: { input: ['text'], output: ['text'] },
  capabilities: OPENCODE_MANIFEST.capabilities,
  contextWindow: 32768,
  maxOutputTokens: 8192,
}

export interface OpenCodeAdapterOptions {
  /** The model slug to pass to opencode serve (e.g. 'opencode/qwen3.5-3b-free'). */
  readonly defaultModelSlug?: string
  /** Additional model descriptors to expose. */
  readonly models?: readonly ModelDescriptor[]
}

export class OpenCodeAdapter implements IProviderAdapter {
  readonly providerId: ProviderId = OPENCODE_PROVIDER_ID
  readonly manifest: ProviderManifest = OPENCODE_MANIFEST
  private connection?: ProviderConnection
  private readonly options: OpenCodeAdapterOptions

  constructor(
    private readonly client: OpenCodeClient,
    options: OpenCodeAdapterOptions = {},
  ) {
    this.options = options
  }

  async initialize(connection: ProviderConnection): Promise<void> {
    this.connection = connection
    // Verify the client can reach the server
    try {
      await this.client.ready()
    } catch (err) {
      throw AI_ERRORS.providerUnavailable(this.providerId, err)
    }
  }

  async health(): Promise<ProviderHealth> {
    if (!this.connection) {
      return {
        status: 'unknown',
        state: 'discovered',
        checkedAt: new Date().toISOString(),
        message: 'Not initialized',
      }
    }
    try {
      const start = Date.now()
      await this.client.ready()
      return {
        status: 'healthy',
        state: 'active',
        checkedAt: new Date().toISOString(),
        latencyMs: Date.now() - start,
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
    if (this.options.models && this.options.models.length > 0) {
      return this.options.models
    }
    return [OPENCODE_DEFAULT_MODEL_DESCRIPTOR]
  }

  async *execute(request: AIRequest, signal?: AbortSignal): AsyncIterable<AIEvent> {
    if (!this.connection) {
      throw AI_ERRORS.providerUnavailable(this.providerId, new Error('Not initialized'))
    }

    const requestId = request.requestId
    const now = () => new Date().toISOString()
    let seq = 0
    const next = () => seq++

    // Resolve the model slug from the request or options
    const modelSlug = this.resolveModelSlug(request)
    const modelIdForEvents = request.model?.modelId ?? OPENCODE_DEFAULT_MODEL

    // Emit request.started
    yield {
      eventId: createEventId(),
      requestId,
      sequence: next(),
      timestamp: now(),
      type: 'request.started',
    } as AIEvent

    // Create a session
    let sessionId: string
    try {
      const result = await this.client.createSession({
        model: modelSlug,
        cwd: request.metadata?.workspaceId as string | undefined,
      })
      sessionId = result.sessionId
    } catch (err) {
      yield {
        eventId: createEventId(),
        requestId,
        sequence: next(),
        timestamp: now(),
        type: 'response.failed',
        error: {
          code: 'PROVIDER_UNAVAILABLE',
          message: `Failed to create OpenCode session: ${String(err)}`,
          retryable: true,
          providerId: this.providerId,
        },
      } as AIEvent
      return
    }

    // Emit response.started
    yield {
      eventId: createEventId(),
      requestId,
      sequence: next(),
      timestamp: now(),
      type: 'response.started',
      providerId: this.providerId,
      modelId: modelIdForEvents,
    } as AIEvent

    // Subscribe to the SSE event stream
    const eventQueue: OpencodeEvent[] = []
    let resolveWait: ((event: OpencodeEvent | null) => void) | null = null
    let streamClosed = false

    const unsubscribe = await this.client.subscribe(sessionId, (ev) => {
      if (resolveWait) {
        const r = resolveWait
        resolveWait = null
        r(ev)
      } else {
        eventQueue.push(ev)
      }
    })

    // Set up abort handling
    const abortController = new AbortController()
    if (signal) {
      if (signal.aborted) {
        abortController.abort()
      } else {
        signal.addEventListener('abort', () => {
          abortController.abort()
          streamClosed = true
          if (resolveWait) {
            resolveWait(null)
            resolveWait = null
          }
        })
      }
    }

    try {
      // Send the prompt (async — we'll read the response via SSE)
      const promptText = this.extractPromptText(request)
      await this.client.sendPrompt(sessionId, promptText)

      // Pump SSE events → AIEvents
      let totalText = ''
      let inputTokens = 0
      let outputTokens = 0

      while (!streamClosed && !abortController.signal.aborted) {
        const event = await new Promise<OpencodeEvent | null>((resolve) => {
          if (eventQueue.length > 0) {
            resolve(eventQueue.shift()!)
          } else if (streamClosed) {
            resolve(null)
          } else {
            resolveWait = resolve
          }
        })

        if (event === null) break

        // Translate the OpencodeEvent → AIEvent(s)
        const translated = this.translateEvent(
          event,
          requestId,
          modelIdForEvents,
          () => next(),
          now,
        )
        for (const aiEvent of translated) {
          if (aiEvent.type === 'output.text.delta') {
            totalText += aiEvent.text
          }
          if (aiEvent.type === 'usage.updated') {
            inputTokens = aiEvent.usage.inputTokens ?? inputTokens
            outputTokens = aiEvent.usage.outputTokens ?? outputTokens
          }
          yield aiEvent
        }

        // Check for terminal events
        if (this.isTerminalEvent(event)) {
          break
        }
      }

      // Emit usage + completed
      outputTokens = outputTokens || Math.ceil(totalText.length / 4)
      yield {
        eventId: createEventId(),
        requestId,
        sequence: next(),
        timestamp: now(),
        type: 'usage.updated',
        usage: {
          inputTokens,
          outputTokens,
          totalTokens: inputTokens + outputTokens,
        },
      } as AIEvent

      yield {
        eventId: createEventId(),
        requestId,
        sequence: next(),
        timestamp: now(),
        type: 'response.completed',
        usage: {
          inputTokens,
          outputTokens,
          totalTokens: inputTokens + outputTokens,
        },
      } as AIEvent
    } finally {
      unsubscribe()
    }
  }

  async cancel(_requestId: RequestId): Promise<void> {
    // OpenCode serve doesn't have a standard cancel endpoint per-session;
    // the AbortSignal in execute() handles it.
  }

  async shutdown(): Promise<void> {
    this.connection = undefined
  }

  // --- Helpers ---

  private resolveModelSlug(request: AIRequest): string | undefined {
    if (request.model?.modelId) {
      // If the modelId is already a slug, use it; otherwise fall back to options
      const mid = request.model.modelId as string
      if (mid.includes('/') || mid.startsWith('opencode/')) return mid
      return this.options.defaultModelSlug
    }
    return this.options.defaultModelSlug
  }

  private extractPromptText(request: AIRequest): string {
    if (!request.messages || request.messages.length === 0) {
      return request.task?.description ?? ''
    }
    // Concatenate all text content from all messages
    const parts: string[] = []
    for (const msg of request.messages) {
      for (const content of msg.content) {
        if (content.type === 'text') {
          parts.push((content as { type: 'text'; text: string }).text)
        }
      }
    }
    return parts.join('\n')
  }

  private translateEvent(
    event: OpencodeEvent,
    requestId: RequestId,
    modelId: import('../core/types.js').ModelId,
    next: () => number,
    now: () => string,
  ): AIEvent[] {
    const out: AIEvent[] = []
    const type = (event as { type?: string }).type

    if (type === 'text' || type === 'session.message') {
      // Text delta
      const text = this.extractTextFromEvent(event)
      if (text) {
        out.push({
          eventId: createEventId(),
          requestId,
          sequence: next(),
          timestamp: now(),
          type: 'output.text.delta',
          text,
        } as AIEvent)
      }
    } else if (type === 'step_finish' || type === 'session.step_finish') {
      // Step complete — extract usage if present
      const usage = this.extractUsageFromEvent(event)
      if (usage) {
        out.push({
          eventId: createEventId(),
          requestId,
          sequence: next(),
          timestamp: now(),
          type: 'usage.updated',
          usage,
        } as AIEvent)
      }
    } else if (type === 'tool_use' || type === 'tool.call') {
      // Tool call
      const toolName = (event as { properties?: { tool?: string } }).properties?.tool ?? 'unknown'
      const toolCallId = `tc-${next()}` as never
      out.push({
        eventId: createEventId(),
        requestId,
        sequence: next(),
        timestamp: now(),
        type: 'tool.call.created',
        toolCallId,
        name: toolName,
      } as AIEvent)
      out.push({
        eventId: createEventId(),
        requestId,
        sequence: next(),
        timestamp: now(),
        type: 'tool.call.completed',
        toolCallId,
        arguments: (event as { properties?: { args?: unknown } }).properties?.args ?? {},
      } as AIEvent)
    } else if (type === 'error') {
      const msg =
        (event as { properties?: { error?: string } }).properties?.error ?? 'Unknown error'
      out.push({
        eventId: createEventId(),
        requestId,
        sequence: next(),
        timestamp: now(),
        type: 'response.failed',
        error: {
          code: 'PROTOCOL_ERROR',
          message: msg,
          retryable: false,
          providerId: this.providerId,
          modelId,
        },
      } as AIEvent)
    }

    return out
  }

  private extractTextFromEvent(event: OpencodeEvent): string | undefined {
    const e = event as { properties?: { text?: string; part?: { text?: string } }; text?: string }
    return e.properties?.text ?? e.properties?.part?.text ?? e.text
  }

  private extractUsageFromEvent(
    event: OpencodeEvent,
  ): { inputTokens?: number; outputTokens?: number; totalTokens?: number } | undefined {
    const e = event as {
      properties?: { tokens?: { input?: number; output?: number; total?: number } }
    }
    const tokens = e.properties?.tokens
    if (!tokens) return undefined
    return {
      inputTokens: tokens.input,
      outputTokens: tokens.output,
      totalTokens: tokens.total,
    }
  }

  private isTerminalEvent(event: OpencodeEvent): boolean {
    const type = (event as { type?: string }).type
    return type === 'session.idle' || type === 'session.done' || type === 'done' || type === 'error'
  }
}

export {
  OPENCODE_DEFAULT_MODEL,
  OPENCODE_DEFAULT_MODEL_DESCRIPTOR,
  OPENCODE_MANIFEST,
  OPENCODE_PROVIDER_ID,
}
