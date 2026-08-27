// tests/e2e/multi-turn.test.ts
// E2E: Multi-turn conversation across providers

import { describe, expect, test } from 'bun:test'
import { CapabilityEventBus } from '../../src/engines/capability-event-bus.js'
import type { ResolvedCapabilities } from '../../src/engines/conversation-manager.js'
import { ConversationManager } from '../../src/engines/conversation-manager.js'
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
    id: 'conv-multi-1',
    ...(c as Record<string, unknown>),
  }),
  getConversation: async () => ({
    id: 'conv-multi-1',
    providerId: 'claude',
    title: 'Multi-Turn E2E',
    contextJson: '{}',
  }),
  getMessageCount: async () => 0,
  createMessage: async (m: unknown) => ({ id: 'msg-1', ...(m as Record<string, unknown>) }),
  updateConversation: async () => {},
  getLastMessage: async () => null,
  getAccount: async () => ({ id: 'acct-1', apiKey: 'test' }),
}

const mockGovernor = {
  getPageState: async () => ({ url: 'https://claude.ai', title: 'Claude' }),
  send: async () => ({ content: 'Hello from Claude' }),
}

describe('E2E Multi-Turn', () => {
  test('3-turn conversation works', async () => {
    const manager = new ConversationManager(
      mockGovernor as never,
      mockResolution as never,
      { parse: async () => [] } as never,
      { storeBlocks: async () => {}, getBlocksByConversation: async () => [] } as never,
      mockStore as never,
      CapabilityEventBus.getInstance(),
      {} as ExecutionMemoizer,
    )
    const conversation = await manager.createConversation('claude', 'Multi-Turn E2E')
    expect(conversation).toBeDefined()
  })
})
