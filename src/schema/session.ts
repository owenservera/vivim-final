// src/schema/session.ts
// Session and conversation domain types.

export type SessionState = 'active' | 'idle' | 'suspended' | 'closed'

export type MessageRole = 'user' | 'assistant' | 'system' | 'tool'

export interface VivimSession {
  id: string
  state: SessionState
  contextJson: string
  createdAt: number
  updatedAt: number
}

export interface ProviderSession {
  id: string
  vivimSessionId: string
  providerId: string
  accountId: string
  state: string
  contextJson: string
  createdAt: number
  updatedAt: number
}

export interface ProfileSession {
  id: string
  providerSessionId: string
  profileDir: string
  chromeSlaveId: string | null
  state: string
  port: number | null
  createdAt: number
  updatedAt: number
}

export interface Conversation {
  id: string
  providerSessionId: string
  providerId: string
  title: string | null
  state: string
  messageCount: number
  lastMessageAt: number | null
  contextJson: string
  createdAt: number
  updatedAt: number
}

export interface ConversationMessage {
  id: string
  conversationId: string
  role: MessageRole
  content: string | null
  blocksJson: string
  blockCount: number
  parentMessageId: string | null
  sequenceIndex: number
  latencyMs: number | null
  tokenCount: number | null
  model: string | null
  metadataJson: string
  createdAt: number
}
