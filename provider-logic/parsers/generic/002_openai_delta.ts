// seeds/parsers/generic/002_openai_delta.ts
// OpenAI-style delta streaming parser

import type { ContentBlock, ParserModule } from '../../../src/engines/stream-parser.js'

export default {
  name: 'generic/002_openai_delta',
  version: 1,
  providerId: 'generic',

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
        if (delta?.role) {
          blocks.push({ kind: 'meta', key: 'role', value: delta.role, index: index++ })
        }
        if (delta?.content) {
          const lastBlock = blocks[blocks.length - 1]
          if (lastBlock && lastBlock.kind === 'text') {
            lastBlock.content += delta.content
          } else {
            blocks.push({ kind: 'text', content: delta.content, index: index++ })
          }
        }
        if (delta?.function_call) {
          blocks.push({
            kind: 'tool_use',
            toolName: delta.function_call.name ?? 'unknown',
            input: delta.function_call.arguments ? JSON.parse(delta.function_call.arguments) : {},
            index: index++,
          })
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

  getConfidence(_rawBody: string): number {
    return 0.7
  },
} as ParserModule
