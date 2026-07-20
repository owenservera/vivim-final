// tests/unit/engines/conversation-manager.test.ts
// Tests for ConversationManager — 8-step send pipeline.

import { beforeEach, describe, expect, it, mock } from 'bun:test'
import type { ChromeGovernor } from '../../../src/engines/chrome-governor.js'
import type {
  CapabilityEventBus,
  CapabilityResolutionEngine,
  ContentBlock,
  ParseResult,
  ResolvedCapabilities,
  StreamBlockStore,
  StreamParserEngine,
} from '../../../src/engines/conversation-manager.js'
import { ConversationManager } from '../../../src/engines/conversation-manager.js'
import type { ExecutionMemoizer } from '../../../src/engines/execution-memoizer.js'
import type {
  ConversationMessageRow,
  ConversationRow,
  ConversationStore,
  ProviderAccountRow,
} from '../../../src/storage/contracts/conversation-store.js'

// ── Mock factories ─────────────────────────────────────────────────────────

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

function makeAccount(overrides?: Partial<ProviderAccountRow>): ProviderAccountRow {
  return {
    id: 'acct_1',
    providerId: 'claude',
    planTier: 'pro',
    displayName: 'Test',
    configJson: '{}',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  }
}

function makeMsg(overrides?: Partial<ConversationMessageRow>): ConversationMessageRow {
  return {
    id: 'msg_1',
    conversationId: 'conv_1',
    role: 'assistant',
    content: 'Hello',
    blocksJson: '[]',
    blockCount: 0,
    parentMessageId: null,
    sequenceIndex: 0,
    latencyMs: null,
    tokenCount: null,
    model: null,
    metadataJson: '{}',
    createdAt: Date.now(),
    ...overrides,
  }
}

function makeResolved(): ResolvedCapabilities {
  return {
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
  } as unknown as ResolvedCapabilities
}

function makeParseResult(blocks?: ContentBlock[]): ParseResult {
  return {
    blocks: blocks ?? [{ type: 'text', text: 'Hi there' }],
    confidence: 0.95,
    parserName: 'test',
    parserVersion: 1,
    durationMs: 5,
    blockDiagnostics: {
      textBlocks: 1,
      toolCallBlocks: 0,
      fileBlocks: 0,
      errorBlocks: 0,
      reasoningBlocks: 0,
      codeBlocks: 0,
      sourceBlocks: 0,
    },
    wireFormat: 'unknown',
    fallbackDepth: 0,
    rawSizeBytes: 0,
  }
}

// ── Mock store ──────────────────────────────────────────────────────────────

function mockStore(overrides?: Partial<ConversationStore>): ConversationStore {
  return {
    getConversation: mock(() => Promise.resolve(makeConv())),
    createConversation: mock((input) => Promise.resolve(makeConv({ id: 'conv_new', ...input }))),
    updateConversation: mock(() => Promise.resolve()),
    deleteConversation: mock(() => Promise.resolve()),
    listConversations: mock(() => Promise.resolve([])),
    createMessage: mock((input) => Promise.resolve(makeMsg({ id: 'msg_new', ...input }))),
    getMessage: mock(() => Promise.resolve(makeMsg())),
    getMessages: mock(() => Promise.resolve([])),
    getLastMessage: mock(() => Promise.resolve(null)),
    updateMessage: mock(() => Promise.resolve()),
    getAccount: mock(() => Promise.resolve(makeAccount())),
    createAttachment: mock(() =>
      Promise.resolve({
        id: 'att',
        messageId: 'msg',
        filename: 'f',
        mimeType: 'x',
        sizeBytes: 0,
        storagePath: 'p',
        thumbnailPath: null,
        metadataJson: '{}',
        createdAt: 0,
      }),
    ),
    getAttachments: mock(() => Promise.resolve([])),
    getAttachment: mock(() => Promise.resolve(null)),
    deleteAttachment: mock(() => Promise.resolve()),
    ...overrides,
  }
}

function mockResolution(): CapabilityResolutionEngine {
  return {
    resolve: mock(() => Promise.resolve(makeResolved())),
    search: mock(() => Promise.resolve([])),
    buildResult: mock(() => makeResolved()),
    mapRow: mock(() => undefined),
  } as unknown as CapabilityResolutionEngine
}

