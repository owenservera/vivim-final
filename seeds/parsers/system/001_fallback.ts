// seeds/parsers/system/001_fallback.ts
// Universal fallback parser - MUST NEVER throw

import type { ContentBlock, ParserModule } from '../../../src/engines/stream-parser.js'

export default {
  name: 'system/001_fallback',
  version: 1,
  providerId: 'system',

  parse(rawBody: string): ContentBlock[] {
    if (rawBody.length === 0) {
      return [{ type: 'text', text: '' }]
    }
    return [{ type: 'text', text: rawBody }]
  },

  detectCompletion(): boolean {
    return true
  },

  getConfidence(rawBody: string): number {
    return rawBody.length > 0 ? 0.1 : 0
  },
} as ParserModule
