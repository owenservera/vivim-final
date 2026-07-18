// seeds/adapters/claude.ts
// Claude import adapter — parse Claude export JSON format.
//
// Claude export format: JSON array of conversation objects with:
//   { uuid, name, chat_messages: [{ sender, text, uuid, created_at }] }
// Or wrapped as: { conversations: [...] }

import type { NormalizedConversation, NormalizedMessage } from './chatgpt.js'

interface ClaudeConversation {
  uuid?: string
  id?: string
  name?: string
  title?: string
  created_at?: string
  updated_at?: string
  chat_messages?: ClaudeMessage[]
  messages?: ClaudeMessage[]
}

interface ClaudeMessage {
  uuid?: string
  id?: string
  sender?: string
  role?: string
  text?: string
  content?: string
  message?: { content?: Array<{ text?: string; type?: string }> }
  created_at?: string
  index?: number
  attachments?: Array<{ file_name?: string; file_type?: string }>
}

interface ClaudeExportRoot {
  conversations?: ClaudeConversation[]
  accounts?: ClaudeConversation[]
  chats?: ClaudeConversation[]
}

export function isClaudeExport(data: unknown): boolean {
  if (!Array.isArray(data) && typeof data !== 'object') return false
  if (data === null) return false

  const root = data as Record<string, unknown>
  if (root.conversations || root.accounts || root.chats) return true

  const arr = Array.isArray(data) ? data : []
  if (arr.length === 0) return true
  const first = arr[0] as Record<string, unknown>
  return ('chat_messages' in first || 'uuid' in first) && !('mapping' in first)
}

export function parseClaude(raw: unknown): NormalizedConversation[] {
  let conversations: ClaudeConversation[] = []

  if (Array.isArray(raw)) {
    conversations = raw as ClaudeConversation[]
  } else if (typeof raw === 'object' && raw !== null) {
    const root = raw as ClaudeExportRoot
    conversations = root.conversations ?? root.accounts ?? root.chats ?? []
  }

  const results: NormalizedConversation[] = []

  for (const conv of conversations) {
    const externalId = String(conv.uuid ?? conv.id ?? '')
    const messages = conv.chat_messages ?? conv.messages ?? []
    const title = conv.name ?? conv.title

    const normalized: NormalizedMessage[] = messages.map((m, i) => {
      // Claude sender values: 'human' | 'assistant' | 'system'
      let role = m.sender ?? m.role ?? 'human'
      if (role === 'human') role = 'user'

      let content = m.text ?? m.content ?? ''

      // Handle nested message.content array
      if (!content && m.message?.content) {
        content = m.message.content.map((c) => c.text ?? '').join('\n')
      }

      return {
        role,
        content,
        index: m.index ?? i,
      }
    })

    results.push({
      externalId,
      title,
      messages: normalized.length > 0 ? normalized : [],
    })
  }

  return results
}
