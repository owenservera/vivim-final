// src/engines/provider-conversation-adapter.ts
// Provider Conversation Adapter — unified interface for fetching conversation
// history from provider REST/RPC APIs. Each provider (ChatGPT, Gemini, Claude,
// DeepSeek) implements this interface to normalize their API differences.
//
// Phase 1 of Conversation History Sync feature.

// ── Data types returned by adapters ─────────────────────────────────────────

/**
 * A conversation header — lightweight metadata returned by list/search APIs.
 * Maps to the "conversation list" view (title, date, message count).
 */
export interface ConversationHeader {
  /** Provider-native conversation ID (e.g. ChatGPT's `uuid`, Claude's `chatId`). */
  id: string
  /** Conversation title as shown in the provider UI. */
  title: string
  /** Last updated timestamp (Unix ms). Used for incremental sync ordering. */
  updatedAt: number
  /** Creation timestamp (Unix ms). */
  createdAt?: number
  /** Number of messages in the conversation (if reported by the API). */
  messageCount?: number
  /** Model used for the last assistant response (if available). */
  model?: string
  /** Provider-specific metadata not captured by other fields. */
  metadata?: Record<string, unknown>
}

/**
 * A single message within a conversation.
 */
export interface ConversationMessage {
  /** Provider-native message ID. */
  id: string
  /** Parent message ID for threaded/DAG conversations (e.g. ChatGPT). Null for root messages. */
  parentId: string | null
  role: 'user' | 'assistant' | 'system'
  /** Message text content. May be null for messages that only contain artifacts. */
  content: string | null
  /** Timestamp (Unix ms). */
  timestamp: number
  /** Model used for this message (assistant messages only). */
  model?: string
  /** Extracted artifacts (code blocks, images, files). */
  artifacts?: ConversationArtifact[]
  /** Provider-specific metadata (e.g. ChatGPT's `author.name`, `recipient`). */
  metadata?: Record<string, unknown>
}

/**
 * An artifact extracted from a message (code block, image, file attachment).
 */
export interface ConversationArtifact {
  kind: 'code' | 'image' | 'file' | 'audio' | 'video'
  /** For code: the language. For images: MIME type. For files: filename. */
  label: string
  /** The raw content or URL. */
  content?: string
  /** URL for remote resources (images, files). */
  url?: string
  /** Byte size for files (if known). */
  sizeBytes?: number
}

/**
 * A full conversation with all messages — returned by getConversation().
 */
export interface ConversationFull {
  id: string
  title: string
  /** Messages in display order (newest-last for linear, DAG-flattened for ChatGPT). */
  messages: ConversationMessage[]
  /** Conversation-level metadata (model, sharing status, etc.). */
  metadata?: Record<string, unknown>
}

/**
 * Generic paginated result from provider APIs.
 */
export interface PaginatedResult<T> {
  items: T[]
  /** Cursor for the next page. Undefined means no more pages. */
  nextCursor?: string
  /** Total count (if reported by the API). */
  total?: number
}

// ── Adapter interface ───────────────────────────────────────────────────────

/**
 * Provider-specific conversation adapter. Each provider implements this
 * interface to normalize their conversation API into the common format.
 *
 * Adapters do NOT handle auth — they receive a pre-extracted auth context
 * (bearer token, cookies, etc.) from the auth extraction layer.
 */
export interface ProviderConversationAdapter {
  /** Provider slug (e.g. 'chatgpt', 'gemini', 'claude', 'deepseek'). */
  readonly providerId: string

  /**
   * List conversations for an account, ordered by last-updated descending.
   * Supports cursor-based pagination for incremental sync.
   *
   * @param accountId - The provider account identifier (email or internal ID).
   * @param authContext - Pre-extracted auth (bearer token, cookies).
   * @param opts - Pagination options (cursor, limit).
   * @returns Paginated list of conversation headers.
   */
  listConversations(
    accountId: string,
    authContext: AuthContext,
    opts?: { cursor?: string; limit?: number },
  ): Promise<PaginatedResult<ConversationHeader>>

  /**
   * Fetch a single conversation with all messages.
   * Used for full sync of individual conversations.
   *
   * @param accountId - The provider account identifier.
   * @param authContext - Pre-extracted auth.
   * @param conversationId - The provider-native conversation ID.
   * @returns Full conversation with messages, or null if not found.
   */
  getConversation(
    accountId: string,
    authContext: AuthContext,
    conversationId: string,
  ): Promise<ConversationFull | null>

  /**
   * Search conversations by query string.
   * Returns matching headers (without messages).
   *
   * @param accountId - The provider account identifier.
   * @param authContext - Pre-extracted auth.
   * @param query - Search query string.
   * @returns Matching conversation headers.
   */
  searchConversations(
    accountId: string,
    authContext: AuthContext,
    query: string,
  ): Promise<ConversationHeader[]>
}

// ── Auth context (passed to adapters) ───────────────────────────────────────

/**
 * Pre-extracted authentication context for a provider account.
 * Created by the auth extraction layer (Phase 2) and passed to adapters.
 */
export interface AuthContext {
  /** Bearer token (ChatGPT, Claude) or session token. */
  bearerToken?: string
  /** Cookies to attach to requests (alternative to bearer). */
  cookies?: Array<{ name: string; value: string; domain: string }>
  /** Custom headers required by the provider. */
  headers?: Record<string, string>
  /** When the auth context expires (Unix ms). Undefined = unknown. */
  expiresAt?: number
}

// ── Error types ─────────────────────────────────────────────────────────────

/**
 * Adapter-specific errors. Distinguishes between auth failures, rate limits,
 * and transient network errors so the sync engine can handle each appropriately.
 */
export class AdapterError extends Error {
  constructor(
    message: string,
    public readonly providerId: string,
    public readonly code: AdapterErrorCode,
    public readonly retryable: boolean = false,
    public readonly retryAfterMs?: number,
    cause?: unknown,
  ) {
    super(message, { cause })
    this.name = 'AdapterError'
  }
}

export type AdapterErrorCode =
  | 'AUTH_EXPIRED'
  | 'AUTH_INVALID'
  | 'RATE_LIMITED'
  | 'NOT_FOUND'
  | 'NETWORK_ERROR'
  | 'PARSE_ERROR'
  | 'UNKNOWN'
