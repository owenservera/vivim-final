// seeds/parsers/gemini/001_batchexecute.ts
// Gemini batchexecute parser - parses nested JSON array responses

import type { ContentBlock, ParserModule } from '../../../src/engines/stream-parser.js'

export default {
  name: 'gemini/001_batchexecute',
  version: 1,
  providerId: 'gemini',

  parse(rawBody: string): ContentBlock[] {
    const blocks: ContentBlock[] = []
    try {
      // Gemini uses [[["wrb.fr","...",...]]] structure
      const parsed = JSON.parse(rawBody)
      if (!Array.isArray(parsed)) {
        return [{ type: 'text', text: rawBody }]
      }
      const innerArrays = parsed.flat(2)
      for (const item of innerArrays) {
        if (typeof item === 'string') {
          blocks.push({ type: 'text', text: item })
        }
      }
    } catch {
      if (rawBody.trim().length > 0) {
        blocks.push({ type: 'text', text: rawBody })
      }
    }
    return blocks
  },

  detectCompletion(): boolean {
    return true
  },

  getConfidence(_rawBody: string): number {
    try {
      return 0.8
    } catch {
      return 0
    }
  },
} as ParserModule
