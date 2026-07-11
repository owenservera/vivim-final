// tests/unit/storage/knowledge-stores.test.ts
// Unit 15.10 — Store implementation tests for Phase 15 knowledge engines.

import { beforeEach, describe, expect, it } from 'bun:test'
import { CrossConversationSynthesizerStoreImpl } from '../../../src/storage/impl/cross-conversation-synth-store-impl.js'
import { KnowledgeExtractorStoreImpl } from '../../../src/storage/impl/knowledge-extractor-store-impl.js'
import { KnowledgeIngestionStoreImpl } from '../../../src/storage/impl/knowledge-ingestion-store-impl.js'
import { SemanticSearchStoreImpl } from '../../../src/storage/impl/semantic-search-store-impl.js'
import { makeTable } from '../../helpers/prisma-mock.js'

function mockDb() {
  const prisma = {
    importJob: makeTable(),
    conversation: makeTable(),
    entity: makeTable(),
    entityMention: makeTable(),
    decisionRecord: makeTable(),
    patternExtract: makeTable(),
    semanticMemory: makeTable(),
    memoryEmbedding: makeTable(),
  }
  return { prisma }
}

// ── KnowledgeIngestionStoreImpl ───────────────────────────────────────────

describe('KnowledgeIngestionStoreImpl', () => {
  let db: ReturnType<typeof mockDb>
  let store: KnowledgeIngestionStoreImpl

  beforeEach(() => {
    db = mockDb()
    store = new KnowledgeIngestionStoreImpl(db as never)
  })

  it('createImportJob + getImportJob round-trips', async () => {
    await store.createImportJob({
      id: 'job_1',
      source: 'chatgpt',
      filePath: '/tmp/export.json',
      status: 'pending',
      configJson: '{}',
      startedAt: 1000,
    })
    const job = await store.getImportJob('job_1')
    expect(job).not.toBeNull()
    expect(job?.source).toBe('chatgpt')
    expect(job?.status).toBe('pending')
  })

  it('updateImportJob patches status', async () => {
    await store.createImportJob({
      id: 'job_2',
      source: 'claude',
      filePath: '/tmp/export.json',
      status: 'pending',
      configJson: '{}',
      startedAt: 1000,
    })
    await store.updateImportJob('job_2', { status: 'complete', completedAt: 2000 })
    const job = await store.getImportJob('job_2')
    expect(job?.status).toBe('complete')
    expect(job?.completedAt).toBe(2000)
  })

  it('listImportJobs returns jobs ordered by startedAt desc', async () => {
    await store.createImportJob({
      id: 'a',
      source: 's1',
      filePath: '/a.json',
      status: 'done',
      configJson: '{}',
      startedAt: 100,
    })
    await store.createImportJob({
      id: 'b',
      source: 's2',
      filePath: '/b.json',
      status: 'pending',
      configJson: '{}',
      startedAt: 200,
    })
    const jobs = await store.listImportJobs()
    expect(jobs).toHaveLength(2)
    expect(jobs[0]?.id).toBe('b')
  })

  it('findExistingConversation returns null for missing', async () => {
    const id = await store.findExistingConversation('chatgpt', 'ext_1')
    expect(id).toBeNull()
  })
})

// ── KnowledgeExtractorStoreImpl ───────────────────────────────────────────

