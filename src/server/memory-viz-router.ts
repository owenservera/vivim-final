// src/server/memory-viz-router.ts
// Memory Visualization API — REST routes for memory graph, timeline, stats.
//
// PRINCIPLE: FRONTEND = BACKEND
// Every request is tagged with its source via X-Source header for audit logging.

import type { MemoryEngine } from '../engines/memory-engine.js'
import type { MemoryCuratedStore } from '../storage/contracts/memory-curated-store.js'

interface MemoryVizRequest {
  url: string
  method: string
  body?: unknown
}

interface MemoryVizResponse {
  status: number
  body: unknown
}

export function createMemoryVizRouter(memory: MemoryEngine, curatedStore?: MemoryCuratedStore) {
  return async (req: MemoryVizRequest): Promise<MemoryVizResponse> => {
    const url = new URL(req.url, 'http://localhost')
    const path = url.pathname

    // GET /api/memory/graph?entityId=X
    if (path === '/api/memory/graph' && req.method === 'GET') {
      const entityId = url.searchParams.get('entityId')
      if (!entityId) {
        return { status: 400, body: { error: 'entityId required' } }
      }
      const facts = await memory.recallFacts(entityId)
      return {
        status: 200,
        body: {
          entity: entityId,
          connections: facts.map((f) => ({
            predicate: f.predicate,
            value: f.object,
            confidence: f.confidence,
          })),
        },
      }
    }

    // GET /api/memory/timeline?from=&to=
    if (path === '/api/memory/timeline' && req.method === 'GET') {
      const from = Number(url.searchParams.get('from') ?? 0)
      const to = Number(url.searchParams.get('to') ?? Date.now())
      const episodes = await memory.recallEpisodes({ since: from, limit: 100 })
      const filtered = episodes.filter((e) => e.timestamp <= to)
      return {
        status: 200,
        body: {
          events: filtered.map((e) => ({
            id: e.id,
            action: e.action,
            timestamp: e.timestamp,
            success: e.success,
          })),
        },
      }
    }

    // GET /api/memory/stats
    if (path === '/api/memory/stats' && req.method === 'GET') {
      const episodes = await memory.recallEpisodes({ limit: 1000 })
      const facts = await memory.recallFacts('')
      return {
        status: 200,
        body: {
          totalEpisodes: episodes.length,
          totalFacts: facts.length,
          successRate:
            episodes.length > 0 ? episodes.filter((e) => e.success).length / episodes.length : 0,
        },
      }
    }

    // GET /api/memory/curated
    if (path === '/api/memory/curated' && req.method === 'GET') {
      const facts = await memory.recallFacts('')
      const curated = facts.filter((f) => f.confidence >= 0.8)
      return {
        status: 200,
        body: {
          entries: curated.map((f) => ({
            id: f.id,
            subject: f.subject,
            predicate: f.predicate,
            value: f.object,
            confidence: f.confidence,
          })),
        },
      }
    }

    // POST /api/memory/assert  { content } — persist a semantic fact
    if (path === '/api/memory/assert' && req.method === 'POST') {
      let body: { content?: string }
      try {
        body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body ?? {})
      } catch {
        return { status: 400, body: { error: 'invalid json body' } }
      }
      const content = (body.content ?? '').trim()
      if (!content) {
        return { status: 400, body: { error: 'content required' } }
      }
      await memory.assertFact({
        subject: content,
        predicate: 'asserted',
        object: content,
        confidence: 1.0,
        source: 'memory-viz-router',
      })
      return { status: 201, body: { ok: true } }
    }

    // POST /api/memory/curate  { id, memoryType, memoryId, action }
    if (path === '/api/memory/curate' && req.method === 'POST') {
      if (!curatedStore) {
        return { status: 501, body: { error: 'curation store not configured' } }
      }
      let body: { id?: string; memoryType?: string; memoryId?: string; action?: string }
      try {
        body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body ?? {})
      } catch {
        return { status: 400, body: { error: 'invalid json body' } }
      }
      const memoryType = body.memoryType ?? 'fact'
      const memoryId = body.memoryId ?? body.id
      if (!memoryId) {
        return { status: 400, body: { error: 'memoryId required' } }
      }
      switch (body.action) {
        case 'pin':
          await curatedStore.setPinned(memoryType, memoryId, true)
          break
        case 'hide':
          await curatedStore.setVerified(memoryType, memoryId, false)
          break
        case 'merge':
          await curatedStore.upsert({
            id: `${memoryType}:${memoryId}`,
            memoryType,
            memoryId,
            isPinned: false,
            isVerified: true,
            note: 'merged',
          })
          break
        default:
          return { status: 400, body: { error: 'unknown action' } }
      }
      return { status: 200, body: { ok: true, action: body.action, memoryId } }
    }

    return { status: 404, body: { error: 'Not found' } }
  }
}