function mockParser(): StreamParserEngine {
  return {
    parse: mock(() => Promise.resolve(makeParseResult())),
    detectCompletion: mock(() => Promise.resolve(true)),
    reloadParser: mock(() => Promise.resolve()),
    preloadAll: mock(() => Promise.resolve()),
  } as unknown as StreamParserEngine
}

function mockBlockStore(): StreamBlockStore {
  return {
    storeBlocks: mock(() => Promise.resolve()),
    getBlocksByConversation: mock(() => Promise.resolve([])),
    getBlocksByMessage: mock(() => Promise.resolve([])),
    getBlock: mock(() => Promise.resolve(null)),
    deleteBlocks: mock(() => Promise.resolve()),
  } as unknown as StreamBlockStore
}

function mockEventBus(): CapabilityEventBus & { events: unknown[] } {
  const events: unknown[] = []
  return {
    events,
    emit: mock((e: unknown) => {
      events.push(e)
    }),
    on: mock(() => () => {}),
    once: mock(() => () => {}),
    subscribe: mock(() => {}),
    unsubscribe: mock(() => {}),
    unsubscribeAll: mock(() => {}),
    removeAllListeners: mock(() => {}),
    getInstance: mock(() => mockEventBus()),
    resetInstance: mock(() => {}),
  } as unknown as CapabilityEventBus & { events: unknown[] }
}

function mockMemoizer(): ExecutionMemoizer {
  return {
    getOrCompute: mock(async (_key: string, compute: () => Promise<unknown>) => compute()),
    getStats: mock(() => ({ size: 0, maxEntries: 100, hits: 0, misses: 0, hitRate: 0 })),
    invalidate: mock(() => {}),
    invalidateByPrefix: mock(() => {}),
    invalidateAll: mock(() => {}),
    set: mock(() => {}),
    get: mock(() => undefined),
  } as unknown as ExecutionMemoizer
}

