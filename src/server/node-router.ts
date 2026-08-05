// src/server/node-router.ts
// REST API router — node graph query endpoints (CRUD, traversal, versions, aliases)
//
// PRINCIPLE: FRONTEND = BACKEND
// Every request is tagged with its source via X-Source header for audit logging.

import { z } from 'zod'
import type { ServerContext } from './index.js'
import { errorResponse, json } from './response.js'
import { extractSource } from './source-middleware.js'

/** Parse a Node DB row into an API-friendly shape: dataJson → parsed object, epoch → ISO. */
function formatNode(row: any, extra?: Record<string, unknown>) {
  const data = typeof row.dataJson === 'string' ? JSON.parse(row.dataJson) : (row.dataJson ?? {})
  return {
    id: row.id,
    type: row.type,
    parentId: row.parentId ?? null,
    data,
    version: row.version,
    state: row.state,
    contentType: row.contentType ?? null,
    securityLevel: row.securityLevel ?? null,
    authorDid: row.authorDid ?? null,
    signature: row.signature ?? null,
    contentHash: row.contentHash ?? null,
    acuType: row.acuType ?? null,
    searchText: row.searchText ?? null,
    createdAt:
      row.createdAt instanceof Date
        ? row.createdAt.toISOString()
        : new Date(row.createdAt).toISOString(),
    updatedAt:
      row.updatedAt instanceof Date
        ? row.updatedAt.toISOString()
        : new Date(row.updatedAt).toISOString(),
    ...extra,
  }
}

function parseLimit(raw: string | null, fallback = 50, max = 200): number {
  const n = Number(raw ?? String(fallback))
  if (Number.isNaN(n) || n < 1) return fallback
  return Math.min(n, max)
}

function parseOffset(raw: string | null): number {
  const n = Number(raw ?? '0')
  if (Number.isNaN(n) || n < 0) return 0
  return n
}

