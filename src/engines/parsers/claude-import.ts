// src/engines/parsers/claude-import.ts
// ClaudeExportParserImpl — parse Claude export format.

import type { ParsedConversation, ParsedMessage } from './chatgpt-import.js'

interface ClaudeRawMessage {
  sender: 'human' | 'assistant' | string
  text?: string
  content?: Array<{ text?: string; type?: string }> | string
  created_at: string | number
}

interface ClaudeRawConversation {
  uuid: string
  name: string
  created_at: string | number
  updated_at?: string | number
  chat_messages: ClaudeRawMessage[]
}

function parseTs(ts: string | number): number {
  if (typeof ts === 'number') return ts * 1000
  return new Date(ts).getTime()
}

function extractText(msg: ClaudeRawMessage): string {
  if (msg.text) return msg.text
  if (Array.isArray(msg.content)) {
    return msg.content.map(c => c.text ?? '').join('\n')
  }
  if (typeof msg.content === 'string') return msg.content
  return ''
}

export class ClaudeExportParserImpl {
  parse(rawJson: string): ParsedConversation[] {
    const data = JSON.parse(rawJson)
    const arr: ClaudeRawConversation[] = Array.isArray(data) ? data : []
    return arr.map(conv => this.parseConversation(conv))
  }

  private parseConversation(conv: ClaudeRawConversation): ParsedConversation {
    const messages: ParsedMessage[] = conv.chat_messages.map((m, i) => ({
      externalId: `${conv.uuid}_${i}`,
      role: m.sender === 'human' ? 'user' : m.sender === 'assistant' ? 'assistant' : 'user',
      content: extractText(m),
      createdAt: parseTs(m.created_at),
    }))

    return {
      externalId: conv.uuid,
      title: conv.name,
      source: 'claude',
      createdAt: parseTs(conv.created_at),
      updatedAt: conv.updated_at ? parseTs(conv.updated_at) : parseTs(conv.created_at),
      messages,
    }
  }
}
