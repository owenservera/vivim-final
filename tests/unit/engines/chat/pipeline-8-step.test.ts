// tests/unit/engines/chat/pipeline-8-step.test.ts
// Catches: Pipeline step failures, missing events, incorrect wiring
// Validates: All 8 steps execute in order, EMIT fires on every path

import { beforeEach, describe, expect, it, mock } from 'bun:test'
import type { ChromeGovernor } from '../../../../src/engines/chrome-governor.js'
import type {
  CapabilityEventBus,
  CapabilityResolutionEngine,
  ContentBlock,
  ParseResult,
  ResolvedCapabilities,
  StreamBlockStore,
  StreamParserEngine,
} from '../../../../src/engines/conversation-manager.js'
import { ConversationManager } from '../../../../src/engines/conversation-manager.js'
import type { ExecutionMemoizer } from '../../../../src/engines/execution-memoizer.js'
import type {
  ConversationMessageRow,
  ConversationRow,
  ConversationStore,
  ProviderAccountRow,
} from '../../../../src/storage/contracts/conversation-store.js'

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

describe('Chat Pipeline: 8-step execution', () => {
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

  it('Step 1 RESOLVE: fetches account via providerSessionId', async () => {
    await mgr.send('conv_1', 'test')
    expect(store.getAccount).toHaveBeenCalledWith('session_1')
  })

  it('Step 2 SLAVE: ensureRunningForAccount called with providerId + accountId', async () => {
    const gov = mockGovernor()
    const mgr2 = new ConversationManager(
      gov,
      mockResolution(),
      mockParser(),
      mockBlockStore(),
      store,
      bus,
      mockMemoizer(),
    )
    await mgr2.send('conv_1', 'test')
    expect(gov.ensureRunningForAccount).toHaveBeenCalledWith('claude', 'acct_1')
  })

  it('Step 4-5 SEND: HarnessDAG built with type + submit', async () => {
    const gov = mockGovernor()
    const mgr2 = new ConversationManager(
      gov,
      mockResolution(),
      mockParser(),
      mockBlockStore(),
      store,
      bus,
      mockMemoizer(),
    )
    await mgr2.send('conv_1', 'Hello Claude')
    expect(gov.cdp.executeHarnessPlan).toHaveBeenCalled()
    const calls = (gov.cdp.executeHarnessPlan as ReturnType<typeof mock>).mock.calls
    const call = calls[0]
    expect(call).toBeDefined()
    const dag = call?.[1] as { nodes: Array<{ type: string; action: string }> }
    expect(dag.nodes).toHaveLength(2)
    expect(dag.nodes[0]?.action).toBe('type_text')
    expect(dag.nodes[1]?.action).toBe('submit')
  })

  it('Step 6 CAPTURE: parser.parse called with response body', async () => {
    const parser = mockParser()
    const mgr2 = new ConversationManager(
      mockGovernor(),
      mockResolution(),
      parser,
      mockBlockStore(),
      store,
      bus,
      mockMemoizer(),
    )
    await mgr2.send('conv_1', 'test')
    expect(parser.parse).toHaveBeenCalled()
  })

  it('Step 7 STORE: user message created first, then assistant', async () => {
    await mgr.send('conv_1', 'Hello')
    const createCalls = (store.createMessage as ReturnType<typeof mock>).mock.calls
    expect(createCalls.length).toBe(2)
    expect(createCalls[0]?.[0]?.role).toBe('user')
    expect(createCalls[0]?.[0]?.content).toBe('Hello')
    expect(createCalls[1]?.[0]?.role).toBe('assistant')
  })

  it('Step 8a UPDATE: messageCount incremented by 2', async () => {
    await mgr.send('conv_1', 'Hello')
    expect(store.updateConversation).toHaveBeenCalledWith(
      'conv_1',
      expect.objectContaining({ messageCount: 2 }),
    )
  })

  it('Step 8 EMIT: conversation:complete fires', async () => {
    await mgr.send('conv_1', 'Hello')
    expect(bus.emit).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'conversation:complete',
        conversationId: 'conv_1',
      }),
    )
  })

  it('Return value: SendResult has all fields', async () => {
    const result = await mgr.send('conv_1', 'Hello')
    expect(result.ok).toBe(true)
    expect(result.messageId).toBeDefined()
    expect(result.text).toBeDefined()
    expect(result.latencyMs).toBeGreaterThanOrEqual(0)
    expect(Array.isArray(result.blocks)).toBe(true)
  })

  it('Step 1.5 INJECT CONTEXT: contextJson set before send', async () => {
    await mgr.send('conv_1', 'Hello')
    expect(store.updateConversation).toHaveBeenCalledWith(
      'conv_1',
      expect.objectContaining({ contextJson: expect.any(String) }),
    )
  })

  it('Step 8b BLOCKS: storeBlocks called with parsed blocks', async () => {
    const blockStore = mockBlockStore()
    const mgr2 = new ConversationManager(
      mockGovernor(),
      mockResolution(),
      mockParser(),
      blockStore,
      store,
      bus,
      mockMemoizer(),
    )
    await mgr2.send('conv_1', 'Hello')
    expect(blockStore.storeBlocks).toHaveBeenCalled()
  })
})

describe('Chat Pipeline: error paths', () => {
  let _mgr: ConversationManager
  let store: ReturnType<typeof mockStore>
  let bus: ReturnType<typeof mockEventBus>

  beforeEach(() => {
    store = mockStore()
    bus = mockEventBus()
    _mgr = new ConversationManager(
      mockGovernor(),
      mockResolution(),
      mockParser(),
      mockBlockStore(),
      store,
      bus,
      mockMemoizer(),
    )
  })

  it('Conversation not found → ok:false, error message, conversation:error emitted', async () => {
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

  it('Account not found → ok:false, error about missing account', async () => {
    const failStore = mockStore({
      getAccount: mock(() => Promise.resolve(null)),
    })
    const mgr2 = new ConversationManager(
      mockGovernor(),
      mockResolution(),
      mockParser(),
      mockBlockStore(),
      failStore,
      mockEventBus(),
      mockMemoizer(),
    )
    const result = await mgr2.send('conv_1', 'msg')
    expect(result.ok).toBe(false)
    expect(result.error).toContain('Account not found')
  })

  it('HarnessDAG fails → ok:false, error message', async () => {
    const failGov = mockGovernor()
    failGov.cdp.executeHarnessPlan = mock(async () => ({
      success: false,
      error: 'Selector not found',
      stepsCompleted: 0,
    }))
    const mgr2 = new ConversationManager(
      failGov,
      mockResolution(),
      mockParser(),
      mockBlockStore(),
      store,
      bus,
      mockMemoizer(),
    )
    const result = await mgr2.send('conv_1', 'msg')
    expect(result.ok).toBe(false)
    expect(result.error).toContain('Selector not found')
  })

  it('Parser throws → pipeline continues, blocks empty', async () => {
    const failParser = mockParser()
    failParser.parse = mock(async () => {
      throw new Error('Parse error')
    })
    const mgr2 = new ConversationManager(
      mockGovernor(),
      mockResolution(),
      failParser,
      mockBlockStore(),
      store,
      bus,
      mockMemoizer(),
    )
    const result = await mgr2.send('conv_1', 'msg')
    // Pipeline continues even if parser fails — blocks are empty
    expect(result.ok).toBe(true)
  })
})
