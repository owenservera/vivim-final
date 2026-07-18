// seeds/parsers/generic/001_sse_frames.ts
// Generic SSE frame parser - fallback for any SSE-based provider

import type { ContentBlock, ParserModule } from '../../../src/engines/stream-parser.js'

export default {
  name: 'generic/001_sse_frames',
  version: 1,
  providerId: 'generic',

  parse(rawBody: string): ContentBlock[] {
    const blocks: ContentBlock[] = []
    for (const frame of rawBody.split('\n\n')) {
      const dataLines: string[] = []
      for (const line of frame.split('\n')) {
        const trimmed = line.trim()
        if (trimmed.startsWith('data:')) {
          dataLines.push(trimmed.slice(5).trim())
        }
      }
      if (dataLines.length === 0) continue
      const joinedData = dataLines.join('\n')
      try {
        const json = JSON.parse(joinedData)
        if (typeof json === 'string') {
          blocks.push({ type: 'text', text: json })
        } else if (typeof json === 'object' && json !== null) {
          blocks.push({ type: 'text', text: JSON.stringify(json) })
        }
      } catch {
        blocks.push({ type: 'text', text: joinedData })
      }
    }
    if (blocks.length === 0 && rawBody.trim().length > 0) {
      blocks.push({ type: 'text', text: rawBody })
    }
    return blocks
  },

  detectCompletion(rawBody: string): boolean {
    return rawBody.length > 0
  },

  getConfidence(rawBody: string): number {
    const hasData = rawBody.includes('data:')
    return hasData ? 0.6 : 0.3
  },
} as ParserModule
