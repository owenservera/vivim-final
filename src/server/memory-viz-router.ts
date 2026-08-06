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
  headers?: Record<string, string>
}

export function createMemoryVizRouter(memory: MemoryEngine, curatedStore?: MemoryCuratedStore) {
  return async (req: MemoryVizRequest): Promise<MemoryVizResponse> => {
    const url = new URL(req.url, 'http://localhost')
    const path = url.pathname

    // GET /api/memory/graph?entityId=X
    if (path === '/api/memory/graph' && req.method === 'GET') {
      const entityId = url.searchParams.get('entityId')
      if (!entityId) {
        return { status: 400, body: { error: 'entityId required', code: 'ValidationError' } }
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

    // GET /api/memory/graph/subgraph?focal=<id>&depth=2
    if (path === '/api/memory/graph/subgraph' && req.method === 'GET') {
      const focal = url.searchParams.get('focal')
      const depth = Number(url.searchParams.get('depth') ?? 2)
      if (!focal) {
        return { status: 400, body: { error: 'focal entity required', code: 'ValidationError' } }
      }
      const allFacts = await memory.getAllFacts()
      const nodes = new Map<
        string,
        { id: string; label: string; type: 'entity' | 'fact'; confidence: number }
      >()
      const edges: Array<{ source: string; target: string; label: string; weight: number }> = []

      const visited = new Set<string>()
      const queue: Array<{ entity: string; currentDepth: number }> = [
        { entity: focal, currentDepth: 0 },
      ]

      while (queue.length > 0) {
        const { entity, currentDepth: d } = queue.shift() as {
          entity: string
          currentDepth: number
        }
        if (visited.has(entity) || d > depth) continue
        visited.add(entity)

        nodes.set(entity, { id: entity, label: entity, type: 'entity', confidence: 1.0 })

        for (const f of allFacts) {
          if (f.subject === entity || f.object === entity) {
            const other = f.subject === entity ? f.object : f.subject
            if (typeof other === 'string') {
              nodes.set(other, {
                id: other,
                label: other,
                type: 'entity',
                confidence: f.confidence,
              })
              edges.push({
                source: f.subject,
                target: String(f.object),
                label: f.predicate,
                weight: f.confidence,
              })
              if (d < depth) queue.push({ entity: other, currentDepth: d + 1 })
            }
          }
        }
      }

      return {
        status: 200,
        body: { nodes: [...nodes.values()], edges },
      }
    }

    // GET /api/memory/graph/neighbors?entity=<id>&k=10
    if (path === '/api/memory/graph/neighbors' && req.method === 'GET') {
      const entity = url.searchParams.get('entity')
      const k = Number(url.searchParams.get('k') ?? 10)
      if (!entity) {
        return { status: 400, body: { error: 'entity required', code: 'ValidationError' } }
      }
      const facts = await memory.recallFacts(entity)
      const neighbors = new Map<
        string,
        { id: string; label: string; confidence: number; predicate: string }
      >()
      for (const f of facts.slice(0, k)) {
        const other = f.subject === entity ? String(f.object) : f.subject
        if (!neighbors.has(other)) {
          neighbors.set(other, {
            id: other,
            label: other,
            confidence: f.confidence,
            predicate: f.predicate,
          })
        }
      }
      return {
        status: 200,
        body: { entity, neighbors: [...neighbors.values()] },
      }
    }

    // GET /api/memory/graph/clusters
    if (path === '/api/memory/graph/clusters' && req.method === 'GET') {
      const allFacts = await memory.getAllFacts()
      const adj = new Map<string, Set<string>>()
      for (const f of allFacts) {
        if (!adj.has(f.subject)) adj.set(f.subject, new Set())
        if (!adj.has(String(f.object))) adj.set(String(f.object), new Set())
        adj.get(f.subject)?.add(String(f.object))
        adj.get(String(f.object))?.add(f.subject)
      }
      // Simple label-propagation community detection
      const labels = new Map<string, string>()
      for (const node of adj.keys()) labels.set(node, node)
      for (let iter = 0; iter < 10; iter++) {
        let changed = false
        for (const [node, neighbors] of adj) {
          const neighborLabels = new Map<string, number>()
          for (const n of neighbors) {
            const l = labels.get(n) ?? n
            neighborLabels.set(l, (neighborLabels.get(l) ?? 0) + 1)
          }
          let bestLabel = labels.get(node) ?? node
          let bestCount = 0
          for (const [l, c] of neighborLabels) {
            if (c > bestCount) {
              bestCount = c
              bestLabel = l
            }
          }
          if (labels.get(node) !== bestLabel) {
            labels.set(node, bestLabel)
            changed = true
          }
        }
        if (!changed) break
      }
      const groups = new Map<string, string[]>()
      for (const [node, label] of labels) {
        if (!groups.has(label)) groups.set(label, [])
        groups.get(label)?.push(node)
      }
      return {
        status: 200,
        body: { clusters: [...groups.entries()].map(([id, members]) => ({ id, members })) },
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
        return { status: 400, body: { error: 'invalid json body', code: 'ValidationError' } }
      }
      const content = (body.content ?? '').trim()
      if (!content) {
        return { status: 400, body: { error: 'content required', code: 'ValidationError' } }
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
        return {
          status: 501,
          body: { error: 'curation store not configured', code: 'NotImplemented' },
        }
      }
      let body: { id?: string; memoryType?: string; memoryId?: string; action?: string }
      try {
        body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body ?? {})
      } catch {
        return { status: 400, body: { error: 'invalid json body', code: 'ValidationError' } }
      }
      const memoryType = body.memoryType ?? 'fact'
      const memoryId = body.memoryId ?? body.id
      if (!memoryId) {
        return { status: 400, body: { error: 'memoryId required', code: 'ValidationError' } }
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
          return { status: 400, body: { error: 'unknown action', code: 'ValidationError' } }
      }
      return { status: 200, body: { ok: true, action: body.action, memoryId } }
    }

    // P3-4: Duplicate — see memory-router.ts for primary /api/memory/export implementation

    // PATCH /api/memory/facts/:id — verify or edit a fact
    if (path.startsWith('/api/memory/facts/') && req.method === 'PATCH') {
      const id = path.split('/api/memory/facts/')[1]
      if (!id) {
        return { status: 400, body: { error: 'fact id required', code: 'ValidationError' } }
      }
      let body: { verified?: boolean; object?: unknown; predicate?: string; by?: string }
      try {
        body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body ?? {})
      } catch {
        return { status: 400, body: { error: 'invalid json body', code: 'ValidationError' } }
      }
      const by = (body.by as string) ?? 'user'
      try {
        if (body.verified === true) {
          await memory.verifyFact(id, by)
          return { status: 200, body: { ok: true, action: 'verify', id } }
        }
        if (body.object !== undefined || body.predicate !== undefined) {
          await memory.editFact(id, { object: body.object, predicate: body.predicate }, by)
          return { status: 200, body: { ok: true, action: 'edit', id } }
        }
        return {
          status: 400,
          body: {
            error: 'no valid patch fields (verified, object, predicate)',
            code: 'ValidationError',
          },
        }
      } catch (_err) {
        return { status: 404, body: { error: `fact not found: ${id}`, code: 'NotFound' } }
      }
    }

    // DELETE /api/memory/facts/:id — reject/deprecate a fact
    if (path.startsWith('/api/memory/facts/') && req.method === 'DELETE') {
      const id = path.split('/api/memory/facts/')[1]
      if (!id) {
        return { status: 400, body: { error: 'fact id required', code: 'ValidationError' } }
      }
      let body: { by?: string }
      try {
        body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body ?? {})
      } catch {
        body = {}
      }
      const by = (body?.by as string) ?? 'user'
      try {
        await memory.rejectFact(id, by)
        return { status: 200, body: { ok: true, action: 'reject', id } }
      } catch (_err) {
        return { status: 404, body: { error: `fact not found: ${id}`, code: 'NotFound' } }
      }
    }

    return { status: 404, body: { error: 'Not found', code: 'NotFound' } }
  }
}
