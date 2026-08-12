import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import { mkdirSync, unlinkSync, writeFileSync } from 'node:fs'
import type { CapabilityEventBus } from '../../../src/engines/capability-event-bus.js'
import type { KnowledgeExtractor } from '../../../src/engines/knowledge-extractor.js'
import { KnowledgeIngestionEngine } from '../../../src/engines/knowledge-ingestion.js'
import type {
  ConversationMessageRow,
  ConversationRow,
  ConversationStore,
} from '../../../src/storage/contracts/conversation-store.js'
import type { KnowledgeIngestionStore } from '../../../src/storage/contracts/knowledge-ingestion-store.js'
import type { StreamBlockStoreContract } from '../../../src/storage/contracts/stream-block-store.js'

const FIXTURE_DIR = `${import.meta.dir}/fixtures`

function mockStore(): KnowledgeIngestionStore {
  const jobs = new Map<string, any>()
  return {
    createImportJob: async (job) => {
      jobs.set(job.id, { ...job, resultJson: null, completedAt: null })
    },
    updateImportJob: async (id, patch) => {
      const j = jobs.get(id)
      if (j) Object.assign(j, patch)
    },
    getImportJob: async (id) => jobs.get(id) ?? null,
    listImportJobs: async (opts) => Array.from(jobs.values()).slice(0, opts?.limit),
    findExistingConversation: async () => null,
  }
}