export function createNodeRouter(ctx: ServerContext) {
  return async (req: Request): Promise<Response> => {
    const url = new URL(req.url)
    const { pathname } = url
    const method = req.method
    const _source = extractSource(req)

    const ns = ctx.nodeStore
    if (!ns) return errorResponse('NodeStore not wired', 'InternalError', 500)

    try {
      // ── POST /api/nodes/alias ──
      if (pathname === '/api/nodes/alias' && method === 'POST') {
        const schema = z.object({
          aliasId: z.string().min(1, 'aliasId is required'),
          canonicalId: z.string().min(1, 'canonicalId is required'),
          method: z.string().min(1, 'method is required'),
          confidence: z.number().min(0).max(1).optional(),
        })
        const parsed = schema.safeParse(await req.json())
        if (!parsed.success) return errorResponse(parsed.error.message, 'ValidationError', 400)
        await ns.registerAlias(
          parsed.data.aliasId,
          parsed.data.canonicalId,
          parsed.data.method,
          parsed.data.confidence ?? 1.0,
        )
        return json(
          { ok: true, aliasId: parsed.data.aliasId, canonicalId: parsed.data.canonicalId },
          201,
        )
      }

      // ── GET /api/nodes/alias/:aliasId ──
      const aliasMatch = pathname.match(/^\/api\/nodes\/alias\/(.+)$/)
      if (aliasMatch && method === 'GET') {
        const aliasId = decodeURIComponent(aliasMatch[1]!)
        const canonicalId = await ns.resolveAlias(aliasId)
        if (!canonicalId) return errorResponse('Alias not found', 'NotFoundError', 404)
        return json({ aliasId, canonicalId })
      }

      // ── POST /api/nodes/rebuild-graph ──
      if (pathname === '/api/nodes/rebuild-graph' && method === 'POST') {
        const count = await ns.rebuildGraphFromNodes()
        return json({ edgesRebuilt: count })
      }

      // ── GET /api/nodes/count ──
      if (pathname === '/api/nodes/count' && method === 'GET') {
        const total = await ns.countNodes()
        return json({ total })
      }

      // ── GET /api/nodes ──
      if (pathname === '/api/nodes' && method === 'GET') {
        const type = url.searchParams.get('type') ?? undefined
        const conversationId = url.searchParams.get('conversationId') ?? undefined
        const messageId = url.searchParams.get('messageId') ?? undefined
        const limit = parseLimit(url.searchParams.get('limit'))
        const offset = parseOffset(url.searchParams.get('offset'))
        const orderBy =
          (url.searchParams.get('orderBy') as 'createdAt' | 'updatedAt') ?? 'createdAt'
        const orderDir = (url.searchParams.get('orderDir') as 'asc' | 'desc') ?? 'desc'

        const rows = await ns.listNodes({
          type,
          conversationId,
          messageId,
          limit,
          offset,
          orderBy,
          orderDir,
        })
        const total = await ns.countNodes()
        return json({
          nodes: rows.map((r: any) => formatNode(r)),
          total,
          limit,
          offset,
        })
      }

      // ── Dynamic :id routes ──
      const nodeMatch = pathname.match(/^\/api\/nodes\/([^/]+)(?:\/(.+))?$/)
      if (nodeMatch && method === 'GET') {
        const id = decodeURIComponent(nodeMatch[1]!)
        const sub = nodeMatch[2] ?? ''

        const node = await ns.getNode(id)
        if (!node) return errorResponse('Node not found', 'NotFoundError', 404)

        // GET /api/nodes/:id/raw
        if (sub === 'raw') {
          const raw = await ns.getRawSource(id)
          if (!raw) return errorResponse('rawSource not available', 'NotFoundError', 404)
          return json({ raw })
        }

        // GET /api/nodes/:id/children
        if (sub === 'children') {
          const children = await ns.getChildren(id)
          return json({
            nodes: children.map((c: any) => formatNode(c)),
            count: children.length,
          })
        }

        // GET /api/nodes/:id/lineage
        if (sub === 'lineage') {
          const lineage = await ns.getLineage(id)
          return json({
            nodes: lineage.map((n: any) => formatNode(n)),
            count: lineage.length,
          })
        }

        // GET /api/nodes/:id/edges/outgoing
        if (sub === 'edges/outgoing') {
          const edges = await ns.getOutgoingEdges(id)
          return json({ edges, count: edges.length })
        }

        // GET /api/nodes/:id/edges/incoming
        if (sub === 'edges/incoming') {
          const edges = await ns.getIncomingEdges(id)
          return json({ edges, count: edges.length })
        }

        // GET /api/nodes/:id/edges/neighbors
        if (sub === 'edges/neighbors') {
          const [outgoing, incoming] = await Promise.all([
            ns.getOutgoingEdges(id),
            ns.getIncomingEdges(id),
          ])
          const neighborMap = new Map<string, { edges: any[]; node: any }>()
          for (const e of outgoing) {
            const key = e.targetId
            if (!neighborMap.has(key)) neighborMap.set(key, { edges: [], node: null })
            neighborMap.get(key)!.edges.push({ direction: 'outgoing', ...e })
          }
          for (const e of incoming) {
            const key = e.targetId
            if (!neighborMap.has(key)) neighborMap.set(key, { edges: [], node: null })
            neighborMap.get(key)!.edges.push({ direction: 'incoming', ...e })
          }
          // Fetch neighbor nodes in batch
          const ids = [...neighborMap.keys()]
          const neighborNodes = await Promise.all(ids.map((nid) => ns.getNode(nid)))
          for (let i = 0; i < ids.length; i++) {
            const n = neighborNodes[i]
            const key = ids[i]
            if (n && key) neighborMap.get(key)!.node = formatNode(n)
          }
          return json({
            neighbors: [...neighborMap.entries()].map(([id, data]) => ({
              id,
              node: data.node,
              edges: data.edges,
            })),
            count: neighborMap.size,
          })
        }

        // GET /api/nodes/:id/versions
        if (sub === 'versions') {
          const history = await ns.getNodeHistory(id)
          return json({ versions: history, count: history.length })
        }

        // GET /api/nodes/:id/versions/:version
        const versionMatch = sub.match(/^versions\/(\d+)$/)
        if (versionMatch) {
          const version = Number(versionMatch[1])
          if (Number.isNaN(version))
            return errorResponse('Invalid version number', 'ValidationError', 400)
          const snapshot = await ns.getNodeAtVersion(id, version)
          if (!snapshot) return errorResponse('Version not found', 'NotFoundError', 404)
          return json(snapshot)
        }

        // GET /api/nodes/:id — default: return node with child/edge counts
        if (sub === '') {
          const [children, outgoing, incoming] = await Promise.all([
            ns.getChildren(id),
            ns.getOutgoingEdges(id),
            ns.getIncomingEdges(id),
          ])
          return json(
            formatNode(node, {
              childCount: children.length,
              edgeCount: outgoing.length + incoming.length,
            }),
          )
        }

        return errorResponse('Not found', 'NotFoundError', 404)
      }

      return errorResponse('Not found', 'NotFoundError', 404)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Internal error'
      return errorResponse(message, 'InternalError', 500)
    }
  }
}
