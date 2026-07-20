// web/ui/src/features/chat/api.ts
// Thin fetch client for the conversation API. All calls go through the backend
// (One Entry Point invariant: the backend owns Chrome/provider execution).
//
// PRINCIPLE: FRONTEND = BACKEND
// Uses the shared api/client.ts which sets X-Source: frontend on every request.
// Types come from shared/api-types.ts — NO duplication.

import {
  type ChatAccount,
  type ChatAttachment,
  type ChatConversation,
  type ChatMessage,
  type ResolvedCapabilityDto,
  type SendResult,
  type StartResult,
  capabilityApi,
  conversationApi,
} from '../../api/client.js'

// Re-export types for backward compatibility
export type {
  ChatAccount,
  ChatConversation,
  ChatMessage,
  ChatAttachment,
  SendResult,
  StartResult,
  ResolvedCapabilityDto,
}

// ── Account operations ───────────────────────────────────────────────────────

export async function fetchAccounts(providerId: string): Promise<ChatAccount[]> {
  try {
    return await conversationApi.listAccounts(providerId)
  } catch {
    return []
  }
}

export async function upsertAccount(
  providerId: string,
  email: string,
  planTier = 'free',
): Promise<ChatAccount> {
  return conversationApi.upsertAccount(providerId, email, planTier)
}

// ── Conversation operations ──────────────────────────────────────────────────

export async function startConversation(
  providerId: string,
  accountEmail?: string,
): Promise<StartResult> {
  return conversationApi.start(providerId, accountEmail)
}

export async function listConversations(providerId: string): Promise<ChatConversation[]> {
  try {
    return await conversationApi.list(providerId)
  } catch {
    return []
  }
}

export async function fetchMessages(conversationId: string): Promise<ChatMessage[]> {
  try {
    return await conversationApi.getMessages(conversationId)
  } catch {
    return []
  }
}

export async function createConversation(
  providerId: string,
  accountId: string,
): Promise<ChatConversation> {
  return conversationApi.create(providerId, accountId)
}

// ── Capability operations ────────────────────────────────────────────────────

export async function fetchCapabilities(providerId: string): Promise<ResolvedCapabilityDto[]> {
  try {
    const data = await capabilityApi.list(providerId)
    return data.capabilities ?? []
  } catch {
    return []
  }
}

// ── Message operations ───────────────────────────────────────────────────────

export async function sendMessage(conversationId: string, message: string): Promise<SendResult> {
  return conversationApi.send(conversationId, message)
}

export async function editMessage(messageId: string, content: string): Promise<ChatMessage> {
  return conversationApi.editMessage(messageId, content)
}

export async function uploadAttachment(
  conversationId: string,
  messageId: string,
  file: File,
): Promise<ChatAttachment> {
  return conversationApi.uploadAttachment(conversationId, messageId, file)
}

export async function getAttachments(messageId: string): Promise<ChatAttachment[]> {
  return conversationApi.getAttachments(messageId)
}

export function downloadUrl(attachmentId: string): string {
  return conversationApi.downloadUrl(attachmentId)
}
