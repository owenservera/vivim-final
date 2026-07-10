// seeds/parsers/claude/001_streaming_sse.ts
// Claude SSE parser - parses streaming SSE responses from Anthropic API

import type { ContentBlock, ParserModule } from '../../../src/engines/stream-parser.js'

export default {
  name: 'claude/001_streaming_sse',
  version: 1,
  providerId: 'claude',

  parse(rawBody: string): ContentBlock[] {
    const blocks: ContentBlock[] = []
    let index = 0
    for (const line of rawBody.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed.startsWith('data:')) continue
      const payload = trimmed.slice(5).trim()
      if (payload === '[DONE]') break
      try {
        const json = JSON.parse(payload)
        if (json.type === 'content_block_start' && json.content_block) {
          const cb = json.content_block
          if (cb.type === 'thinking') {
            blocks.push({ kind: 'thinking', content: '', index: index++ })
          } else if (cb.type === 'tool_use') {
            blocks.push({
              kind: 'tool_use',
              toolName: cb.name,
              input: cb.input ?? {},
              index: index++,
            })
          } else if (cb.type === 'image') {
            blocks.push({ kind: 'image', url: cb.url, alt: cb.alt, index: index++ })
          }
        }
        if (json.type === 'content_block_delta' && json.delta?.text) {
          const lastBlock = blocks[blocks.length - 1]
          if (lastBlock && lastBlock.kind === 'text') {
            lastBlock.content += json.delta.text
          } else if (json.delta?.thinking) {
            const lastBlock = blocks[blocks.length - 1]
            if (lastBlock && lastBlock.kind === 'thinking') {
              lastBlock.content += json.delta.thinking
            }
          }
        }
        if (json.type === 'message_start') {
          blocks.push({ kind: 'meta', key: 'message_id', value: json.message?.id, index: index++ })
        }
        if (json.type === 'message_stop' || json.type === 'error') {
          const last = blocks[blocks.length - 1]
          if (last && last.kind !== 'meta') {
            blocks.push({ kind: 'meta', key: 'stopped', value: json.type, index: index++ })
          }
        }
      } catch {
        // skip non-parsable lines
      }
    }
    if (blocks.length === 0 && rawBody.length > 0) {
      blocks.push({ kind: 'text', content: rawBody, index: 0 })
    }
    return blocks
  },

  detectCompletion(rawBody: string): boolean {
    return rawBody.includes('message_stop') || rawBody.includes('[DONE]')
  },

  getConfidence(rawBody: string): number {
    let hasDataLines = false
    let hasContentBlock = false
    let hasMessageStop = false
    for (const line of rawBody.split('\n')) {
      const trimmed = line.trim()
      if (trimmed.startsWith('data:')) {
        hasDataLines = true
        if (trimmed.includes('content_block')) hasContentBlock = true
        if (trimmed.includes('message_stop')) hasMessageStop = true
      }
    }
    if (!hasDataLines) return 0
    if (!hasMessageStop) return hasContentBlock ? 0.7 : 0.3
    return 1
  },
} as ParserModule
