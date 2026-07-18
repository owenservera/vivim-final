// tests/integration/engines/conversation-manager.test.ts
// Integration test for M2: navigation targets the persisted provider conversation URL on turn 2+.
// Records every Page.navigate issued against the mock cdp and asserts the turn-1 (root) → turn-2
// (persisted conversation url) sequence.

import { describe, expect, it, mock } from 'bun:test'
import type { ChromeGovernor } from '../../../src/engines/chrome-governor.js'
import { ConversationManager } from '../../../src/engines/conversation-manager.js'
import type {
  CapabilityEventBus,
  CapabilityResolutionEngine,
  StreamBlockStore,
  StreamParserEngine,
} from '../../../src/engines/conversation-manager.js'
import type { ExecutionMemoizer } from '../../../src/engines/execution-memoizer.js'
import type {
  ConversationRow,
  ConversationStore,
  ProviderAccountRow,
} from '../../../src/storage/contracts/conversation-store.js'

const PERSISTED_URL = 'https://claude.ai/chat/abc-123-uuid'

function makeConv(overrides?: Partial<ConversationRow>): ConversationRow {
  return {
    id: 'conv_1',
    providerSessionId: 'session_1',
    providerId: 'claude',
    title: 'Test',
    state: 'active',
    messageCount: 0,
    lastMessageAt: null,
    contextJson: '{}',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  }
}

function makeAccount(): ProviderAccountRow {
  return {
    id: 'acct_1',
    providerId: 'claude',
    planTier: 'pro',
    displayName: 'Test',
    configJson: '{}',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }
}

function mockResolution(): CapabilityResolutionEngine {
  return {
    resolve: mock(async () => ({
      composer: [
        {
          capabilityId: 'cap_1',
          selector: 'textarea',
          label: 'Composer',
          kind: 'composer',
          priority: 1,
          configJson: '{}',
        },
      ],
      header: [],
      message: [],
      sidebar: [],
      inline: [],
      total: 1,
      resolvedAt: Date.now(),
    })),
    search: mock(async () => []),
    buildResult: mock(),
    mapRow: mock(),
  } as unknown as CapabilityResolutionEngine
}

function mockParser(): StreamParserEngine {
  return {
    parse: mock(async () => ({
      blocks: [{ kind: 'text', content: 'Hi', index: 0 }],
      confidence: 0.9,
      parserName: 't',
      parserVersion: 1,
      durationMs: 1,
    })),
    detectCompletion: mock(async () => true),
    reloadParser: mock(async () => {}),
    preloadAll: mock(async () => {}),
  } as unknown as StreamParserEngine
}

function mockBlockStore(): StreamBlockStore {
  return {
    storeBlocks: mock(async () => {}),
    getBlocksByConversation: mock(async () => []),
    getBlocksByMessage: mock(async () => []),
    getBlock: mock(async () => null),
    deleteBlocks: mock(async () => {}),
  } as unknown as StreamBlockStore
}

function mockEventBus(): CapabilityEventBus {
  return {
    emit: mock(() => {}),
    on: mock(() => () => {}),
    once: mock(() => () => {}),
    subscribe: mock(() => {}),
    unsubscribe: mock(() => {}),
    unsubscribeAll: mock(() => {}),
    removeAllListeners: mock(() => {}),
    getInstance: mock(() => mockEventBus()),
    resetInstance: mock(() => {}),
  } as unknown as CapabilityEventBus
}

function mockMemoizer(): ExecutionMemoizer {
  return {
    getOrCompute: mock(async (_k: string, compute: () => Promise<unknown>) => compute()),
    getStats: mock(() => ({ size: 0, maxEntries: 100, hits: 0, misses: 0, hitRate: 0 })),
    invalidate: mock(() => {}),
    invalidateByPrefix: mock(() => {}),
    invalidateAll: mock(() => {}),
    set: mock(() => {}),
    get: mock(() => undefined),
  } as unknown as ExecutionMemoizer
}

