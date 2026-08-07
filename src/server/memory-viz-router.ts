// src/server/memory-viz-router.ts
// Memory Visualization API — REST routes for memory graph, timeline, stats.
//
// PRINCIPLE: FRONTEND = BACKEND
// Every request is tagged with its source via X-Source header for audit logging.
//
// Session 3 (2026-08-07): Refactored from returning `{ status, body }` (Shape C)
// to returning `Response` directly via the `json()` / `errorResponse()` helpers.
// This fixes:
//   - Missing CORS headers (the caller in server/index.ts was wrapping with raw
//     `new Response(JSON.stringify(...))` which bypassed corsHeaders()).
//   - Missing BigInt serialization (json() handles this; raw JSON.stringify does not).
//   - Inconsistent error shape (now uses the canonical `{ error, code, details }`).
// The caller no longer needs to wrap the return value — it just returns it.

import type { MemoryEngine } from '../engines/memory-engine.js'
import type { MemoryCuratedStore } from '../storage/contracts/memory-curated-store.js'
import { errorResponse, json } from './response.js'

export function createMemoryVizRouter(memory: MemoryEngine, curatedStore?: MemoryCuratedStore) {
  return async (req: Request): Promise<Response> => {
    const url = new URL(req.url)
    const path = url.pathname

    // GET /api/memory/graph?entityId=X
    if (path === '/api/memory/graph' && req.method === 'GET') {
      const entityId = url.searchParams.get('entityId')
      if (!entityId) {
        return errorResponse('entityId required', 'ValidationError', 400)
      }
      const facts = await memory.recallFacts(entityId)
      return json({
        entity: entityId,
        connections: facts.map((f) => ({
          predicate: f.predicate,
          value: f.object,
          confidence: f.confidence,
        })),
      })
    }

    // GET /api/memory/graph/subgraph?focal=<id>&depth=2
    if (path === '/api/memory/graph/subgraph' && req.method === 'GET') {
      const focal = url.searchParams.get('focal')
      const depth = Number(url.searchParams.get('depth') ?? 2)
      if (!focal) {
        return errorResponse('focal entity required', 'ValidationError', 400)
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

      return json({ nodes: [...nodes.values()], edges })
    }

    // GET /api/memory/graph/neighbors?entity=<id>&k=10
    if (path === '/api/memory/graph/neighbors' && req.method === 'GET') {
      const entity = url.searchParams.get('entity')
      const k = Number(url.searchParams.get('k') ?? 10)
      if (!entity) {
        return errorResponse('entity required', 'ValidationError', 400)
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
      return json({ entity, neighbors: [...neighbors.values()] })
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
      return json({
        clusters: [...groups.entries()].map(([id, members]) => ({ id, members })),
      })
    }

    // GET /api/memory/timeline?from=&to=
    if (path === '/api/memory/timeline' && req.method === 'GET') {
      const from = Number(url.searchParams.get('from') ?? 0)
      const to = Number(url.searchParams.get('to') ?? Date.now())
      const episodes = await memory.recallEpisodes({ since: from, limit: 100 })
      const filtered = episodes.filter((e) => e.timestamp <= to)
      return json({
        events: filtered.map((e) => ({
          id: e.id,
          action: e.action,
          timestamp: e.timestamp,
          success: e.success,
        })),
      })
    }

    // GET /api/memory/stats
    if (path === '/api/memory/stats' && req.method === 'GET') {
      const episodes = await memory.recallEpisodes({ limit: 1000 })
      const facts = await memory.recallFacts('')
      return json({
        totalEpisodes: episodes.length,
        totalFacts: facts.length,
        successRate:
          episodes.length > 0 ? episodes.filter((e) => e.success).length / episodes.length : 0,
      })
    }

    // GET /api/memory/curated
    if (path === '/api/memory/curated' && req.method === 'GET') {
      const facts = await memory.recallFacts('')
      const curated = facts.filter((f) => f.confidence >= 0.8)
      return json({
        entries: curated.map((f) => ({
          id: f.id,
          subject: f.subject,
          predicate: f.predicate,
          value: f.object,
          confidence: f.confidence,
        })),
      })
    }

    // POST /api/memory/assert  { content } — persist a semantic fact
    if (path === '/api/memory/assert' && req.method === 'POST') {
      let body: { content?: string }
      try {
        body = (await req.json()) as { content?: string }
      } catch {
        return errorResponse('invalid json body', 'ValidationError', 400)
      }
      const content = (body.content ?? '').trim()
      if (!content) {
        return errorResponse('content required', 'ValidationError', 400)
      }
      await memory.assertFact({
        subject: content,
        predicate: 'asserted',
        object: content,
        confidence: 1.0,
        source: 'memory-viz-router',
      })
      return json({ ok: true }, 201)
    }

    // POST /api/memory/curate  { id, memoryType, memoryId, action }
    if (path === '/api/memory/curate' && req.method === 'POST') {
      if (!curatedStore) {
        return errorResponse('curation store not configured', 'NotImplemented', 501)
      }
      let body: { id?: string; memoryType?: string; memoryId?: string; action?: string }
      try {
        body = (await req.json()) as {
          id?: string
          memoryType?: string
          memoryId?: string
          action?: string
        }
      } catch {
        return errorResponse('invalid json body', 'ValidationError', 400)
      }
      const memoryType = body.memoryType ?? 'fact'
      const memoryId = body.memoryId ?? body.id
      if (!memoryId) {
        return errorResponse('memoryId required', 'ValidationError', 400)
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
          return errorResponse('unknown action', 'ValidationError', 400)
      }
      return json({ ok: true, action: body.action, memoryId })
    }

    // P3-4: Duplicate — see memory-router.ts for primary /api/memory/export implementation

    // PATCH /api/memory/facts/:id — verify or edit a fact
    if (path.startsWith('/api/memory/facts/') && req.method === 'PATCH') {
      const id = path.split('/api/memory/facts/')[1]
      if (!id) {
        return errorResponse('fact id required', 'ValidationError', 400)
      }
      let body: { verified?: boolean; object?: unknown; predicate?: string; by?: string }
      try {
        body = (await req.json()) as {
          verified?: boolean
          object?: unknown
          predicate?: string
          by?: string
        }
      } catch {
        return errorResponse('invalid json body', 'ValidationError', 400)
      }
      const by = (body.by as string) ?? 'user'
      try {
        if (body.verified === true) {
          await memory.verifyFact(id, by)
          return json({ ok: true, action: 'verify', id })
        }
        if (body.object !== undefined || body.predicate !== undefined) {
          await memory.editFact(id, { object: body.object, predicate: body.predicate }, by)
          return json({ ok: true, action: 'edit', id })
        }
        return errorResponse(
          'no valid patch fields (verified, object, predicate)',
          'ValidationError',
          400,
        )
      } catch {
        return errorResponse(`fact not found: ${id}`, 'NotFound', 404)
      }
    }

    // DELETE /api/memory/facts/:id — reject/deprecate a fact
    if (path.startsWith('/api/memory/facts/') && req.method === 'DELETE') {
      const id = path.split('/api/memory/facts/')[1]
      if (!id) {
        return errorResponse('fact id required', 'ValidationError', 400)
      }
      let body: { by?: string } = {}
      try {
        body = (await req.json()) as { by?: string }
      } catch {
        body = {}
      }
      const by = body?.by ?? 'user'
      try {
        await memory.rejectFact(id, by)
        return json({ ok: true, action: 'reject', id })
      } catch {
        return errorResponse(`fact not found: ${id}`, 'NotFound', 404)
      }
    }

    return errorResponse('Not found', 'NotFound', 404)
  }
}
