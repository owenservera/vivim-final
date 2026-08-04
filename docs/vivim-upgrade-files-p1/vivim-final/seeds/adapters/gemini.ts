// seeds/adapters/gemini.ts
// Gemini import adapter — parse Google Takeout Gemini JSON export.
//
// Google Takeout Gemini export format: JSON array of conversation objects:
//   [{ conversationId, title, messages: [{ author, content, timestamp }] }]

import type { NormalizedConversation, NormalizedMessage } from './chatgpt.js'

interface GeminiConversation {
  conversationId?: string
  id?: string
  title?: string
  messages?: GeminiMessage[]
  timestamp?: string
}

interface GeminiMessage {
  author?: string
  role?: string
  content?: string
  text?: string
  timestamp?: string
  index?: number
}

export function isGeminiExport(data: unknown): boolean {
  if (!Array.isArray(data)) return false
  if (data.length === 0) return true
  const first = data[0] as Record<string, unknown>
  // Gemini exports have conversationId (singular) unlike ChatGPT's conversation_id
  return (
    (typeof first.conversationId === 'string' || typeof first.messages === 'object') &&
    typeof first.mapping !== 'object'
  )
}

export function parseGemini(raw: unknown): NormalizedConversation[] {
  if (!Array.isArray(raw)) return []

  const conversations = raw as GeminiConversation[]
  const results: NormalizedConversation[] = []

  for (const conv of conversations) {
    const externalId = String(conv.conversationId ?? conv.id ?? '')
    const messages = conv.messages ?? []

    const normalized: NormalizedMessage[] = messages.map((m, i) => ({
      role: (m.author ?? m.role ?? 'user').toLowerCase() === 'model' ? 'assistant' : 'user',
      content: m.content ?? m.text ?? '',
      index: m.index ?? i,
    }))

    results.push({
      externalId,
      title: conv.title,
      messages: normalized,
    })
  }

  return results
}