function mockConversationStore(): ConversationStore {
  return {
    getConversation: async () => null,
    createConversation: async (input) => {
      const row: ConversationRow = {
        id: `conv-${Date.now()}`,
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
      return row
    },
    updateConversation: async () => {},
    deleteConversation: async () => {},
    listConversations: async () => [],
    createMessage: async (input) => {
      const row: ConversationMessageRow = {
        id: `msg-${Date.now()}`,
        conversationId: input.conversationId,
        role: input.role,
        content: input.content ?? null,
        blocksJson: input.blocksJson ?? '[]',
        blockCount: input.blockCount ?? 0,
        parentMessageId: null,
        sequenceIndex: input.sequenceIndex ?? 0,
        latencyMs: null,
        tokenCount: null,
        model: null,
        metadataJson: '{}',
        createdAt: Date.now(),
      }
      return row
    },
    getMessage: async () => null,
    getMessages: async () => [],
    getLastMessage: async () => null,
    updateMessage: async () => {},
    getAccount: async () => null,
    createAttachment: async () => ({
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
    getAttachments: async () => [],
    getAttachment: async () => null,
    deleteAttachment: async () => {},
    getConversationByExternalId: async () => null,
    upsertConversationByExternalId: async () => ({ id: 'x' }) as never,
    listConversationsByAccountId: async () => [],
    createMessages: async () => [],
  }
}

function mockBlockStore(): StreamBlockStoreContract {
  return {
    storeBlocks: async () => {},
    getBlocksByConversation: async () => [],
    getBlocksByMessage: async () => [],
  }
}

function mockExtractor(): KnowledgeExtractor {
  return {
    extractFromMessage: async () => [],
    extractFromConversation: async () => [],
    batchExtract: async () => ({ totalExtracted: 0, byType: {} as any }),
  } as unknown as KnowledgeExtractor
}

function mockEventBus(): CapabilityEventBus {
  const captured: any[] = []
  return {
    emit: (e: any) => {
      captured.push(e)
    },
    on: () => () => {},
    once: () => () => {},
    subscribe: () => {},
    unsubscribe: () => {},
    unsubscribeAll: () => {},
    removeAllListeners: () => {},
    resetInstance: () => {},
    getInstance: () => ({}) as any,
    captured,
  } as unknown as CapabilityEventBus & { captured: any[] }
}

const sampleConversations = [
  {
    id: 'c1',
    title: 'First Chat',
    messages: [
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Hi there' },
    ],
  },
]

beforeAll(() => {
  try {
    mkdirSync(FIXTURE_DIR, { recursive: true })
  } catch {}
  // [audit] log the error with context here
  writeFileSync(`${FIXTURE_DIR}/generic-import.json`, JSON.stringify(sampleConversations), 'utf-8')
  writeFileSync(
    `${FIXTURE_DIR}/chatgpt-export.json`,
    JSON.stringify([
      {
        id: 'c1',
        title: 'ChatGPT Chat',
        messages: [
          { role: 'user', content: 'Hello', create_time: 1000 },
          { role: 'assistant', content: 'Hi', create_time: 1001 },
        ],
      },
    ]),
    'utf-8',
  )
})

afterAll(() => {
  try {
    unlinkSync(`${FIXTURE_DIR}/generic-import.json`)
  } catch {}
  // [audit] log the error with context here
  try {
    unlinkSync(`${FIXTURE_DIR}/chatgpt-export.json`)
  } catch {}
  // [audit] log the error with context here
})

describe('KnowledgeIngestionEngine', () => {
  it('ingests a ChatGPT export file', async () => {
    const store = mockStore()
    const convStore = mockConversationStore()
    const engine = new KnowledgeIngestionEngine(
      store,
      convStore,
      mockBlockStore(),
      mockExtractor(),
      mockEventBus(),
    )

    const result = await engine.ingest({
      source: 'chatgpt',
      filePath: `${FIXTURE_DIR}/chatgpt-export.json`,
      deduplicate: true,
      extractEntities: false,
      extractDecisions: false,
      generateEmbeddings: false,
    })

    expect(result.conversationsImported).toBe(1)
    expect(result.messagesImported).toBe(2)
    expect(result.source).toBe('chatgpt')
  })

  it('creates conversations with source=imported via providerId', async () => {
    const store = mockStore()
    const convStore = mockConversationStore()
    const engine = new KnowledgeIngestionEngine(
      store,
      convStore,
      mockBlockStore(),
      mockExtractor(),
      mockEventBus(),
    )

    const result = await engine.ingest({
      source: 'generic',
      filePath: `${FIXTURE_DIR}/generic-import.json`,
      deduplicate: true,
      extractEntities: false,
      extractDecisions: false,
      generateEmbeddings: false,
    })

    expect(result.conversationsImported).toBe(1)
    expect(result.messagesImported).toBe(2)
  })

  it('skips duplicates when deduplicate is true', async () => {
    const seen = new Map<string, string>()
    const store: KnowledgeIngestionStore = {
      ...mockStore(),
      findExistingConversation: async (src, extId) => seen.get(`${src}:${extId}`) ?? null,
    }
    const convStore = mockConversationStore()
    const engine = new KnowledgeIngestionEngine(
      store,
      convStore,
      mockBlockStore(),
      mockExtractor(),
      mockEventBus(),
    )

    const r1 = await engine.ingest({
      source: 'generic',
      filePath: `${FIXTURE_DIR}/generic-import.json`,
      deduplicate: true,
      extractEntities: false,
      extractDecisions: false,
      generateEmbeddings: false,
    })
    seen.set('generic:c1', 'existing-conv-id')

    const r2 = await engine.ingest({
      source: 'generic',
      filePath: `${FIXTURE_DIR}/generic-import.json`,
      deduplicate: true,
      extractEntities: false,
      extractDecisions: false,
      generateEmbeddings: false,
    })

    expect(r1.conversationsImported).toBe(1)
    expect(r2.duplicatesSkipped).toBe(1)
    expect(r2.conversationsImported).toBe(0)
  })

  it('records job status transitions: pending -> importing -> complete', async () => {
    const store = mockStore()
    const convStore = mockConversationStore()
    const engine = new KnowledgeIngestionEngine(
      store,
      convStore,
      mockBlockStore(),
      mockExtractor(),
      mockEventBus(),
    )

    const result = await engine.ingest({
      source: 'generic',
      filePath: `${FIXTURE_DIR}/generic-import.json`,
      deduplicate: true,
      extractEntities: false,
      extractDecisions: false,
      generateEmbeddings: false,
    })

    const job = await store.getImportJob(result.jobId)
    expect(job?.status).toBe('complete')
  })

  it('continues when one conversation fails', async () => {
    const store = mockStore()
    const convStore: ConversationStore = {
      ...mockConversationStore(),
      createConversation: async () => {
        throw new Error('db error')
      },
    }
    const engine = new KnowledgeIngestionEngine(
      store,
      convStore,
      mockBlockStore(),
      mockExtractor(),
      mockEventBus(),
    )

    const result = await engine.ingest({
      source: 'generic',
      filePath: `${FIXTURE_DIR}/generic-import.json`,
      deduplicate: true,
      extractEntities: false,
      extractDecisions: false,
      generateEmbeddings: false,
    })

    expect(result.errors.length).toBeGreaterThan(0)
    expect(result.conversationsImported).toBe(0)
  })

  it('rejects file-not-found error', async () => {
    const store = mockStore()
    const convStore = mockConversationStore()
    const engine = new KnowledgeIngestionEngine(
      store,
      convStore,
      mockBlockStore(),
      mockExtractor(),
      mockEventBus(),
    )

    await expect(
      engine.ingest({
        source: 'generic',
        filePath: '/nonexistent/file.json',
        deduplicate: true,
        extractEntities: false,
        extractDecisions: false,
        generateEmbeddings: false,
      }),
    ).rejects.toThrow()
  })

  it('lists jobs and gets job status', async () => {
    const store = mockStore()
    const convStore = mockConversationStore()
    const engine = new KnowledgeIngestionEngine(
      store,
      convStore,
      mockBlockStore(),
      mockExtractor(),
      mockEventBus(),
    )

    const result = await engine.ingest({
      source: 'generic',
      filePath: `${FIXTURE_DIR}/generic-import.json`,
      deduplicate: true,
      extractEntities: false,
      extractDecisions: false,
      generateEmbeddings: false,
    })

    const status = await engine.getJobStatus(result.jobId)
    expect(status).not.toBeNull()
    expect(status?.jobId).toBe(result.jobId)

    const jobs = await engine.listJobs()
    expect(jobs.length).toBeGreaterThan(0)
  })

  it('cancels a job', async () => {
    const store = mockStore()
    const convStore = mockConversationStore()
    const engine = new KnowledgeIngestionEngine(
      store,
      convStore,
      mockBlockStore(),
      mockExtractor(),
      mockEventBus(),
    )

    const result = await engine.ingest({
      source: 'generic',
      filePath: `${FIXTURE_DIR}/generic-import.json`,
      deduplicate: true,
      extractEntities: false,
      extractDecisions: false,
      generateEmbeddings: false,
    })

    await engine.cancelJob(result.jobId)
    const status = await engine.getJobStatus(result.jobId)
    expect(status?.phase).toBe('cancelled')
  })

  it('ingestFile delegates to ingest with defaults', async () => {
    const store = mockStore()
    const convStore = mockConversationStore()
    const engine = new KnowledgeIngestionEngine(
      store,
      convStore,
      mockBlockStore(),
      mockExtractor(),
      mockEventBus(),
    )

    const result = await engine.ingestFile(`${FIXTURE_DIR}/generic-import.json`, 'generic')
    expect(result.source).toBe('generic')
    expect(result.conversationsImported).toBe(1)
  })

  it('extracts entities from imported messages', async () => {
    const store = mockStore()
    const messagesByConv = new Map<string, Array<{ id: string; role: string; content: string }>>()
    const convStore = {
      ...mockConversationStore(),
      createConversation: async (input: any) => {
        const id = `conv-${Date.now()}`
        return {
          id,
          providerSessionId: input.providerSessionId,
          providerId: input.providerId,
          title: input.title ?? null,
          state: input.state ?? 'active',
          messageCount: 0,
          lastMessageAt: null,
          contextJson: '{}',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        }
      },
      createMessage: async (input: any) => {
        const id = `msg-${Date.now()}`
        const convMsgs = messagesByConv.get(input.conversationId) ?? []
        convMsgs.push({ id, role: input.role, content: input.content ?? '' })
        messagesByConv.set(input.conversationId, convMsgs)
        return {
          id,
          conversationId: input.conversationId,
          role: input.role,
          content: input.content ?? null,
          blocksJson: '[]',
          blockCount: 0,
          parentMessageId: null,
          sequenceIndex: input.sequenceIndex ?? 0,
          latencyMs: null,
          tokenCount: null,
          model: null,
          metadataJson: '{}',
          createdAt: Date.now(),
        }
      },
      getMessages: async (convId: string) => messagesByConv.get(convId) ?? [],
    } as any

    const extractor = {
      extractFromMessage: async () => [],
      extractFromConversation: async () => [],
      batchExtract: async () => ({
        totalExtracted: 3,
        byType: { entity_technology: 2, decision: 1 },
      }),
    } as any

    const engine = new KnowledgeIngestionEngine(
      store,
      convStore,
      mockBlockStore(),
      extractor,
      mockEventBus(),
    )

    const result = await engine.ingest({
      source: 'generic',
      filePath: `${FIXTURE_DIR}/generic-import.json`,
      deduplicate: true,
      extractEntities: true,
      extractDecisions: true,
      generateEmbeddings: false,
    })

    expect(result.entitiesExtracted).toBeGreaterThan(0)
    expect(result.entitiesExtracted).toBe(3)
  })

  it('extraction failure does not fail import', async () => {
    const store = mockStore()
    const messagesByConv = new Map<string, Array<{ id: string; role: string; content: string }>>()
    const convStore = {
      ...mockConversationStore(),
      createConversation: async (input: any) => {
        const id = `conv-${Date.now()}`
        return {
          id,
          providerSessionId: input.providerSessionId,
          providerId: input.providerId,
          title: input.title ?? null,
          state: input.state ?? 'active',
          messageCount: 0,
          lastMessageAt: null,
          contextJson: '{}',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        }
      },
      createMessage: async (input: any) => {
        const id = `msg-${Date.now()}`
        const convMsgs = messagesByConv.get(input.conversationId) ?? []
        convMsgs.push({ id, role: input.role, content: input.content ?? '' })
        messagesByConv.set(input.conversationId, convMsgs)
        return {
          id,
          conversationId: input.conversationId,
          role: input.role,
          content: input.content ?? null,
          blocksJson: '[]',
          blockCount: 0,
          parentMessageId: null,
          sequenceIndex: input.sequenceIndex ?? 0,
          latencyMs: null,
          tokenCount: null,
          model: null,
          metadataJson: '{}',
          createdAt: Date.now(),
        }
      },
      getMessages: async (convId: string) => messagesByConv.get(convId) ?? [],
    } as any

    const extractor = {
      extractFromMessage: async () => [],
      extractFromConversation: async () => [],
      batchExtract: async () => {
        throw new Error('extraction failed')
      },
    } as any

    const engine = new KnowledgeIngestionEngine(
      store,
      convStore,
      mockBlockStore(),
      extractor,
      mockEventBus(),
    )

    const result = await engine.ingest({
      source: 'generic',
      filePath: `${FIXTURE_DIR}/generic-import.json`,
      deduplicate: true,
      extractEntities: true,
      extractDecisions: true,
      generateEmbeddings: false,
    })

    expect(result.conversationsImported).toBeGreaterThan(0)
    expect(result.errors.some((e) => e.error.includes('extract'))).toBe(true)
  })
})
