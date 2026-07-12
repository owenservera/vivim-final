// tests/helpers/mocks/conversation-store.mock.ts
// Canonical mock for ConversationStore contract.
import { mock } from 'bun:test'
import type {
  ConversationStore,
  ConversationRow,
  ConversationMessageRow,
} from '../../../src/storage/contracts/conversation-store.js'

export function createMockConversationStore(overrides: Partial<ConversationStore> = {}): ConversationStore {
  const conversations = new Map<string, ConversationRow>()
  const messages = new Map<string, ConversationMessageRow[]>()

  return {
    getConversation: mock((id: string) => conversations.get(id) ?? null),
    createConversation: mock((input) => {
      const row: ConversationRow = {
        id: crypto.randomUUID(),
        providerSessionId: input.providerSessionId,
        providerId: input.providerId,
        title: input.title ?? null,
        state: input.state ?? 'active',
        messageCount: 0,
        lastMessageAt: null,
        contextJson: input.contextJson ?? '{}',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }
      conversations.set(row.id, row)
      return row
    }),
    updateConversation: mock(() => {}),
    deleteConversation: mock(() => {}),
    listConversations: mock(() => [...conversations.values()]),
    createMessage: mock((input) => {
      const msg: ConversationMessageRow = {
        id: crypto.randomUUID(),
        conversationId: input.conversationId,
        role: input.role,
        content: input.content ?? null,
        blocksJson: input.blocksJson ?? '[]',
        blockCount: input.blockCount ?? 0,
        parentMessageId: input.parentMessageId ?? null,
        sequenceIndex: input.sequenceIndex ?? 0,
        latencyMs: input.latencyMs ?? null,
        tokenCount: input.tokenCount ?? null,
        model: input.model ?? null,
        metadataJson: input.metadataJson ?? '{}',
        createdAt: Date.now(),
      }
      const list = messages.get(input.conversationId) ?? []
      list.push(msg)
      messages.set(input.conversationId, list)
      return msg
    }),
    getMessage: mock(() => null),
    getMessages: mock((id: string) => messages.get(id) ?? []),
    getLastMessage: mock(() => null),
    getAccount: mock(() => null),
    ...overrides,
  } as ConversationStore
}