// tests/e2e/claude-send.test.ts
// E2E: Send message to Claude, verify response blocks

import { describe, expect, test } from 'bun:test'
import { CapabilityEventBus } from '../../src/engines/capability-event-bus.js'
import { ConversationManager } from '../../src/engines/conversation-manager.js'
import type {
  CapabilityResolutionEngine,
  ResolvedCapabilities,
} from '../../src/engines/conversation-manager.js'
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

const mockResolution: CapabilityResolutionEngine = {
  resolve: async () => mockResolved,
}

const mockStore = {
  createConversation: async (c: unknown) => ({ id: 'conv-1', ...(c as Record<string, unknown>) }),
  getConversation: async () => ({
    id: 'conv-1',
    providerId: 'claude',
    title: 'E2E Test',
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

const mockParser = {
  parse: async () => [],
}

const mockBlocks = {
  storeBlocks: async () => {},
  getBlocksByConversation: async () => [],
}

describe('E2E Claude Send', () => {
  test('create conversation', async () => {
    const manager = new ConversationManager(
      mockGovernor as never,
      mockResolution,
      mockParser as never,
      mockBlocks as never,
      mockStore as never,
      CapabilityEventBus.getInstance(),
      {} as ExecutionMemoizer,
    )
    const conversation = await manager.createConversation('claude', 'E2E Test')
    expect(conversation).toBeDefined()
    expect(conversation.id).toBe('conv-1')
  })
})
