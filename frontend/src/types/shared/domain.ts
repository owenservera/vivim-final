// frontend/src/types/shared/domain.ts
// Domain model types for frontend use.
// These are the "view models" that UI components consume, transformed from
// backend Row types via the transformers in api/transformers.ts.
//
// Work Item 04: Storage contract alignment.

// ── Conversation domain model ────────────────────────────────────────────────

/** Frontend conversation model (timestamps as ISO strings, optional fields). */
export interface Conversation {
  id: string
  title?: string
  providerId?: string
  state?: string
  messageCount?: number
  lastMessageAt?: string
  createdAt: string
  updatedAt?: string
}

// ── Message domain model ────────────────────────────────────────────────────

export interface Message {
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

// ── Capability domain model (lightweight for UI lists) ────────────────────────

export interface Capability {
  id: string
  slug: string
  name: string
  description?: string
  surfaces?: string[]
  category?: string
  inputSchema?: unknown
  outputSchema?: unknown
  tags?: string[]
  requiresConfirmation?: boolean
}

// ── Provider domain model ───────────────────────────────────────────────────

export interface Provider {
  id: string
  slug: string
  displayName: string
  description?: string
  category?: string
  providerType?: string
  isActive?: boolean
  protocolStatus?: string
  websiteUrl?: string
  createdAt?: string
  updatedAt?: string
  // Computed / denormalized fields used by UI components
  name?: string
  status?: string
  capabilities?: string[]
}
