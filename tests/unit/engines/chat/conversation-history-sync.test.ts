// tests/unit/engines/chat/conversation-history-sync.test.ts
// Unit tests for ConversationHistorySyncEngine — orchestrates provider adapters + DB sync.

import { describe, expect, mock, test } from 'bun:test'
import { ConversationHistorySyncEngine } from '../../../../src/engines/conversation-history-sync.js'
import type {
  AuthContext,
  ConversationHeader,
  ProviderConversationAdapter,
} from '../../../../src/engines/provider-conversation-adapter.js'
import { AdapterError } from '../../../../src/engines/provider-conversation-adapter.js'
import type {
  ConversationStore,
  ConversationSyncStateStore,
} from '../../../../src/storage/contracts/conversation-store.js'

// ── Mock adapter ─────────────────────────────────────────────────────────────

function createMockAdapter(
  overrides: Partial<ProviderConversationAdapter> = {},
): ProviderConversationAdapter & { getAuthContext: (slaveId: string) => Promise<AuthContext> } {
  return {
    providerId: 'chatgpt',
    listConversations: mock(
      async (
        _accountId: string,
        _auth: AuthContext,
        _opts?: { cursor?: string; limit?: number },
      ) => ({
        items: [
          { id: 'conv-1', title: 'Chat 1', updatedAt: 1700001000, createdAt: 1700000000 },
          { id: 'conv-2', title: 'Chat 2', updatedAt: 1699001000, createdAt: 1699000000 },
        ] as ConversationHeader[],
        total: 2,
      }),
    ),
    getConversation: mock(
      async (_accountId: string, _auth: AuthContext, conversationId: string) => ({
        id: conversationId,
        title: `Full ${conversationId}`,
        messages: [
          { id: 'msg-1', parentId: null, role: 'user', content: 'Hello', timestamp: 1700000000 },
          {
            id: 'msg-2',
            parentId: 'msg-1',
            role: 'assistant',
            content: 'Hi!',
            timestamp: 1700000001,
          },
        ],
      }),
    ) as ProviderConversationAdapter['getConversation'],
    searchConversations: mock(async () => []),
    getAuthContext: mock(async (_slaveId: string) => ({ bearerToken: 'test-token' })),
    ...overrides,
  }
}

// ── Mock stores ──────────────────────────────────────────────────────────────

function createMockConversationStore(): ConversationStore {
  return {
    getConversation: mock(async () => null),
    createConversation: mock(async () => ({
      id: 'conv-new',
      providerSessionId: null,
      providerId: 'chatgpt',
      accountId: null,
      title: null,
      state: 'active',
      messageCount: 0,
      lastMessageAt: null,
      contextJson: '{}',
      createdAt: 1700000000,
      updatedAt: 1700000000,
      source: 'live',
      externalId: null,
      importJobId: null,
      syncedAt: null,
    })),
    updateConversation: mock(async () => {}),
    deleteConversation: mock(async () => {}),
    listConversations: mock(async () => []),
    getConversationByExternalId: mock(async () => null),
    upsertConversationByExternalId: mock(async () => ({
      id: 'conv-upserted',
      providerSessionId: null,
      providerId: 'chatgpt',
      accountId: null,
      title: null,
      state: 'active',
      messageCount: 0,
      lastMessageAt: null,
      contextJson: '{}',
      createdAt: 1700000000,
      updatedAt: 1700000000,
      source: 'provider_sync',
      externalId: null,
      importJobId: null,
      syncedAt: null,
    })),
    listConversationsByAccountId: mock(async () => []),
    createMessages: mock(async () => []),
    createMessage: mock(async () => ({
      id: 'msg-new',
      conversationId: 'conv',
      role: 'user',
      content: null,
      blocksJson: '[]',
      blockCount: 0,
      parentMessageId: null,
      sequenceIndex: 0,
      latencyMs: null,
      tokenCount: null,
      model: null,
      metadataJson: '{}',
      createdAt: 1700000000,
    })),
    getMessage: mock(async () => null),
    getMessages: mock(async () => []),
    getLastMessage: mock(async () => null),
    updateMessage: mock(async () => {}),
    getAccount: mock(async () => null),
    createAttachment: mock(async () => ({
      id: 'att',
      messageId: 'msg',
      filename: 'f',
      mimeType: 'text',
      sizeBytes: 0,
      storagePath: '',
      thumbnailPath: null,
      metadataJson: '{}',
      createdAt: 1700000000,
    })),
    getAttachments: mock(async () => []),
    getAttachment: mock(async () => null),
    deleteAttachment: mock(async () => {}),
    ensureProviderSession: mock(async () => ({ id: 'session' })),
  } as unknown as ConversationStore
}

