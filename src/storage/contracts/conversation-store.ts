// src/storage/contracts/conversation-store.ts
// ConversationStore — data access contract for ConversationManager.
// Implements Prisma calls against conversation + conversation_message tables.

// ── Row types ──────────────────────────────────────────────────────────────

export interface ConversationRow {
  id: string
  providerSessionId: string | null
  providerId: string
  accountId: string | null
  title: string | null
  state: string
  messageCount: number
  lastMessageAt: number | null
  contextJson: string
  createdAt: number
  updatedAt: number
  projectId?: string | null
  topicId?: string | null
  source: string
  externalId: string | null
  importJobId: string | null
  syncedAt: number | null
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
  email: string
  planTier: string
  isDefault: number
  isKind: number
  loginState: string
  loginAttempts: number
  lastLoginAt: number | null
  providerStateJson: string
  debugPort: number | null
  profileDir: string | null
  chromeSlaveId: string | null
  userId: string
  createdAt: number
  updatedAt: number
}

// ── Input types ────────────────────────────────────────────────────────────

export interface ConversationInput {
  providerSessionId?: string // Optional for history-synced conversations
  providerId: string
  accountId?: string // Direct account link for sync queries
  title?: string | null
  state?: string
  contextJson?: string
  source?: string // 'live' | 'history-sync' | 'import'
  externalId?: string // Provider's native conversation ID
  importJobId?: string
  syncedAt?: number // Last sync timestamp
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

  // ── History Sync Methods ──────────────────────────────────────────────────

  /** Get a conversation by external provider ID (for idempotent upsert) */
  getConversationByExternalId(
    externalId: string,
    providerId: string,
  ): Promise<ConversationRow | null>

  /** Upsert a conversation by external ID (idempotent sync operation) */
  upsertConversationByExternalId(
    input: ConversationInput & { externalId: string },
  ): Promise<ConversationRow>

  /** List conversations by account ID (direct query, no ProviderSession join) */
  listConversationsByAccountId(
    accountId: string,
    opts?: {
      limit?: number
      offset?: number
      source?: string
    },
  ): Promise<ConversationRow[]>

  /** Batch create messages for efficient sync */
  createMessages(inputs: MessageInput[]): Promise<ConversationMessageRow[]>

  // ── Message Methods ───────────────────────────────────────────────────────

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

// ── Sync State Types ───────────────────────────────────────────────────────

export interface ConversationSyncStateRow {
  id: string
  providerId: string
  accountId: string
  syncType: string
  status: string
  cursorJson: string
  totalConversations: number
  syncedConversations: number
  failedConversations: number
  lastSyncedAt: number | null
  nextSyncAt: number | null
  errorJson: string | null
  configJson: string
  createdAt: number
  updatedAt: number
}

export interface ConversationSyncLogRow {
  id: string
  providerId: string
  accountId: string
  syncType: string
  status: string
  startedAt: number
  completedAt: number | null
  durationMs: number | null
  conversationsFound: number
  conversationsSynced: number
  conversationsFailed: number
  errorJson: string | null
  metadataJson: string
}

// ── Sync State Contract ────────────────────────────────────────────────────

export interface ConversationSyncStateStore {
  /** Get sync state for a provider account */
  getSyncState(providerId: string, accountId: string): Promise<ConversationSyncStateRow | null>

  /** Upsert sync state (create or update) */
  upsertSyncState(input: {
    providerId: string
    accountId: string
    syncType?: string
    status?: string
    cursorJson?: string
    totalConversations?: number
    syncedConversations?: number
    failedConversations?: number
    errorJson?: string
    configJson?: string
  }): Promise<ConversationSyncStateRow>

  /** Update sync status */
  updateSyncStatus(
    providerId: string,
    accountId: string,
    status: string,
    error?: string,
  ): Promise<ConversationSyncStateRow>

  /** Increment sync progress counters */
  incrementSyncProgress(
    providerId: string,
    accountId: string,
    synced: number,
    failed: number,
  ): Promise<ConversationSyncStateRow>

  /** Get all pending syncs */
  getPendingSyncs(): Promise<ConversationSyncStateRow[]>

  /** Delete sync state */
  deleteSyncState(providerId: string, accountId: string): Promise<void>

  // ── Sync Log Methods ────────────────────────────────────────────────────

  /** Create a sync log entry */
  createSyncLog(input: {
    providerId: string
    accountId: string
    syncType: string
    status: string
  }): Promise<ConversationSyncLogRow>

  /** Update sync log on completion */
  updateSyncLog(
    id: string,
    input: {
      status: string
      completedAt?: number
      durationMs?: number
      conversationsFound?: number
      conversationsSynced?: number
      conversationsFailed?: number
      errorJson?: string
    },
  ): Promise<ConversationSyncLogRow>

  /** Get sync logs for an account */
  getSyncLogs(
    providerId: string,
    accountId: string,
    opts?: { limit?: number; offset?: number },
  ): Promise<ConversationSyncLogRow[]>
}