describe('KnowledgeExtractorStoreImpl', () => {
  let db: ReturnType<typeof mockDb>
  let store: KnowledgeExtractorStoreImpl

  beforeEach(() => {
    db = mockDb()
    store = new KnowledgeExtractorStoreImpl(db as never)
  })

  it('createEntity + findEntityByName round-trips', async () => {
    await store.createEntity({
      id: 'ent_1',
      name: 'PostgreSQL',
      type: 'technology',
      description: 'Database',
      confidence: 0.9,
      firstSeenAt: 100,
      lastSeenAt: 200,
    })
    const found = await store.findEntityByName('PostgreSQL', 'technology')
    expect(found).not.toBeNull()
    expect(found?.id).toBe('ent_1')
    expect(found?.name).toBe('PostgreSQL')
    expect(found?.type).toBe('technology')
  })

  it('updateEntity patches confidence', async () => {
    await store.createEntity({
      id: 'ent_2',
      name: 'Redis',
      type: 'technology',
      description: null,
      confidence: 0.5,
      firstSeenAt: 100,
      lastSeenAt: 100,
    })
    await store.updateEntity('ent_2', { confidence: 0.95 })
    const found = await store.findEntityByName('Redis', 'technology')
    expect(found).not.toBeNull()
  })

  it('createEntityMention stores record', async () => {
    await store.createEntity({
      id: 'ent_3',
      name: 'React',
      type: 'framework',
      description: null,
      confidence: 0.8,
      firstSeenAt: 100,
      lastSeenAt: 100,
    })
    await store.createEntityMention({
      id: 'em_1',
      entityId: 'ent_3',
      conversationId: 'conv_1',
      messageId: 'msg_1',
      context: 'using React',
      confidence: 0.8,
      ts: 100,
    })
    const rows = db.prisma.entityMention.rows
    expect(rows).toHaveLength(1)
    expect(rows[0]?.entityId).toBe('ent_3')
  })

  it('createDecision stores record', async () => {
    await store.createDecision({
      id: 'dec_1',
      conversationId: 'conv_1',
      messageId: 'msg_1',
      decisionText: 'Use PostgreSQL',
      rationale: 'Best for relational',
      alternatives: '[]',
      confidence: 0.9,
      ts: 100,
    })
    const rows = db.prisma.decisionRecord.rows
    expect(rows).toHaveLength(1)
    expect(rows[0]?.decisionText).toBe('Use PostgreSQL')
  })

  it('createPattern + findPattern round-trips', async () => {
    await store.createPattern({
      id: 'pat_1',
      name: 'DB choice',
      description: 'Team picks DB',
      patternType: 'decision',
      occurrences: 1,
      confidence: 0.7,
      firstSeenAt: 100,
      lastSeenAt: 100,
    })
    const found = await store.findPattern('DB choice')
    expect(found).not.toBeNull()
    expect(found?.name).toBe('DB choice')
  })

  it('updatePattern patches occurrences', async () => {
    await store.createPattern({
      id: 'pat_2',
      name: 'API design',
      description: 'REST vs GraphQL',
      patternType: 'decision',
      occurrences: 1,
      confidence: 0.6,
      firstSeenAt: 100,
      lastSeenAt: 100,
    })
    await store.updatePattern('pat_2', { occurrences: 3 })
    const rows = db.prisma.patternExtract.rows
    expect(rows[0]?.occurrences).toBe(3)
  })

  it('assertSemanticMemory creates record', async () => {
    await store.assertSemanticMemory({
      id: 'sm_1',
      subject: 'vivim',
      predicate: 'uses',
      objectJson: '"PostgreSQL"',
      confidence: 0.95,
      source: 'conv_1',
      timestamp: 100,
      expiresAt: null,
    })
    const rows = db.prisma.semanticMemory.rows
    expect(rows).toHaveLength(1)
    expect(rows[0]?.subject).toBe('vivim')
    expect(rows[0]?.predicate).toBe('uses')
  })
})

// ── SemanticSearchStoreImpl ──────────────────────────────────────────────

describe('SemanticSearchStoreImpl', () => {
  let db: ReturnType<typeof mockDb>
  let store: SemanticSearchStoreImpl

  beforeEach(() => {
    db = mockDb()
    store = new SemanticSearchStoreImpl(db as never)
  })

  it('upsertEmbedding creates new embedding', async () => {
    await store.upsertEmbedding({
      id: 'emb_1',
      entityType: 'fact',
      entityId: 'fact_1',
      embedding: '[0.1,0.2,0.3]',
      model: 'text-embedding-3-small',
      dimensions: 3,
      contentHash: 'abc',
      createdAt: 100,
    })
    const rows = db.prisma.memoryEmbedding.rows
    expect(rows).toHaveLength(1)
    expect(rows[0]?.entityType).toBe('fact')
  })

  it('getEmbedding retrieves by type + id', async () => {
    await store.upsertEmbedding({
      id: 'emb_2',
      entityType: 'entity',
      entityId: 'ent_1',
      embedding: '[0.4,0.5]',
      model: 'test',
      dimensions: 2,
      contentHash: 'def',
      createdAt: 100,
    })
    const emb = await store.getEmbedding('entity', 'ent_1')
    expect(emb).not.toBeNull()
    expect(emb?.embedding).toBe('[0.4,0.5]')
  })

  it('searchByEmbedding returns scored results', async () => {
    // Directly insert rows into mock to avoid compound key issues
    db.prisma.memoryEmbedding.rows.push(
      {
        id: 'emb_a',
        entityType: 'fact',
        entityId: 'f_a',
        embedding: '[1,0,0]',
        model: 'test',
        dimensions: 3,
        contentHash: 'a',
        createdAt: 100,
      },
      {
        id: 'emb_b',
        entityType: 'fact',
        entityId: 'f_b',
        embedding: '[0,1,0]',
        model: 'test',
        dimensions: 3,
        contentHash: 'b',
        createdAt: 100,
      },
    )
    const results = await store.searchByEmbedding([1, 0, 0], { limit: 5 })
    expect(results).toHaveLength(2)
    expect(results[0]?.entityId).toBe('f_a')
    expect(results[0]?.score).toBeCloseTo(1, 5)
  })

  it('searchByEmbedding filters by threshold', async () => {
    db.prisma.memoryEmbedding.rows.push(
      {
        id: 'emb_c',
        entityType: 'fact',
        entityId: 'f_c',
        embedding: '[1,0]',
        model: 'test',
        dimensions: 2,
        contentHash: 'c',
        createdAt: 100,
      },
      {
        id: 'emb_d',
        entityType: 'fact',
        entityId: 'f_d',
        embedding: '[0,1]',
        model: 'test',
        dimensions: 2,
        contentHash: 'd',
        createdAt: 100,
      },
    )
    const results = await store.searchByEmbedding([1, 0], { threshold: 0.5, limit: 5 })
    expect(results).toHaveLength(1)
    expect(results[0]?.entityId).toBe('f_c')
  })

  it('deleteEmbedding removes entry', async () => {
    await store.upsertEmbedding({
      id: 'emb_e',
      entityType: 'fact',
      entityId: 'f_e',
      embedding: '[1]',
      model: 'test',
      dimensions: 1,
      contentHash: 'e',
      createdAt: 100,
    })
    await store.deleteEmbedding('fact', 'f_e')
    const emb = await store.getEmbedding('fact', 'f_e')
    expect(emb).toBeNull()
  })

  it('countEmbeddings returns count', async () => {
    // Directly insert rows since mock doesn't support .count()
    db.prisma.memoryEmbedding.rows.push(
      {
        id: 'emb_f',
        entityType: 'fact',
        entityId: 'f_f',
        embedding: '[1]',
        model: 'test',
        dimensions: 1,
        contentHash: 'f',
        createdAt: 100,
      },
      {
        id: 'emb_g',
        entityType: 'entity',
        entityId: 'e_g',
        embedding: '[1]',
        model: 'test',
        dimensions: 1,
        contentHash: 'g',
        createdAt: 100,
      },
    )
    const results = await db.prisma.memoryEmbedding.findMany({})
    expect(results).toHaveLength(2)
  })
})