function createMockSyncStateStore(): ConversationSyncStateStore {
  return {
    getSyncState: mock(async () => null),
    upsertSyncState: mock(async (input) => ({
      id: 'state-1',
      providerId: input.providerId,
      accountId: input.accountId,
      syncType: input.syncType ?? 'incremental',
      status: input.status ?? 'pending',
      cursorJson: input.cursorJson ?? '{}',
      totalConversations: input.totalConversations ?? 0,
      syncedConversations: input.syncedConversations ?? 0,
      failedConversations: input.failedConversations ?? 0,
      lastSyncedAt: null,
      nextSyncAt: null,
      errorJson: input.errorJson ?? null,
      configJson: input.configJson ?? '{}',
      createdAt: 1700000000,
      updatedAt: 1700000000,
    })) as unknown as ConversationSyncStateStore['upsertSyncState'],
    updateSyncStatus: mock(async () => ({
      id: 'state-1',
      providerId: 'chatgpt',
      accountId: 'acc',
      syncType: 'incremental',
      status: 'running',
      cursorJson: '{}',
      totalConversations: 0,
      syncedConversations: 0,
      failedConversations: 0,
      lastSyncedAt: null,
      nextSyncAt: null,
      errorJson: null,
      configJson: '{}',
      createdAt: 1700000000,
      updatedAt: 1700000000,
    })) as unknown as ConversationSyncStateStore['updateSyncStatus'],
    incrementSyncProgress: mock(async () => ({
      id: 'state-1',
      providerId: 'chatgpt',
      accountId: 'acc',
      syncType: 'incremental',
      status: 'running',
      cursorJson: '{}',
      totalConversations: 0,
      syncedConversations: 0,
      failedConversations: 0,
      lastSyncedAt: null,
      nextSyncAt: null,
      errorJson: null,
      configJson: '{}',
      createdAt: 1700000000,
      updatedAt: 1700000000,
    })) as unknown as ConversationSyncStateStore['incrementSyncProgress'],
    getPendingSyncs: mock(async () => []),
    deleteSyncState: mock(async () => {}),
    createSyncLog: mock(async (input) => ({
      id: 'log-1',
      providerId: input.providerId,
      accountId: input.accountId,
      syncType: input.syncType,
      status: input.status,
      startedAt: 1700000000,
      completedAt: null,
      durationMs: null,
      conversationsFound: 0,
      conversationsSynced: 0,
      conversationsFailed: 0,
      errorJson: null,
      metadataJson: '{}',
    })) as unknown as ConversationSyncStateStore['createSyncLog'],
    updateSyncLog: mock(async () => ({
      id: 'log-1',
      providerId: 'chatgpt',
      accountId: 'acc',
      syncType: 'incremental',
      status: 'completed',
      startedAt: 1700000000,
      completedAt: 1700000001,
      durationMs: 1,
      conversationsFound: 0,
      conversationsSynced: 0,
      conversationsFailed: 0,
      errorJson: null,
      metadataJson: '{}',
    })) as unknown as ConversationSyncStateStore['updateSyncLog'],
    getSyncLogs: mock(async () => []),
  }
}

