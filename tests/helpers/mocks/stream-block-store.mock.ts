// tests/helpers/mocks/stream-block-store.mock.ts
// Canonical mock for StreamBlockStore contract.
import { mock } from 'bun:test'
import type { StreamBlockStoreContract } from '../../../src/storage/contracts/stream-block-store.js'

export function createMockStreamBlockStore(
  overrides: Partial<StreamBlockStoreContract> = {},
): StreamBlockStoreContract {
  const byConv = new Map<string, any[]>()
  const byMsg = new Map<string, any[]>()

  return {
    storeBlocks: mock((conversationId: string, messageId: string, blocks: any[]) => {
      byConv.set(conversationId, (byConv.get(conversationId) ?? []).concat(blocks))
      byMsg.set(messageId, (byMsg.get(messageId) ?? []).concat(blocks))
    }),
    getBlocksByConversation: mock((conversationId: string) => byConv.get(conversationId) ?? []),
    getBlocksByMessage: mock((messageId: string) => byMsg.get(messageId) ?? []),
    ...overrides,
  } as unknown as StreamBlockStoreContract
}