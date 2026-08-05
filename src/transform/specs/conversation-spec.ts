// src/transform/specs/conversation-spec.ts
// Conversation entity transformation spec.
// Maps ConversationRow + ConversationMessageRow (backend) to Conversation + Message (frontend domain).
//
// Key transformations:
//   - Numeric timestamps (epoch ms) → ISO date strings
//   - null → undefined
//   - blocksJson string → parsed blocks array
//   - metadataJson string → parsed metadata object
//   - Context JSON excluded (internal, not needed by frontend)

import type {
  ConversationMessageRow,
  ConversationRow,
} from '../../storage/contracts/conversation-store.js'
import type { EntityTransformSpec, FieldMapping } from '../types.js'
import { safeJsonParse, toISO } from '../types.js'

// ── Frontend domain shapes (mirrored for spec typing) ───────────────────────

export interface ConversationDomain {
  id: string
  title?: string
  providerId?: string
  state?: string
  messageCount?: number
  lastMessageAt?: string
  createdAt: string
  updatedAt?: string
}

export interface MessageDomain {
  id: string
  conversationId: string
  role: 'user' | 'assistant' | 'system'
  content: string
  blocks?: Array<Record<string, unknown>>
  blockCount?: number
  parentMessageId?: string
  sequenceIndex?: number
  latencyMs?: number
  tokenCount?: number
  model?: string
  metadata?: Record<string, unknown>
  createdAt: string
}

// ── Conversation spec ───────────────────────────────────────────────────────

const conversationFields: FieldMapping[] = [
  { from: 'id', to: 'id' },
  { from: 'title', to: 'title' },
  { from: 'providerId', to: 'providerId' },
  { from: 'state', to: 'state' },
  { from: 'messageCount', to: 'messageCount' },
  { from: 'lastMessageAt', to: 'lastMessageAt', transform: (v) => toISO(v as number | null) },
  {
    from: 'createdAt',
    to: 'createdAt',
    transform: (v) => toISO(v as number) ?? new Date().toISOString(),
  },
  { from: 'updatedAt', to: 'updatedAt', transform: (v) => toISO(v as number | null) },
  // Deprecated: providerSessionId was used in early versions for direct session linking.
  { from: 'providerSessionId', to: 'providerSessionId', deprecated: true },
]

export const conversationTransformSpec: EntityTransformSpec<ConversationRow, ConversationDomain> = {
  entity: 'conversation',
  fields: conversationFields,
  exclude: ['contextJson'], // Internal JSON blob, not needed by frontend.
  defaults: {
    state: 'active',
    messageCount: 0,
  },
}

// ── Message spec ────────────────────────────────────────────────────────────

const messageFields: FieldMapping[] = [
  { from: 'id', to: 'id' },
  { from: 'conversationId', to: 'conversationId' },
  { from: 'role', to: 'role' },
  { from: 'content', to: 'content', transform: (v) => (v as string | null) ?? '' },
  {
    from: 'blocksJson',
    to: 'blocks',
    transform: (v) => safeJsonParse<Array<Record<string, unknown>>>(v as string) ?? [],
  },
  { from: 'blockCount', to: 'blockCount' },
  { from: 'parentMessageId', to: 'parentMessageId' },
  { from: 'sequenceIndex', to: 'sequenceIndex' },
  { from: 'latencyMs', to: 'latencyMs' },
  { from: 'tokenCount', to: 'tokenCount' },
  { from: 'model', to: 'model' },
  {
    from: 'metadataJson',
    to: 'metadata',
    transform: (v) => safeJsonParse<Record<string, unknown>>(v as string),
  },
  {
    from: 'createdAt',
    to: 'createdAt',
    transform: (v) => toISO(v as number) ?? new Date().toISOString(),
  },
]

export const messageTransformSpec: EntityTransformSpec<ConversationMessageRow, MessageDomain> = {
  entity: 'message',
  fields: messageFields,
  defaults: {
    content: '',
    blocks: [],
    blockCount: 0,
    sequenceIndex: 0,
  },
}
