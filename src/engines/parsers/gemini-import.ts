// src/engines/parsers/gemini-import.ts
// GeminiExportParserImpl — parse Google Gemini conversation exports.

import type { ParsedConversation, ParsedMessage } from './chatgpt-import.js'

interface GeminiRawMessage {
  author: 'user' | 'model' | string
  content: string
  timestamp?: string | number
}

interface GeminiRawConversation {
  id: string
  title?: string
  messages: GeminiRawMessage[]
}

export class GeminiExportParserImpl {
  parse(rawJson: string): ParsedConversation[] {
    const data = JSON.parse(rawJson)
    const arr: GeminiRawConversation[] = Array.isArray(data) ? data : []
    return arr.map((conv) => this.parseConversation(conv))
  }

  private parseConversation(conv: GeminiRawConversation): ParsedConversation {
    const messages: ParsedMessage[] = conv.messages.map((m, i) => ({
      externalId: `${conv.id}_${i}`,
      role: m.author === 'model' ? 'assistant' : 'user',
      content: m.content,
      createdAt:
        typeof m.timestamp === 'number'
          ? m.timestamp
          : m.timestamp
            ? new Date(m.timestamp).getTime()
            : Date.now(),
    }))

    const ts = messages.length > 0 && messages[0]?.createdAt ? messages[0]?.createdAt : Date.now()
    return {
      externalId: conv.id,
      title: conv.title ?? '',
      source: 'gemini',
      createdAt: ts,
      updatedAt: ts,
      messages,
    }
  }
}
