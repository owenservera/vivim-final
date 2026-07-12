// src/server/memory-viz-router.ts
// Memory Visualization API — REST routes for memory graph, timeline, stats.

import type { MemoryEngine } from '../engines/memory-engine.js'

interface MemoryVizRequest {
  url: string
  method: string
}

interface MemoryVizResponse {
  status: number
  body: unknown
}

export function createMemoryVizRouter(memory: MemoryEngine) {
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

    return { status: 404, body: { error: 'Not found' } }
  }
}
