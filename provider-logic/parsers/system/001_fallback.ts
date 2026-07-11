// seeds/parsers/system/001_fallback.ts
// Universal fallback parser - MUST NEVER throw

import type { ContentBlock, ParserModule } from '../../../src/engines/stream-parser.js'

export default {
  name: 'system/001_fallback',
  version: 1,
  providerId: 'system',

  parse(rawBody: string): ContentBlock[] {
    // Never throws - returns raw body as text block
    if (rawBody.length === 0) {
      return [{ kind: 'text', content: '', index: 0 }]
    }
    return [{ kind: 'text', content: rawBody, index: 0 }]
  },

  detectCompletion(): boolean {
    // Always returns true
    return true
  },

  getConfidence(rawBody: string): number {
    // 0.1 if body non-empty, 0 otherwise
    return rawBody.length > 0 ? 0.1 : 0
  },
} as ParserModule
