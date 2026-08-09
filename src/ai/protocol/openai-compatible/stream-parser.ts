/**
 * VIVIM AI Gateway — OpenAI-Compatible SSE Stream Parser
 * @module ai/protocol/openai-compatible/stream-parser
 *
 * Parses the SSE stream from /v1/chat/completions (with stream: true) into
 * canonical AIEvent instances.
 */

import type { AIEvent, ModelId, ProviderId, RequestId, ToolCallId } from '../../core/types.js'
import { createEventId, toolCallId } from '../../core/types.js'
import type { OpenAICompatibleManifest } from './manifest.js'

interface OpenAIStreamChunk {
  id?: string
  object?: string
  model?: string
  choices?: Array<{
    index?: number
    delta?: {
      role?: string
      content?: string
      tool_calls?: Array<{
        index: number
        id?: string
        type?: 'function'
        function?: { name?: string; arguments?: string }
      }>
    }
    finish_reason?: string | null
  }>
  usage?: {
    prompt_tokens?: number
    completion_tokens?: number
    total_tokens?: number
  }
}

export async function* parseSSEStream(
  body: ReadableStream<Uint8Array>,
  requestId: RequestId,
  providerId: ProviderId,
  modelId: ModelId,
  _manifest: OpenAICompatibleManifest,
): AsyncIterable<AIEvent> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let sequence = 0
  const now = () => new Date().toISOString()
  const next = () => sequence++

  // Track in-flight tool calls by index
  const toolCallsByIndex = new Map<number, { id: string; name: string; argsBuffer: string }>()

  // Emit request.started
  yield {
    eventId: createEventId(),
    requestId,
    sequence: next(),
    timestamp: now(),
    type: 'request.started',
  } as AIEvent

  // Emit response.started
  yield {
    eventId: createEventId(),
    requestId,
    sequence: next(),
    timestamp: now(),
    type: 'response.started',
    providerId,
    modelId,
  } as AIEvent

  let finalUsage: { inputTokens?: number; outputTokens?: number; totalTokens?: number } | undefined

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })

    // SSE events are separated by \n\n
    const events = buffer.split('\n\n')
    buffer = events.pop() ?? ''

    for (const eventText of events) {
      const lines = eventText.split('\n')
      let dataLine = ''
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          dataLine = line.slice(6)
        } else if (line.startsWith('data:')) {
          dataLine = line.slice(5)
        }
      }
      if (!dataLine) continue
      if (dataLine === '[DONE]') {
        // Stream complete
        if (finalUsage) {
          yield {
            eventId: createEventId(),
            requestId,
            sequence: next(),
            timestamp: now(),
            type: 'usage.updated',
            usage: finalUsage,
          } as AIEvent
        }
        yield {
          eventId: createEventId(),
          requestId,
          sequence: next(),
          timestamp: now(),
          type: 'response.completed',
          usage: finalUsage,
        } as AIEvent
        return
      }

      let chunk: OpenAIStreamChunk
      try {
        chunk = JSON.parse(dataLine)
      } catch {
        continue // skip malformed
      }

      // Process choices
      if (chunk.choices && chunk.choices.length > 0) {
        const choice = chunk.choices[0]!
        const delta = choice.delta

        if (delta?.content) {
          yield {
            eventId: createEventId(),
            requestId,
            sequence: next(),
            timestamp: now(),
            type: 'output.text.delta',
            text: delta.content,
          } as AIEvent
        }

        if (delta?.tool_calls) {
          for (const tc of delta.tool_calls) {
            const existing = toolCallsByIndex.get(tc.index)
            if (!existing) {
              // New tool call
              const id = tc.id ?? `tc-${tc.index}`
              const name = tc.function?.name ?? ''
              const args = tc.function?.arguments ?? ''
              toolCallsByIndex.set(tc.index, { id, name, argsBuffer: args })
              if (name) {
                yield {
                  eventId: createEventId(),
                  requestId,
                  sequence: next(),
                  timestamp: now(),
                  type: 'tool.call.created',
                  toolCallId: toolCallId(id),
                  name,
                } as AIEvent
              }
            } else {
              // Append to existing
              if (tc.function?.arguments) {
                existing.argsBuffer += tc.function.arguments
                yield {
                  eventId: createEventId(),
                  requestId,
                  sequence: next(),
                  timestamp: now(),
                  type: 'tool.call.delta',
                  toolCallId: toolCallId(existing.id),
                  argumentsDelta: tc.function.arguments,
                } as AIEvent
              }
            }
          }
        }

        if (choice.finish_reason === 'tool_calls') {
          // Complete all pending tool calls
          for (const [, tc] of toolCallsByIndex) {
            let parsedArgs: unknown
            try {
              parsedArgs = JSON.parse(tc.argsBuffer || '{}')
            } catch {
              parsedArgs = tc.argsBuffer
            }
            yield {
              eventId: createEventId(),
              requestId,
              sequence: next(),
              timestamp: now(),
              type: 'tool.call.completed',
              toolCallId: toolCallId(tc.id) as ToolCallId,
              arguments: parsedArgs,
            } as AIEvent
          }
          toolCallsByIndex.clear()
        }
      }

      // Usage (some providers send it in the final chunk)
      if (chunk.usage) {
        finalUsage = {
          inputTokens: chunk.usage.prompt_tokens,
          outputTokens: chunk.usage.completion_tokens,
          totalTokens: chunk.usage.total_tokens,
        }
      }
    }
  }

  // If we didn't get a [DONE] marker, emit response.completed anyway
  if (finalUsage) {
    yield {
      eventId: createEventId(),
      requestId,
      sequence: next(),
      timestamp: now(),
      type: 'usage.updated',
      usage: finalUsage,
    } as AIEvent
  }
  yield {
    eventId: createEventId(),
    requestId,
    sequence: next(),
    timestamp: now(),
    type: 'response.completed',
    usage: finalUsage,
  } as AIEvent
}
