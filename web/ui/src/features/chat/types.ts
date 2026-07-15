// web/ui/src/features/chat/types.ts
// Shared types for the multi-turn chat feature.
// API shapes are canonical in ../../api/client.ts — re-exported here so feature
// code imports from one place. ChatMessage adds UI-only transient fields.

import type {
  ChatAccount,
  ChatAttachment,
  ChatConversation,
  SendResult,
  StartResult,
} from '../../api/client.js'

export type { ChatAccount, ChatAttachment, ChatConversation, SendResult, StartResult }

export type ChatRole = 'user' | 'assistant' | 'system'

export interface ChatMessage {
  id: string
  role: ChatRole
  content: string
  blocksJson?: string
  attachments?: ChatAttachment[]
  createdAt?: number
  editing?: boolean
}

// Re-export the API ChatMessage shape for callers that need the wire form.
export type { ChatMessage as ApiChatMessage } from '../../api/client.js'
