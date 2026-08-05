import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import { existsSync, mkdirSync, unlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { CapabilityEventBus } from '../../../src/engines/capability-event-bus.js'
import type { KnowledgeExtractor } from '../../../src/engines/knowledge-extractor.js'
import { KnowledgeIngestionEngine } from '../../../src/engines/knowledge-ingestion.js'
import type { ConversationStore } from '../../../src/storage/contracts/conversation-store.js'
import type { KnowledgeIngestionStore } from '../../../src/storage/contracts/knowledge-ingestion-store.js'
import type { StreamBlockStoreContract } from '../../../src/storage/contracts/stream-block-store.js'

const TMP_DIR = join(tmpdir(), 'vivim-test-import')
const FIXTURE_FILE = join(TMP_DIR, 'test-export.json')

function makeStore(): KnowledgeIngestionStore & {
  jobs: Map<string, any>
  contentUnits: any[]
  dedupKeys: Map<string, string>
  convMap: Map<string, string>
  findConversationByDedupKey: (dedupKey: string) => Promise<string | null>
  setConversationDedupKey: (conversationId: string, dedupKey: string) => Promise<void>
  findResumableJob: (filePath: string) => Promise<{ id: string; resultJson: string | null } | null>
  createContentUnit: (input: any) => Promise<void>
} {
  const jobs = new Map<string, any>()
  const contentUnits: any[] = []
  const dedupKeys = new Map<string, string>()
  const convMap = new Map<string, string>()

  return {
    jobs,
    contentUnits,
    dedupKeys,
    convMap,
    createImportJob: async (job) => {
      jobs.set(job.id, { ...job, resultJson: null, completedAt: null, error: null })
    },
    updateImportJob: async (id, patch) => {
      const j = jobs.get(id)
      if (j) Object.assign(j, patch)
    },
    getImportJob: async (id) => jobs.get(id) ?? null,
    listImportJobs: async (opts) => Array.from(jobs.values()).slice(0, opts?.limit),
    findExistingConversation: async (_source, externalId) => convMap.get(externalId) ?? null,
    findConversationByDedupKey: async (dedupKey: string) => dedupKeys.get(dedupKey) ?? null,
    setConversationDedupKey: async (conversationId: string, dedupKey: string) => {
      dedupKeys.set(dedupKey, conversationId)
    },
    findResumableJob: async (filePath: string) => {
      for (const [id, job] of jobs) {
        if (job.filePath === filePath && ['pending', 'importing', 'failed'].includes(job.status)) {
          return { id, resultJson: job.resultJson }
        }
      }
      return null
    },
    createContentUnit: async (input: any) => {
      contentUnits.push(input)
    },
  }
}

function makeConversationStore(): ConversationStore {
  let convCounter = 0
  let msgCounter = 0

  return {
    getConversation: async () => null,
    createConversation: async (input) => {
      convCounter++
      return {
        id: `conv-${convCounter}`,
        providerSessionId: input.providerSessionId ?? null,
        providerId: input.providerId,
        accountId: input.accountId ?? null,
        title: input.title ?? null,
        state: input.state ?? 'active',
        messageCount: 0,
        lastMessageAt: null,
        contextJson: '{}',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        source: input.source ?? 'live',
        externalId: input.externalId ?? null,
        importJobId: input.importJobId ?? null,
        syncedAt: input.syncedAt ?? null,
      }
    },
    updateConversation: async () => {},
    deleteConversation: async () => {},
    listConversations: async () => [],
    createMessage: async (input) => {
      msgCounter++
      return {
        id: `msg-${msgCounter}`,
        conversationId: input.conversationId,
        role: input.role,
        content: input.content ?? null,
        blocksJson: input.blocksJson ?? '[]',
        blockCount: input.blockCount ?? 0,
        parentMessageId: input.parentMessageId ?? null,
        sequenceIndex: input.sequenceIndex ?? 0,
        latencyMs: null,
        tokenCount: null,
        model: null,
        metadataJson: '{}',
        createdAt: Date.now(),
      }
    },
    getMessage: async () => null,
    getMessages: async () => [],
    getLastMessage: async () => null,
    updateMessage: async () => {},
    getAccount: async () => null,
    createAttachment: async () => ({
      id: 'att-1',
      messageId: '',
      filename: '',
      mimeType: '',
      sizeBytes: 0,
      storagePath: '',
      thumbnailPath: null,
      metadataJson: '{}',
      createdAt: Date.now(),
    }),
    getAttachments: async () => [],
    getAttachment: async () => null,
    deleteAttachment: async () => {},
    getConversationByExternalId: async () => null,
    upsertConversationByExternalId: async () => ({ id: 'x' }) as never,
    listConversationsByAccountId: async () => [],
    createMessages: async () => [],
  }
}

beforeAll(() => {
  if (!existsSync(TMP_DIR)) mkdirSync(TMP_DIR, { recursive: true })
})

afterAll(() => {
  if (existsSync(FIXTURE_FILE)) unlinkSync(FIXTURE_FILE)
})

describe('Import Pipeline Integration', () => {
  it('imports a generic JSON export end-to-end', async () => {
    const fixture = [
      {
        id: 'ext-1',
        title: 'Test Conversation',
        messages: [
          { role: 'user', content: 'Hello world' },
          { role: 'assistant', content: 'Hi there, how can I help?' },
        ],
      },
    ]
    writeFileSync(FIXTURE_FILE, JSON.stringify(fixture))

    const store = makeStore()
    const convStore = makeConversationStore()

    const mockEventBus: CapabilityEventBus = {
      emit: () => {},
      on: () => () => {},
      once: () => () => {},
    } as unknown as CapabilityEventBus

    const mockExtractor: KnowledgeExtractor = {
      extractFromMessage: async () => [],
      extractIncremental: async () => [],
      extractFromConversation: async () => [],
      batchExtract: async () => ({ totalExtracted: 0, byType: {} as Record<string, number> }),
    } as unknown as KnowledgeExtractor

    const engine = new KnowledgeIngestionEngine(
      store,
      convStore,
      {} as StreamBlockStoreContract,
      mockExtractor,
      mockEventBus,
    )

    const result = await engine.ingest({
      source: 'generic',
      filePath: FIXTURE_FILE,
      deduplicate: true,
      extractEntities: false,
      extractDecisions: false,
      generateEmbeddings: false,
    })

    expect(result.conversationsImported).toBe(1)
    expect(result.messagesImported).toBe(2)
    expect(result.duplicatesSkipped).toBe(0)
    expect(result.errors).toEqual([])
    expect(store.jobs.size).toBe(1)
  })

  it('deduplicates on re-import', async () => {
    const fixture = [
      {
        id: 'ext-2',
        title: 'Already Imported',
        messages: [{ role: 'user', content: 'Repeat import test' }],
      },
    ]
    writeFileSync(FIXTURE_FILE, JSON.stringify(fixture))

    const store = makeStore()
    const convStore = makeConversationStore()

    // Pre-register existing conversation by adding to the closure map.
    store.convMap.set('ext-2', 'conv-existing')

    const mockEventBus: CapabilityEventBus = {
      emit: () => {},
      on: () => () => {},
      once: () => () => {},
    } as unknown as CapabilityEventBus

    const mockExtractor: KnowledgeExtractor = {
      extractFromMessage: async () => [],
      extractIncremental: async () => [],
      extractFromConversation: async () => [],
      batchExtract: async () => ({ totalExtracted: 0, byType: {} as Record<string, number> }),
    } as unknown as KnowledgeExtractor

    const engine = new KnowledgeIngestionEngine(
      store,
      convStore,
      {} as StreamBlockStoreContract,
      mockExtractor,
      mockEventBus,
    )

    const result = await engine.ingest({
      source: 'generic',
      filePath: FIXTURE_FILE,
      deduplicate: true,
      extractEntities: false,
      extractDecisions: false,
      generateEmbeddings: false,
    })

    expect(result.duplicatesSkipped).toBe(1)
    expect(result.conversationsImported).toBe(0)
  })

  it('provides import preview', async () => {
    const fixture = [
      { id: 'p1', title: 'Preview Test 1', messages: [{ role: 'user', content: 'Message A' }] },
      { id: 'p2', title: 'Preview Test 2', messages: [{ role: 'user', content: 'Message B' }] },
    ]
    writeFileSync(FIXTURE_FILE, JSON.stringify(fixture))

    const store = makeStore()
    const convStore = makeConversationStore()

    const mockEventBus: CapabilityEventBus = {
      emit: () => {},
      on: () => () => {},
      once: () => () => {},
    } as unknown as CapabilityEventBus

    const mockExtractor: KnowledgeExtractor = {
      extractFromMessage: async () => [],
      extractIncremental: async () => [],
      extractFromConversation: async () => [],
      batchExtract: async () => ({ totalExtracted: 0, byType: {} as Record<string, number> }),
    } as unknown as KnowledgeExtractor

    const engine = new KnowledgeIngestionEngine(
      store,
      convStore,
      {} as StreamBlockStoreContract,
      mockExtractor,
      mockEventBus,
    )

    const preview = await (engine as any).preview(FIXTURE_FILE, 'generic')

    expect(preview.totalConversations).toBe(2)
    expect(preview.totalMessages).toBe(2)
    expect(preview.sample).toHaveLength(2)
    expect(preview.sample[0]?.title).toBe('Preview Test 1')
    expect(preview.sample[0]?.messageCount).toBe(1)
  })
})
