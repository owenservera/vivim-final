// seeds/parsers/chatgpt/001_openai_sse.ts
// ChatGPT/OpenAI-compatible SSE parser

import type { ContentBlock, ParserModule } from '../../../src/engines/stream-parser.js'

export default {
  name: 'chatgpt/001_openai_sse',
  version: 1,
  providerId: 'chatgpt',

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
        const delta = json.choices?.[0]?.delta
        if (delta?.content) {
          const lastBlock = blocks[blocks.length - 1]
          if (lastBlock && lastBlock.kind === 'text') {
            lastBlock.content += delta.content
          } else {
            blocks.push({ kind: 'text', content: delta.content, index: index++ })
          }
        }
        if (delta?.tool_calls) {
          for (const tc of delta.tool_calls) {
            blocks.push({
              kind: 'tool_use',
              toolName: tc.function?.name ?? 'unknown',
              input: tc.function?.arguments ?? {},
              index: index++,
            })
          }
        }
      } catch {
        // skip non-JSON lines
      }
    }
    if (blocks.length === 0 && rawBody.trim().length > 0) {
      blocks.push({ kind: 'text', content: rawBody, index: 0 })
    }
    return blocks
  },

  detectCompletion(rawBody: string): boolean {
    return rawBody.includes('[DONE]') || /"finish_reason"\s*:\s*"stop"/.test(rawBody)
  },

  getConfidence(rawBody: string): number {
    const hasDone = rawBody.includes('[DONE]')
    const hasDelta = rawBody.includes('choices') && rawBody.includes('delta')
    if (hasDone) return 1
    if (hasDelta) return 0.7
    return 0
  },
} as ParserModule