function createMockGovernor() {
  return {
    send: mock(async () => null),
  }
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('ConversationHistorySyncEngine', () => {
  describe('sync (incremental)', () => {
    test('fetches conversations and upserts to DB', async () => {
      const adapter = createMockAdapter()
      const conversationStore = createMockConversationStore()
      const syncStateStore = createMockSyncStateStore()
      const governor = createMockGovernor()

      const engine = new ConversationHistorySyncEngine(
        adapter,
        conversationStore,
        syncStateStore,
        governor,
      )

      const result = await engine.sync('account-1', 'slave-1')

      expect(result.synced).toBe(2)
      expect(result.failed).toBe(0)
      expect(result.totalFound).toBe(2)
      expect(result.error).toBeUndefined()

      // Should have called getConversation for each header
      expect(adapter.getConversation).toHaveBeenCalledTimes(2)

      // Should have upserted conversations
      expect(conversationStore.upsertConversationByExternalId).toHaveBeenCalledTimes(2)
    })

    test('creates sync log entry', async () => {
      const adapter = createMockAdapter()
      const conversationStore = createMockConversationStore()
      const syncStateStore = createMockSyncStateStore()
      const governor = createMockGovernor()

      const engine = new ConversationHistorySyncEngine(
        adapter,
        conversationStore,
        syncStateStore,
        governor,
      )

      await engine.sync('account-1', 'slave-1')

      expect(syncStateStore.createSyncLog).toHaveBeenCalledTimes(1)
      expect(syncStateStore.updateSyncLog).toHaveBeenCalledTimes(1)
    })

    test('handles adapter errors gracefully', async () => {
      const adapter = createMockAdapter({
        listConversations: mock(async () => {
          throw new AdapterError('Auth expired', 'chatgpt', 'AUTH_EXPIRED')
        }),
      })
      const conversationStore = createMockConversationStore()
      const syncStateStore = createMockSyncStateStore()
      const governor = createMockGovernor()

      const engine = new ConversationHistorySyncEngine(
        adapter,
        conversationStore,
        syncStateStore,
        governor,
      )

      const result = await engine.sync('account-1', 'slave-1')

      expect(result.failed).toBe(0)
      expect(result.synced).toBe(0)
      expect(result.error).toContain('Auth expired')

      // Sync state should be marked as failed
      expect(syncStateStore.updateSyncStatus).toHaveBeenCalledWith(
        'chatgpt',
        'account-1',
        'failed',
        expect.any(String),
      )
    })
  })

  describe('sync (selective)', () => {
    test('fetches specific conversation IDs', async () => {
      const adapter = createMockAdapter()
      const conversationStore = createMockConversationStore()
      const syncStateStore = createMockSyncStateStore()
      const governor = createMockGovernor()

      const engine = new ConversationHistorySyncEngine(
        adapter,
        conversationStore,
        syncStateStore,
        governor,
      )

      const result = await engine.sync('account-1', 'slave-1', {
        syncType: 'selective',
        conversationIds: ['conv-1', 'conv-2'],
      })

      expect(result.totalFound).toBe(2)
      expect(result.synced).toBe(2)
      expect(result.failed).toBe(0)

      // Should not have called listConversations (selective mode)
      expect(adapter.listConversations).not.toHaveBeenCalled()
    })
  })

  describe('sync (headersOnly)', () => {
    test('skips fetching full conversations', async () => {
      const adapter = createMockAdapter()
      const conversationStore = createMockConversationStore()
      const syncStateStore = createMockSyncStateStore()
      const governor = createMockGovernor()

      const engine = new ConversationHistorySyncEngine(
        adapter,
        conversationStore,
        syncStateStore,
        governor,
      )

      const result = await engine.sync('account-1', 'slave-1', { headersOnly: true })

      expect(result.synced).toBe(2)
      expect(result.failed).toBe(0)

      // Should NOT have called getConversation (headers only)
      expect(adapter.getConversation).not.toHaveBeenCalled()

      // Should have upserted conversations without messages
      expect(conversationStore.upsertConversationByExternalId).toHaveBeenCalledTimes(2)
    })
  })

  describe('fetchConversation', () => {
    test('fetches single conversation by ID', async () => {
      const adapter = createMockAdapter()
      const conversationStore = createMockConversationStore()
      const syncStateStore = createMockSyncStateStore()
      const governor = createMockGovernor()

      const engine = new ConversationHistorySyncEngine(
        adapter,
        conversationStore,
        syncStateStore,
        governor,
      )

      const result = await engine.fetchConversation('account-1', 'slave-1', 'conv-1')

      expect(result).not.toBeNull()
      expect(result!.id).toBe('conv-1')
      expect(result!.messages).toHaveLength(2)
    })

    test('returns null when conversation not found', async () => {
      const adapter = createMockAdapter({
        getConversation: mock(async () => null),
      })
      const conversationStore = createMockConversationStore()
      const syncStateStore = createMockSyncStateStore()
      const governor = createMockGovernor()

      const engine = new ConversationHistorySyncEngine(
        adapter,
        conversationStore,
        syncStateStore,
        governor,
      )

      const result = await engine.fetchConversation('account-1', 'slave-1', 'nonexistent')

      expect(result).toBeNull()
    })
  })

  describe('message upsert', () => {
    test('creates messages from full conversation', async () => {
      const adapter = createMockAdapter()
      const conversationStore = createMockConversationStore()
      const syncStateStore = createMockSyncStateStore()
      const governor = createMockGovernor()

      const engine = new ConversationHistorySyncEngine(
        adapter,
        conversationStore,
        syncStateStore,
        governor,
      )

      await engine.sync('account-1', 'slave-1')

      // Should have batch-created messages for each conversation
      expect(conversationStore.createMessages).toHaveBeenCalledTimes(2)
      const firstCall = (conversationStore.createMessages as ReturnType<typeof mock>).mock.calls[0]
      expect(firstCall).toBeDefined()
      const messages = firstCall![0] as Array<{
        conversationId: string
        role: string
        content: string
      }>
      expect(messages).toHaveLength(2)
      const msg0 = messages[0]
      const msg1 = messages[1]
      expect(msg0?.role).toBe('user')
      expect(msg0?.content).toBe('Hello')
      expect(msg1?.role).toBe('assistant')
      expect(msg1?.content).toBe('Hi!')
    })
  })
})
