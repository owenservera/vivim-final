// frontend/src/api/transformers.ts
// Transform backend Row types into frontend domain models.
// Handles timestamp conversion, null→undefined, JSON string parsing, etc.
//
// Work Item 04: Storage contract alignment + transformation layer.

import { toISO } from '@/lib/timestamp'
import type {
  CapabilityDetail,
  ConversationDetail,
  ConversationMessageDetail,
  ProviderDetail,
} from '@/types/shared/api-contract'
import type { Capability, Conversation, Message, Provider } from '@/types/shared/domain'

// ── Conversation transformers ───────────────────────────────────────────────

/**
 * Transform a backend ConversationDetail (Row) into a frontend Conversation domain model.
 * - Converts numeric timestamps to ISO strings
 * - Converts null fields to undefined where appropriate
 */
export function transformConversation(row: ConversationDetail): Conversation {
  return {
    id: row.id,
    title: row.title ?? undefined,
    providerId: row.providerId,
    state: row.state,
    messageCount: row.messageCount,
    lastMessageAt: toISO(row.lastMessageAt),
    createdAt: toISO(row.createdAt) ?? new Date().toISOString(),
    updatedAt: toISO(row.updatedAt),
  }
}

/**
 * Transform an array of backend ConversationDetail rows.
 */
export function transformConversations(rows: ConversationDetail[]): Conversation[] {
  return rows.map(transformConversation)
}

// ── Message transformers ─────────────────────────────────────────────────────

/**
 * Parse a JSON string safely, returning undefined on failure.
 */
function safeJsonParse<T>(json: string): T | undefined {
  try {
    return JSON.parse(json) as T
  } catch {
    return undefined
  }
}

/**
 * Transform a backend ConversationMessageDetail (Row) into a frontend Message domain model.
 * - Parses blocksJson string into array
 * - Parses metadataJson string into object
 * - Converts numeric timestamps to ISO strings
 */
export function transformMessage(row: ConversationMessageDetail): Message {
  return {
    id: row.id,
    conversationId: row.conversationId,
    role: row.role as Message['role'],
    content: row.content ?? '',
    blocks: safeJsonParse<Array<Record<string, unknown>>>(row.blocksJson) ?? [],
    blockCount: row.blockCount,
    parentMessageId: row.parentMessageId ?? undefined,
    sequenceIndex: row.sequenceIndex,
    latencyMs: row.latencyMs ?? undefined,
    tokenCount: row.tokenCount ?? undefined,
    model: row.model ?? undefined,
    metadata: safeJsonParse<Record<string, unknown>>(row.metadataJson),
    createdAt: toISO(row.createdAt) ?? new Date().toISOString(),
  }
}

/**
 * Transform an array of backend ConversationMessageDetail rows.
 */
export function transformMessages(rows: ConversationMessageDetail[]): Message[] {
  return rows.map(transformMessage)
}

// ── Capability transformers ──────────────────────────────────────────────────

/**
 * Transform a backend CapabilityDetail into a lightweight frontend Capability model.
 * Filters out internal fields that the UI doesn't need.
 */
export function transformCapability(detail: CapabilityDetail): Capability {
  return {
    id: detail.id,
    slug: detail.slug,
    name: detail.name,
    description: detail.description ?? undefined,
    surfaces: detail.surfaces,
    category: detail.category,
    inputSchema: detail.inputSchema,
    outputSchema: detail.outputSchema,
    tags: detail.tags,
    requiresConfirmation: detail.requiresConfirmation,
  }
}

/**
 * Transform an array of backend CapabilityDetail objects.
 */
export function transformCapabilities(details: CapabilityDetail[]): Capability[] {
  return details.map(transformCapability)
}

// ── Provider transformers ───────────────────────────────────────────────────

/**
 * Transform a backend ProviderDetail into a frontend Provider domain model.
 */
export function transformProvider(detail: ProviderDetail): Provider {
  return {
    id: detail.id,
    slug: detail.slug,
    displayName: detail.displayName,
    description: detail.description ?? undefined,
    category: detail.category,
    providerType: detail.providerType,
    isActive: detail.isActive === 1,
    protocolStatus: detail.protocolStatus,
    websiteUrl: detail.websiteUrl ?? undefined,
    createdAt: toISO(detail.createdAt),
    updatedAt: toISO(detail.updatedAt),
  }
}

/**
 * Transform an array of backend ProviderDetail objects.
 */
export function transformProviders(details: ProviderDetail[]): Provider[] {
  return details.map(transformProvider)
}
