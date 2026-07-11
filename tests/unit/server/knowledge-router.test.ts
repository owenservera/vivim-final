// tests/unit/server/knowledge-router.test.ts
// Tests for knowledge REST API routes

import { describe, expect, it, mock } from 'bun:test'
import { createKnowledgeRouter } from '../../../src/server/knowledge-router.js'

function makeCtx(overrides: Record<string, unknown> = {}) {
  return {
    port: 9420,
    db: {
      prisma: {
        entity: { findMany: mock(() => Promise.resolve([])) },
        decisionRecord: { findMany: mock(() => Promise.resolve([])) },
        topic: {
          findMany: mock(() => Promise.resolve([])),
          create: mock((args: any) => Promise.resolve({ id: 't1', ...args.data })),
        },
        importJob: {
          findMany: mock(() => Promise.resolve([])),
          findUnique: mock(() => Promise.resolve(null)),
        },
      },
    },
    eventBus: { emit: mock(() => {}), on: mock(() => {}) },
    ...overrides,
  } as any
}

function makeReq(path: string, method = 'GET', body?: unknown) {
  const init: RequestInit = { method }
  if (body) init.body = JSON.stringify(body)
  return new Request(`http://localhost:9420${path}`, init)
}

describe('Knowledge Router', () => {
  it('POST /api/knowledge/ingest returns 201', async () => {
    const ingest = mock(() => Promise.resolve({ jobId: 'j1', conversationsImported: 1 }))
    const ctx = makeCtx({ knowledgeIngestion: { ingest } })
    const router = createKnowledgeRouter(ctx)
    const res = await router(
      makeReq('/api/knowledge/ingest', 'POST', { source: 'chatgpt', filePath: '/tmp/test.json' }),
    )
    expect(res.status).toBe(201)
    expect(ingest).toHaveBeenCalled()
  })

  it('POST /api/knowledge/ingest validates source and filePath', async () => {
    const ctx = makeCtx()
    const router = createKnowledgeRouter(ctx)
    const res = await router(makeReq('/api/knowledge/ingest', 'POST', { source: 'chatgpt' }))
    expect(res.status).toBe(400)
  })

  it('POST /api/knowledge/ingest returns 500 when engine not wired', async () => {
    const ctx = makeCtx({ knowledgeIngestion: undefined })
    const router = createKnowledgeRouter(ctx)
    const res = await router(
      makeReq('/api/knowledge/ingest', 'POST', { source: 'chatgpt', filePath: '/tmp/test.json' }),
    )
    expect(res.status).toBe(500)
  })

  it('GET /api/knowledge/search returns results', async () => {
    const search = mock(() => Promise.resolve([{ id: '1', score: 0.9 }]))
    const ctx = makeCtx({ semanticSearch: { search } })
    const router = createKnowledgeRouter(ctx)
    const res = await router(makeReq('/api/knowledge/search?q=test'))
    expect(res.status).toBe(200)
    expect(search).toHaveBeenCalled()
  })

  it('GET /api/knowledge/search validates q param', async () => {
    const ctx = makeCtx()
    const router = createKnowledgeRouter(ctx)
    const res = await router(makeReq('/api/knowledge/search'))
    expect(res.status).toBe(400)
  })

  it('POST /api/knowledge/synthesize returns result', async () => {
    const synthesize = mock(() => Promise.resolve({ answer: 'test', sources: [], confidence: 0.8 }))
    const ctx = makeCtx({ synthesizer: { synthesize } })
    const router = createKnowledgeRouter(ctx)
    const res = await router(makeReq('/api/knowledge/synthesize', 'POST', { question: 'what?' }))
    expect(res.status).toBe(200)
    expect(synthesize).toHaveBeenCalled()
  })

  it('POST /api/knowledge/synthesize validates question', async () => {
    const ctx = makeCtx()
    const router = createKnowledgeRouter(ctx)
    const res = await router(makeReq('/api/knowledge/synthesize', 'POST', {}))
    expect(res.status).toBe(400)
  })

  it('GET /api/knowledge/export returns result', async () => {
    const exportFn = mock(() => Promise.resolve({ filePath: 'out.json', totalRows: 10 }))
    const ctx = makeCtx({ exportEngine: { export: exportFn } })
    const router = createKnowledgeRouter(ctx)
    const res = await router(makeReq('/api/knowledge/export'))
    expect(res.status).toBe(200)
    expect(exportFn).toHaveBeenCalled()
  })

  it('GET /api/knowledge/entities returns list', async () => {
    const ctx = makeCtx()
    const router = createKnowledgeRouter(ctx)
    const res = await router(makeReq('/api/knowledge/entities'))
    expect(res.status).toBe(200)
  })

  it('GET /api/knowledge/decisions returns list', async () => {
    const ctx = makeCtx()
    const router = createKnowledgeRouter(ctx)
    const res = await router(makeReq('/api/knowledge/decisions'))
    expect(res.status).toBe(200)
  })

  it('GET /api/knowledge/topics returns list', async () => {
    const ctx = makeCtx()
    const router = createKnowledgeRouter(ctx)
    const res = await router(makeReq('/api/knowledge/topics'))
    expect(res.status).toBe(200)
  })

  it('POST /api/knowledge/topics creates topic', async () => {
    const ctx = makeCtx()
    const router = createKnowledgeRouter(ctx)
    const res = await router(makeReq('/api/knowledge/topics', 'POST', { name: 'test-topic' }))
    expect(res.status).toBe(201)
  })

  it('POST /api/knowledge/topics validates name', async () => {
    const ctx = makeCtx()
    const router = createKnowledgeRouter(ctx)
    const res = await router(makeReq('/api/knowledge/topics', 'POST', {}))
    expect(res.status).toBe(400)
  })

  it('GET /api/knowledge/jobs returns list', async () => {
    const ctx = makeCtx()
    const router = createKnowledgeRouter(ctx)
    const res = await router(makeReq('/api/knowledge/jobs'))
    expect(res.status).toBe(200)
  })

  it('GET /api/knowledge/jobs/:id returns 404 when not found', async () => {
    const ctx = makeCtx()
    const router = createKnowledgeRouter(ctx)
    const res = await router(makeReq('/api/knowledge/jobs/nonexistent'))
    expect(res.status).toBe(404)
  })

  it('returns 404 for unknown routes', async () => {
    const ctx = makeCtx()
    const router = createKnowledgeRouter(ctx)
    const res = await router(makeReq('/api/knowledge/unknown'))
    expect(res.status).toBe(404)
  })
})
