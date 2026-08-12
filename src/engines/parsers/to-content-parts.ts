// src/engines/parsers/to-content-parts.ts
//
// Adapter that normalizes a parsed provider export message into the
// canonical ContentPart[] model, so imported conversation history flows
// through the exact same ContentUnit / ContentPart decomposition as live
// chat (upgrade doc Gap 6 / backend-patches.md §3). This is what lets the
// frontend render an imported ChatGPT/Claude/Gemini export through the
// identical registry with no `if (source === 'import')` branch.

import type { ContentPart } from '../../schema/streaming.js'
import type { ParsedMessage } from './chatgpt-import.js'

export function toContentParts(msg: ParsedMessage): ContentPart[] {
  const parts: ContentPart[] = []

  if (msg.content && msg.content.length > 0) {
    parts.push({ type: 'text', text: msg.content, state: 'done' })
  }

  return parts
}
