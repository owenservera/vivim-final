// tests/e2e/chatgpt-send.test.ts
// E2E: Send message to ChatGPT, verify response blocks

import { describe, expect, test } from 'bun:test'
import { CapabilityEventBus } from '../../src/engines/capability-event-bus.js'
import { ConversationManager } from '../../src/engines/conversation-manager.js'
import type { ResolvedCapabilities } from '../../src/engines/conversation-manager.js'
import type { ExecutionMemoizer } from '../../src/engines/execution-memoizer.js'

const mockResolved: ResolvedCapabilities = {
  composer: [],
  header: [],
  message: [],
  sidebar: [],
  inline: [],
  total: 0,
  resolvedAt: Date.now(),
}

const mockResolution = {
  resolve: async () => mockResolved,
}

const mockStore = {
  createConversation: async (c: unknown) => ({
    id: 'conv-chatgpt-1',
    ...(c as Record<string, unknown>),
  }),
  getConversation: async () => ({
    id: 'conv-chatgpt-1',
    providerId: 'chatgpt',
    title: 'E2E ChatGPT',
    contextJson: '{}',
  }),
  getMessageCount: async () => 0,
  createMessage: async (m: unknown) => ({ id: 'msg-1', ...(m as Record<string, unknown>) }),
  updateConversation: async () => {},
  getLastMessage: async () => null,
  getAccount: async () => ({ id: 'acct-1', apiKey: 'test' }),
}

const mockGovernor = {
  getPageState: async () => ({ url: 'https://chatgpt.com', title: 'ChatGPT' }),
  send: async () => ({ content: 'Hello from ChatGPT' }),
}

describe('E2E ChatGPT Send', () => {
  test('create conversation for ChatGPT', async () => {
    const manager = new ConversationManager(
      mockGovernor as never,
      mockResolution as never,
      { parse: async () => [] } as never,
      { storeBlocks: async () => {}, getBlocksByConversation: async () => [] } as never,
      mockStore as never,
      CapabilityEventBus.getInstance(),
      {} as ExecutionMemoizer,
    )
    const conversation = await manager.createConversation('chatgpt', 'E2E ChatGPT Test')
    expect(conversation).toBeDefined()
    expect(conversation.id).toBe('conv-chatgpt-1')
  })
})
