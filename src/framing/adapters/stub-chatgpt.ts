// src/framing/adapters/stub-chatgpt.ts
// Phase 2 of ROADMAP-REPROGRAMMABLE-CANVAS.md — HarnessFraming core.
//
// A STUB FramingAdapter for ChatGPT (WebApp transport). This is a
// reference implementation showing the pattern. In Phase 2+ it will be
// replaced by a real adapter that:
//   - Reads the composer selector from ProviderRegistry.
//   - Builds a recipe DAG using the existing chatgpt adapter seeds.
//   - Parses the SSE stream via the existing chatgpt-openai-delta parser.
//
// For now: frames a minimal recipe DAG + parses SSE chunks into text blocks.
//
// FRAME_VERSION: 1

import type { ContentPart } from '../../schema/streaming.js'
import type { FramedRequest, FramingAdapter, HealthCheckResult, ParseContext } from '../adapter.js'
import type { NormalizedRequest } from '../schemas.js'

/**
 * Stub ChatGPT adapter. Shows the pattern; real implementation will
 * reuse `seeds/adapters/chatgpt.ts` and `seeds/parsers/harvested/chatgpt-openai-delta.ts`.
 */
export class StubChatGptFramingAdapter implements FramingAdapter {
  readonly providerId = 'chatgpt'
  readonly transport = 'webapp' as const

  async frameRequest(req: NormalizedRequest): Promise<FramedRequest> {
    // In a real adapter, look up the composer selector from ProviderRegistry.
    const composerSelector = 'textarea#prompt-textarea, div[contenteditable="true"]#prompt-textarea'
    const lastUserMessage = req.input.messages.findLast((m) => m.role === 'user')
    const text =
      (lastUserMessage?.content ?? [])
        .filter((c: unknown): c is { type: 'text'; text: string } => {
          return (
            typeof c === 'object' &&
            c !== null &&
            (c as { type?: unknown }).type === 'text' &&
            typeof (c as { text?: unknown }).text === 'string'
          )
        })
        .map((c) => c.text)
        .join('\n') ?? ''

    // Minimal 2-node recipe DAG — same shape as conversation-manager.ts:478.
    // Real adapter will build this from seeds/adapters/chatgpt.ts.
    const recipeSteps = [
      {
        kind: 'type_text',
        selector: composerSelector,
        text,
        // Clear the input first
        clearFirst: true,
      },
      {
        kind: 'submit',
        selector: composerSelector,
        // Press Enter to submit
        method: 'enter_key' as const,
      },
    ]

    return {
      recipeSteps,
      effectiveTransport: 'webapp',
    }
  }

  async *parseResponse(
    chunk: unknown,
    ctx: ParseContext,
  ): AsyncGenerator<ContentPart, void, unknown> {
    // In a real adapter, use seeds/parsers/harvested/chatgpt-openai-delta.ts.
    // Here: assume `chunk` is an SSE-style string with `data: {...}` lines.
    if (typeof chunk !== 'string') {
      yield {
        type: 'error',
        message: `StubChatGptFramingAdapter expected string chunk, got ${typeof chunk}`,
      }
      return
    }

    const lines = chunk.split('\n')
    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed.startsWith('data:')) continue
      const payload = trimmed.slice(5).trim()
      if (payload === '[DONE]') {
        yield { type: 'text', text: '', state: 'done', isFinal: true } as ContentPart & {
          isFinal: true
        }
        return
      }
      try {
        const obj = JSON.parse(payload) as { delta?: { content?: string } }
        const text = obj.delta?.content
        if (text) {
          yield {
            type: 'text',
            text,
            state: 'streaming',
            streamIndex: ctx.chunkIndex,
          } as ContentPart
        }
      } catch {
  // [audit] log the error with context here
        // Not JSON — skip.
      }
    }
  }

  async healthCheck(): Promise<HealthCheckResult> {
    // In a real adapter, check that ProviderRegistry has the chatgpt entry
    // and that the composer selector is non-empty.
    return {
      providerId: this.providerId,
      healthy: true,
      checks: [
        {
          name: 'provider-registered',
          passed: true,
          detail: 'stub: would check ProviderRegistry.has("chatgpt")',
        },
        {
          name: 'composer-selector-known',
          passed: true,
          detail: 'stub: would check non-empty selector',
        },
      ],
      checkedAt: Date.now(),
    }
  }
}
