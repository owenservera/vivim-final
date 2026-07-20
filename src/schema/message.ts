// src/schema/message.ts
// MessageEnvelope + ConversationNode data types.
// Data payload schemas for 'cap-store.message' and 'cap-store.conversation' nodes.

import { z } from 'zod'
import { type ContentPart, ContentPartSchema } from './streaming.js'

// ── MessageEnvelope (data payload for cap-store.message nodes) ────────────
// Requirements: immutable id (NodeBase.id), parentId for forking,
// rawSource for remux, parseVersion for telemetry.

export interface MessageData {
  role: 'system' | 'user' | 'assistant' | 'tool'
  parts: ContentPart[]
  rawSource?: string
  parseVersion: number
  model?: string
  finishReason?: string
  metadata?: Record<string, unknown>
}

export const MessageDataSchema = z.object({
  role: z.enum(['system', 'user', 'assistant', 'tool']),
  parts: z.array(ContentPartSchema),
  rawSource: z.string().optional(),
  parseVersion: z.number().int().positive().default(1),
  model: z.string().optional(),
  finishReason: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
})

// ── ConversationData (data payload for cap-store.conversation nodes) ──────

export interface ConversationData {
  title?: string
  provider?: string
  model?: string
  messageIds: string[]
  importedFrom?: 'chatgpt' | 'claude' | 'gemini' | 'manual' | 'live'
  importBatchId?: string
  metadata?: Record<string, unknown>
}

export const ConversationDataSchema = z.object({
  title: z.string().optional(),
  provider: z.string().optional(),
  model: z.string().optional(),
  messageIds: z.array(z.string()),
  importedFrom: z.enum(['chatgpt', 'claude', 'gemini', 'manual', 'live']).optional(),
  importBatchId: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
})

// ── Node schemas for registration ─────────────────────────────────────────

export const messageNodeSchema = {
  type: 'cap-store.message' as const,
  version: 1,
  schema: MessageDataSchema,
  indexContent: (data: MessageData) => extractTextFromParts(data.parts),
  embeddingText: (data: MessageData) => extractTextFromParts(data.parts),
}

export const conversationNodeSchema = {
  type: 'cap-store.conversation' as const,
  version: 1,
  schema: ConversationDataSchema,
  indexContent: (data: ConversationData) => data.title ?? data.messageIds.join(', '),
  embeddingText: (data: ConversationData) => data.title ?? '',
}

function extractTextFromParts(parts: ContentPart[]): string {
  const pieces: string[] = []
  for (const p of parts) {
    if (p.type === 'text' && typeof p.text === 'string') pieces.push(p.text)
    if (p.type === 'reasoning' && typeof p.text === 'string') pieces.push(p.text)
    if (p.type === 'code') pieces.push(p.text)
  }
  return pieces.join('\n')
}
