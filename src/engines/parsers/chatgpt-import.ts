// src/engines/parsers/chatgpt-import.ts
// ChatGPTExportParser — parse ChatGPT conversations.json exports.

export interface ParsedMessage {
  externalId: string
  role: 'user' | 'assistant' | 'system'
  content: string
  model?: string
  createdAt: number
  parentExternalId?: string
}

export type ParserSource = 'chatgpt' | 'claude' | 'gemini' | 'generic'

export interface ParsedConversation {
  externalId: string
  title: string
  source: ParserSource
  createdAt: number
  updatedAt: number
  messages: ParsedMessage[]
}

export interface ChatGPTExportParser {
  parse(rawJson: string): ParsedConversation[]
}

interface ChatGPTRawContent {
  parts?: Array<string | { text?: string }>
  content_type?: string
}

interface ChatGPTRawAuthor {
  role: string
}

interface ChatGPTRawMessage {
  id: string
  author?: ChatGPTRawAuthor
  content?: ChatGPTRawContent
  model?: string
  create_time?: number
}

interface ChatGPTRawNode {
  id: string
  message: ChatGPTRawMessage | null
  parent: string | null
}

interface ChatGPTRawConversation {
  title: string
  create_time: number
  update_time?: number
  mapping: Record<string, ChatGPTRawNode>
}

export class ChatGPTExportParserImpl implements ChatGPTExportParser {
  parse(rawJson: string): ParsedConversation[] {
    const data = JSON.parse(rawJson) as ChatGPTRawConversation[]
    return data.map((conv) => this.parseConversation(conv))
  }

  private parseConversation(conv: ChatGPTRawConversation): ParsedConversation {
    const messages = Object.values(conv.mapping)
      .filter((node) => node.message)
      .map((node) => this.parseMessage(node))
      .sort((a, b) => a.createdAt - b.createdAt)

    return {
      externalId: `${conv.title}_${conv.create_time}`,
      title: conv.title,
      source: 'chatgpt',
      createdAt: conv.create_time * 1000,
      updatedAt: (conv.update_time ?? conv.create_time) * 1000,
      messages,
    }
  }

  private parseMessage(node: ChatGPTRawNode): ParsedMessage {
    const msg = node.message ?? {
      id: node.id,
      author: undefined,
      content: undefined,
      model: undefined,
    }
    const parts = msg.content?.parts ?? []
    const content = parts.filter((p): p is string => typeof p === 'string').join('\n')
    return {
      externalId: msg.id,
      role: (msg.author?.role as ParsedMessage['role']) ?? 'user',
      content,
      model: msg.model,
      createdAt: msg.create_time ? msg.create_time * 1000 : Date.now(),
    }
  }
}
