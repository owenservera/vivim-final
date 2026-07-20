// src/storage/contracts/conversation-store.ts
// ConversationStore — data access contract for ConversationManager.
// Implements Prisma calls against conversation + conversation_message tables.

// ── Row types ──────────────────────────────────────────────────────────────

export interface ConversationRow {
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

export interface ConversationMessageRow {
  id: string
  conversationId: string
  role: string
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

export interface ProviderAccountRow {
  id: string
  providerId: string
  planTier: string
  displayName: string | null
  configJson: string
  createdAt: number
  updatedAt: number
}

// ── Input types ────────────────────────────────────────────────────────────

export interface ConversationInput {
  providerSessionId: string
  providerId: string
  title?: string | null
  state?: string
  contextJson?: string
}

export interface MessageInput {
  conversationId: string
  role: string
  content?: string
  blocksJson?: string
  blockCount?: number
  parentMessageId?: string
  sequenceIndex?: number
  latencyMs?: number
  tokenCount?: number
  model?: string
  metadataJson?: string
}

// ── Contract ───────────────────────────────────────────────────────────────

export interface MessageAttachmentRow {
  id: string
  messageId: string
  filename: string
  mimeType: string
  sizeBytes: number
  storagePath: string
  thumbnailPath: string | null
  metadataJson: string
  createdAt: number
}

export interface ConversationStore {
  getConversation(id: string): Promise<ConversationRow | null>
  /** Idempotently ensure a valid ProviderSession exists for (providerId, accountId). Optional on the contract; provided by ConversationStoreImpl. */
  ensureProviderSession?(input: { providerId: string; accountId?: string }): Promise<{ id: string }>
  createConversation(input: ConversationInput): Promise<ConversationRow>
  updateConversation(id: string, patch: Partial<ConversationRow>): Promise<void>
  deleteConversation(id: string): Promise<void>
  listConversations(opts?: {
    providerId?: string
    limit?: number
    offset?: number
  }): Promise<ConversationRow[]>
  createMessage(input: MessageInput): Promise<ConversationMessageRow>
  getMessage(id: string): Promise<ConversationMessageRow | null>
  getMessages(
    conversationId: string,
    opts?: { limit?: number; before?: string },
  ): Promise<ConversationMessageRow[]>
  getLastMessage(conversationId: string): Promise<ConversationMessageRow | null>
  updateMessage(
    id: string,
    patch: Partial<Pick<ConversationMessageRow, 'content' | 'blocksJson' | 'metadataJson'>>,
  ): Promise<void>
  getAccount(sessionId: string): Promise<ProviderAccountRow | null>
  createAttachment(input: {
    messageId: string
    filename: string
    mimeType: string
    sizeBytes: number
    storagePath: string
    thumbnailPath?: string
    metadataJson?: string
  }): Promise<MessageAttachmentRow>
  getAttachments(messageId: string): Promise<MessageAttachmentRow[]>
  getAttachment(id: string): Promise<MessageAttachmentRow | null>
  deleteAttachment(id: string): Promise<void>
}
