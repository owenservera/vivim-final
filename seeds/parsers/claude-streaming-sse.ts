// seeds/parsers/claude-streaming-sse.ts
// Claude SSE streaming parser — extracts ContentBlock[] from Anthropic SSE format.
//
// Claude SSE format:
//   data: {"type":"message_start","message":{...}}
//   data: {"type":"content_block_start","index":0,"content_block":{"type":"text|thinking|tool_use|image",...}}
//   data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta|thinking_delta","text|thinking":"..."}}
//   data: {"type":"content_block_stop","index":0}
//   data: {"type":"message_stop"}

import type { ContentBlock } from '../../src/schema/streaming.js'

export function parse(rawBody: string): ContentBlock[] {
  const blocks: ContentBlock[] = []
  const lines = rawBody.split('\n')

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed.startsWith('data:')) continue

    const payload = trimmed.slice(5).trim()
    if (payload === '[DONE]') break

    try {
      const json = JSON.parse(payload) as Record<string, unknown>

      // content_block_start — creates a new block
      if (json.type === 'content_block_start' && json.content_block) {
        const cb = json.content_block as Record<string, unknown>
        if (cb.type === 'thinking') {
          blocks.push({ type: 'reasoning', text: '' })
        } else if (cb.type === 'tool_use') {
          blocks.push({
            type: 'tool-call',
            toolCallId: `tc_${blocks.length}`,
            toolName: String(cb.name || ''),
            input: (cb.input as Record<string, unknown>) || {},
          })
        } else if (cb.type === 'image' || cb.type === 'image_url') {
          const src = cb.source as Record<string, unknown>
          blocks.push({
            type: 'file',
            mediaType: src?.type === 'image/jpeg' ? 'image/jpeg' : 'image/png',
            url: String(src?.url || cb.url || ''),
            filename: String(cb.alt || ''),
          })
        } else if (cb.type === 'text') {
          blocks.push({ type: 'text', text: String(cb.text || '') })
        }
      }

      // content_block_delta — appends to the last block
      if (json.type === 'content_block_delta' && json.delta) {
        const delta = json.delta as Record<string, unknown>
        if (typeof delta.text === 'string') {
          const lastBlock = blocks[blocks.length - 1]
          if (lastBlock && lastBlock.type === 'text' && typeof lastBlock.text === 'string') {
            lastBlock.text += delta.text
          } else {
            blocks.push({ type: 'text', text: delta.text })
          }
        } else if (typeof delta.thinking === 'string') {
          const lastThink = blocks[blocks.length - 1]
          if (lastThink && lastThink.type === 'reasoning' && typeof lastThink.text === 'string') {
            lastThink.text += delta.thinking
          } else {
            blocks.push({ type: 'reasoning', text: delta.thinking })
          }
        }
      }

      // message_start — metadata
      if (json.type === 'message_start' && json.message) {
        const msg = json.message as Record<string, unknown>
        blocks.push({ type: 'meta', key: 'message_id', value: msg.id })
      }

      // message_stop / error
      if (json.type === 'message_stop' || json.type === 'error') {
        const last = blocks[blocks.length - 1]
        if (last && last.type !== 'meta') {
          blocks.push({ type: 'meta', key: 'stopped', value: json.type })
        }
      }
    } catch {
      // skip unparseable lines
    }
  }

  // Fallback: if no blocks extracted, return the raw body as text
  if (blocks.length === 0 && rawBody.length > 0) {
    blocks.push({ type: 'text', text: rawBody })
  }

  return blocks
}

export function detectCompletion(rawBody: string): boolean {
  return rawBody.includes('message_stop') || rawBody.includes('[DONE]')
}

export function getConfidence(rawBody: string): number {
  const hasDataLines = rawBody.includes('data:')
  const hasContentBlock =
    rawBody.includes('content_block_delta') || rawBody.includes('content_block_start')
  if (!hasDataLines) return 0
  if (!hasContentBlock) return rawBody.includes('message_stop') ? 0.7 : 0.3
  return 1
}

export default { name: 'claude/001_streaming_sse', version: 1, providerId: 'claude', parse, detectCompletion, getConfidence }