function mockGovernor(): ChromeGovernor {
  return {
    ensureRunning: mock(async (slaveId: string) => ({
      slaveId,
      providerId: 'claude',
      accountId: 'acct_1',
      debugPort: 9222,
      profileDir: '/tmp/test',
      status: 'running',
      superState: 'idle',
      pid: 123,
      consecutiveFailures: 0,
      circuitState: 'closed',
      lastHealthCheck: Date.now(),
    })),
    ensureRunningForAccount: mock(async (_providerId: string, _accountId: string) => ({
      slaveId: 'session_1',
      providerId: 'claude',
      accountId: 'acct_1',
      debugPort: 9222,
      profileDir: '/tmp/test',
      status: 'running',
      superState: 'idle',
      pid: 123,
      consecutiveFailures: 0,
      circuitState: 'closed',
      lastHealthCheck: Date.now(),
    })),
    cdp: {
      executeHarnessPlan: mock(async () => ({ success: true, stepsCompleted: 2 })),
      capture: mock(async () => ({
        url: 'https://test.com/api/conversation/1',
        body: '{"text":"Hi there"}',
        headers: {},
        status: 200,
      })),
      send: mock(async () => ({ result: { value: true } })),
      getPageState: mock(async () => ({
        url: 'https://claude.ai/',
        title: 'Test',
        readyState: 'complete',
      })),
      enable: mock(async () => ({})),
      disable: mock(async () => ({})),
      captureScreenshot: mock(async () => 'base64'),
    },
  } as unknown as ChromeGovernor
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('ConversationManager', () => {
  let mgr: ConversationManager
  let store: ReturnType<typeof mockStore>
  let bus: ReturnType<typeof mockEventBus>

  beforeEach(() => {
    store = mockStore()
    bus = mockEventBus()
    mgr = new ConversationManager(
      mockGovernor(),
      mockResolution(),
      mockParser(),
      mockBlockStore(),
      store,
      bus,
      mockMemoizer(),
    )
  })

  it('send() completes full 8-step pipeline and returns SendResult', async () => {
    const result = await mgr.send('conv_1', 'Hello')
    expect(result.ok).toBe(true)
    expect(result.messageId).toBe('msg_new')
    expect(result.blocks).toEqual([{ type: 'text', text: 'Hi there' }])
    expect(result.text).toBe('Hi there')
    expect(result.latencyMs).toBeGreaterThanOrEqual(0)
  })

  it('createConversation() persists and returns conversation', async () => {
    const conv = await mgr.createConversation('claude', 'My Chat')
    expect(conv.id).toBe('conv_new')
    expect(store.createConversation).toHaveBeenCalledWith(
      expect.objectContaining({ providerId: 'claude', title: 'My Chat' }),
    )
  })

  it('Step 1 RESOLVE uses memoized capability resolution', async () => {
    await mgr.send('conv_1', 'test')
    expect(store.getAccount).toHaveBeenCalledWith('session_1')
  })

  it('Step 5 SEND builds correct HarnessDAG for composer typing', async () => {
    const governor = mockGovernor()
    const mgr2 = new ConversationManager(
      governor,
      mockResolution(),
      mockParser(),
      mockBlockStore(),
      store,
      bus,
      mockMemoizer(),
    )
    await mgr2.send('conv_1', 'test message')
    expect(governor.cdp.executeHarnessPlan).toHaveBeenCalled()
  })

  it('Step 8 EMIT fires conversation:complete event on EventBus', async () => {
    await mgr.send('conv_1', 'hello')
    expect(bus.emit).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'conversation:complete',
        conversationId: 'conv_1',
      }),
    )
  })

  it('Error at any step → error flows through, event emitted', async () => {
    const failStore = mockStore({
      getConversation: mock(() => Promise.resolve(null)),
    })
    const failBus = mockEventBus()
    const mgr2 = new ConversationManager(
      mockGovernor(),
      mockResolution(),
      mockParser(),
      mockBlockStore(),
      failStore,
      failBus,
      mockMemoizer(),
    )
    const result = await mgr2.send('bad_id', 'msg')
    expect(result.ok).toBe(false)
    expect(result.error).toContain('Conversation not found')
    expect(failBus.emit).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'conversation:error' }),
    )
  })

  it('Multi-turn send: two sends to same conversation work', async () => {
    const r1 = await mgr.send('conv_1', 'first')
    const r2 = await mgr.send('conv_1', 'second')
    expect(r1.ok).toBe(true)
    expect(r2.ok).toBe(true)
    // each send calls updateConversation twice: [1.5] context injection + [8] counters
    expect(store.updateConversation).toHaveBeenCalledTimes(4)
  })

  it('Step 1.5 INJECT CONTEXT populates conversation.contextJson with valid JSON', async () => {
    await mgr.send('conv_1', 'Hello')
    const updater = store.updateConversation as unknown as {
      mock: { calls: Array<[string, { contextJson?: string; messageCount?: number }]> }
    }
    const ctxCall = updater.mock.calls.find((c) => c[1] && 'contextJson' in c[1])
    expect(ctxCall).toBeDefined()
    if (!ctxCall) throw new Error('context injection was not called')
    const ctxJson = ctxCall[1].contextJson
    if (!ctxJson) throw new Error('contextJson missing')

    const ctx = JSON.parse(ctxJson)
    expect(ctx.provider.slug).toBe('claude')
    expect(ctx.account.email).toBe('acct_1')
    expect(ctx.account.planTier).toBe('pro')
    expect(ctx.chrome.status).toBe('running')
    expect(ctx.chrome.circuitState).toBe('closed')
    expect(ctx.capabilities.total).toBe(1)
    expect(ctx.capabilities.available).toBe(1)
  })

  it('Context injection uses graceful defaults for unavailable fields', async () => {
    await mgr.send('conv_1', 'Hello')
    const updater = store.updateConversation as unknown as {
      mock: { calls: Array<[string, { contextJson?: string }]> }
    }
    const ctxCall = updater.mock.calls.find((c) => c[1] && 'contextJson' in c[1])
    expect(ctxCall).toBeDefined()
    if (!ctxCall) throw new Error('context injection was not called')
    const ctxJson = ctxCall[1].contextJson
    if (!ctxJson) throw new Error('contextJson missing')

    const ctx = JSON.parse(ctxJson)
    expect(ctx.account.loginState).toBe('unknown')
  })

  it('Context injection does not break the 8-step pipeline', async () => {
    const result = await mgr.send('conv_1', 'Hello')
    expect(result.ok).toBe(true)
    expect(result.messageId).toBe('msg_new')
    expect(bus.emit).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'conversation:complete' }),
    )
  })
})