// Recording governor: tracks every Page.navigate target. getPageState is controllable.
function makeRecordingGovernor(navLog: string[], pageUrl = 'https://claude.ai/'): ChromeGovernor {
  return {
    ensureRunning: mock(async (slaveId: string) => ({
      slaveId,
      providerId: 'claude',
      accountId: 'acct_1',
      debugPort: 9222,
      profileDir: '/tmp',
      status: 'running',
      superState: 'idle',
      pid: 1,
      consecutiveFailures: 0,
      circuitState: 'closed',
      lastHealthCheck: Date.now(),
    })),
    ensureRunningForAccount: mock(async () => ({
      slaveId: 'session_1',
      providerId: 'claude',
      accountId: 'acct_1',
      debugPort: 9222,
      profileDir: '/tmp',
      status: 'running',
      superState: 'idle',
      pid: 1,
      consecutiveFailures: 0,
      circuitState: 'closed',
      lastHealthCheck: Date.now(),
    })),
    cdp: {
      executeHarnessPlan: mock(async () => ({ success: true, stepsCompleted: 2 })),
      capture: mock(async () => ({
        url: 'https://test.com/api/1',
        body: '{"text":"x"}',
        headers: {},
        status: 200,
      })),
      send: mock(async (_slaveId: string, method: string, params?: Record<string, unknown>) => {
        if (method === 'Page.navigate' && params?.url) navLog.push(params.url as string)
        return { result: { value: true } }
      }),
      getPageState: mock(async () => ({ url: pageUrl, title: 't', readyState: 'complete' })),
      enable: mock(async () => ({})),
      disable: mock(async () => ({})),
      captureScreenshot: mock(async () => 'b'),
    },
  } as unknown as ChromeGovernor
}

function makeStore(getConvUrl: (sendIdx: number) => string | null): ConversationStore {
  let sendIdx = 0
  return {
    getConversation: mock(async () => {
      const url = getConvUrl(sendIdx)
      sendIdx += 1
      return { ...makeConv(), ...(url ? { providerConversationUrl: url } : {}) } as any as ConversationRow
    }),
    getAccount: mock(async () => makeAccount()),
    createConversation: mock(async (input) => makeConv({ id: 'conv_new', ...input })),
    updateConversation: mock(async () => {}),
    deleteConversation: mock(async () => {}),
    listConversations: mock(async () => []),
    createMessage: mock(async (input) => ({
      id: 'msg',
      conversationId: 'c',
      role: 'x',
      content: '',
      blocksJson: '[]',
      blockCount: 0,
      parentMessageId: null,
      sequenceIndex: 0,
      latencyMs: null,
      tokenCount: null,
      model: null,
      metadataJson: '{}',
      createdAt: 0,
      ...input,
    })),
    getMessage: mock(async () => null),
    getMessages: mock(async () => []),
    getLastMessage: mock(async () => null),
    updateMessage: mock(async () => {}),
    createAttachment: mock(async () => ({
      id: 'a',
      messageId: 'm',
      filename: 'f',
      mimeType: 'x',
      sizeBytes: 0,
      storagePath: 'p',
      thumbnailPath: null,
      metadataJson: '{}',
      createdAt: 0,
    })),
    getAttachments: mock(async () => []),
    getAttachment: mock(async () => null),
    deleteAttachment: mock(async () => {}),
  } as unknown as ConversationStore
}

function buildManager(governor: ChromeGovernor, store: ConversationStore): ConversationManager {
  return new ConversationManager(
    governor,
    mockResolution(),
    mockParser(),
    mockBlockStore(),
    store,
    mockEventBus(),
    mockMemoizer(),
  )
}

describe('ConversationManager M2 — navigate to persisted URL', () => {
  it('SC-M2-1/5/6: turn 1 navigates to root, turn 2 navigates to persisted conversation url', async () => {
    const navLog: string[] = []
    const governor = makeRecordingGovernor(navLog)
    const store = makeStore((sendIdx) => (sendIdx === 0 ? null : PERSISTED_URL))
    const mgr = buildManager(governor, store)

    const r1 = await mgr.send('conv_1', 'first')
    expect(r1.ok).toBe(true)
    const r2 = await mgr.send('conv_1', 'second')
    expect(r2.ok).toBe(true)

    // turn 1 → root (https://claude.ai/chat), turn 2 → persisted conversation url
    expect(navLog).toEqual(['https://claude.ai/chat', PERSISTED_URL])
  }, 30_000)

  it('SC-M2-3: no Page.navigate when already on the persisted url', async () => {
    const navLog: string[] = []
    const governor = makeRecordingGovernor(navLog, PERSISTED_URL)
    const store = makeStore(() => PERSISTED_URL)
    const mgr = buildManager(governor, store)

    await mgr.send('conv_1', 'first')
    await mgr.send('conv_1', 'second')
    // no navigation issued because the page already matches the target
    expect(navLog).toEqual([])
  }, 30_000)

  it('SC-M2-4: navigation failure falls back gracefully (send still ok)', async () => {
    const governor = makeRecordingGovernor([])
    // Page.navigate throws → must not break the send
    governor.cdp.send = mock(async (_slaveId: string, method: string) => {
      if (method === 'Page.navigate') throw new Error('nav failed')
      return { result: { value: true } }
    })
    const store = makeStore(() => null)
    const mgr = buildManager(governor, store)

    const result = await mgr.send('conv_1', 'hi')
    expect(result.ok).toBe(true)
  }, 30_000)
})
