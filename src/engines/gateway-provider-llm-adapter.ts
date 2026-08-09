// src/engines/gateway-provider-llm-adapter.ts
// #1: Bridges the AI Gateway (src/ai/) to LLM consumers that currently use stubs.
//
// Implements:
//   - ProviderLLMAdapter (query(prompt) → string) — for NLCLEngine Tier-3 + LLMSlaveResolver
//   - SynthesisLlmProvider (synthesize(prompt, style) → {text, confidence}) — for CrossConversationSynthesizer
//
// Reads globalThis.__aiGateway lazily so it works whether or not the gateway is enabled.
// When the gateway is disabled, returns a clear stub message (preserving existing behavior
// but signaling that the gateway is off).

import type { AIRequest } from '../ai/core/types.js'
import { createRequestId, modelId, providerId } from '../ai/index.js'

/** Minimal LLM adapter interface (matches nlcl/llm-slave-resolver.ts ProviderLLMAdapter). */
export interface ProviderLLMAdapter {
  query(prompt: string): Promise<string>
}

/** Minimal synthesis provider interface (matches cross-conversation-synthesis.ts SynthesisLlmProvider). */
export interface SynthesisLlmProvider {
  synthesize(prompt: string, style: string): Promise<{ text: string; confidence: number }>
}

export interface GatewayProviderLLMAdapterOptions {
  /** Provider ID to route to (default: 'simulator' — works without a GPU). */
  providerId?: string
  /** Model ID to route to. If omitted, the router picks. */
  modelId?: string
  /** Max tokens to request (default: 2048). */
  maxOutputTokens?: number
}

/**
 * Adapter that implements both ProviderLLMAdapter and SynthesisLlmProvider
 * by calling globalThis.__aiGateway.execute() and buffering the streamed
 * text-delta events into a single string.
 */
export class GatewayProviderLLMAdapter implements ProviderLLMAdapter, SynthesisLlmProvider {
  private readonly opts: Required<GatewayProviderLLMAdapterOptions>

  constructor(opts: GatewayProviderLLMAdapterOptions = {}) {
    this.opts = {
      providerId: opts.providerId ?? 'simulator',
      modelId: opts.modelId ?? '',
      maxOutputTokens: opts.maxOutputTokens ?? 2048,
    }
  }

  /** ProviderLLMAdapter.query — used by NLCLEngine + LLMSlaveResolver. */
  async query(prompt: string): Promise<string> {
    return this.execute(prompt)
  }

  /** SynthesisLlmProvider.synthesize — used by CrossConversationSynthesizer. */
  async synthesize(prompt: string, _style: string): Promise<{ text: string; confidence: number }> {
    const text = await this.execute(prompt)
    // Confidence heuristic: non-empty response = high confidence; stub/empty = low.
    const confidence = text.length > 10 && !text.includes('AI Gateway not enabled') ? 0.8 : 0.1
    return { text, confidence }
  }

  private async execute(prompt: string): Promise<string> {
    const gateway = (globalThis as Record<string, unknown>).__aiGateway as
      | {
          execute: (
            request: AIRequest,
            signal?: AbortSignal,
          ) => AsyncIterable<import('../ai/core/types.js').AIEvent>
        }
      | undefined

    if (!gateway) {
      return '[AI Gateway not enabled — set AI_GATEWAY_ENABLED=1]'
    }

    const request: AIRequest = {
      requestId: createRequestId(),
      messages: [{ role: 'user', content: [{ type: 'text', text: prompt }] }],
      model: this.opts.modelId
        ? { providerId: providerId(this.opts.providerId), modelId: modelId(this.opts.modelId) }
        : { providerId: providerId(this.opts.providerId) },
      generation: { maxOutputTokens: this.opts.maxOutputTokens },
    }

    let result = ''
    try {
      for await (const event of gateway.execute(request)) {
        if (event.type === 'output.text.delta') {
          result += event.text
        }
        if (event.type === 'response.failed') {
          return `[AI Gateway error: ${event.error.message}]`
        }
      }
    } catch (err) {
      return `[AI Gateway execution failed: ${err instanceof Error ? err.message : String(err)}]`
    }
    return result
  }
}

/**
 * Lazy singleton — returns the same adapter instance across calls.
 * Constructed on first use so it picks up globalThis.__aiGateway whenever it's ready.
 */
let _instance: GatewayProviderLLMAdapter | undefined
export function getGatewayProviderLLMAdapter(
  opts?: GatewayProviderLLMAdapterOptions,
): GatewayProviderLLMAdapter {
  if (!_instance) {
    _instance = new GatewayProviderLLMAdapter(opts)
  }
  return _instance
}