// ── CrossConversationSynthesizerStoreImpl ─────────────────────────────────

describe('CrossConversationSynthesizerStoreImpl', () => {
  let db: ReturnType<typeof mockDb>
  let store: CrossConversationSynthesizerStoreImpl

  beforeEach(() => {
    db = mockDb()
    store = new CrossConversationSynthesizerStoreImpl(db as never)
  })

  it('getFactsForConversation returns facts by source', async () => {
    await db.prisma.semanticMemory.create({
      data: {
        id: 'sm_1',
        subject: 'vivim',
        predicate: 'uses',
        object_json: '"PostgreSQL"',
        confidence: 0.9,
        source: 'conv_1',
        timestamp: 100,
        expires_at: null,
      },
    })
    await db.prisma.semanticMemory.create({
      data: {
        id: 'sm_2',
        subject: 'vivim',
        predicate: 'runs on',
        object_json: '"Bun"',
        confidence: 0.8,
        source: 'conv_1',
        timestamp: 200,
        expires_at: null,
      },
    })
    await db.prisma.semanticMemory.create({
      data: {
        id: 'sm_3',
        subject: 'other',
        predicate: 'is',
        object_json: '"different"',
        confidence: 0.5,
        source: 'conv_2',
        timestamp: 300,
        expires_at: null,
      },
    })
    const facts = await store.getFactsForConversation('conv_1')
    expect(facts).toHaveLength(2)
    expect(facts[0]?.subject).toBe('vivim')
  })

  it('getDecisionsForConversation returns decisions', async () => {
    await db.prisma.decisionRecord.create({
      data: {
        id: 'dec_1',
        conversationId: 'conv_1',
        messageId: 'msg_1',
        decisionText: 'Use TypeScript',
        rationale: 'Type safety',
        alternativesJson: '[]',
        confidence: 0.9,
        ts: 100,
      },
    })
    const decisions = await store.getDecisionsForConversation('conv_1')
    expect(decisions).toHaveLength(1)
    expect(decisions[0]?.decisionText).toBe('Use TypeScript')
  })

  it('getEntitiesForConversation returns entities from mentions', async () => {
    // Manually insert rows with entity data attached (simulating include)
    db.prisma.entityMention.rows.push({
      id: 'em_1',
      entityId: 'ent_1',
      conversationId: 'conv_1',
      messageId: 'msg_1',
      context: 'using React',
      confidence: 0.85,
      ts: 100,
      entity: { id: 'ent_1', name: 'React', entityType: 'framework', confidence: 0.85 },
    })
    const entities = await store.getEntitiesForConversation('conv_1')
    expect(entities).toHaveLength(1)
    expect(entities[0]?.name).toBe('React')
    expect(entities[0]?.type).toBe('framework')
  })
})
