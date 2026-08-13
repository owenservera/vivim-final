// src/server/collection-router.ts
// REST API router for collections system

import { z } from 'zod'
import type { ServerContext } from './index.js'
import { errorResponse, json } from './response.js'
import { parseRequestBody } from './validate.js'

export function createCollectionRouter(ctx: ServerContext) {
  return async (req: Request): Promise<Response> => {
    const url = new URL(req.url)
    const { pathname } = url
    const method = req.method

    try {
      // GET /api/collections — list user's collections
      if (pathname === '/api/collections' && method === 'GET') {
        if (!ctx.collectionEngine) return errorResponse('Engine not wired', 'InternalError', 500)
        const userId = url.searchParams.get('userId') || 'local'
        const limit = Number(url.searchParams.get('limit') ?? '50')
        const offset = Number(url.searchParams.get('offset') ?? '0')
        const collections = await ctx.collectionEngine.listCollections(userId, { limit, offset })
        return json(collections)
      }

      // POST /api/collections — create collection
      if (pathname === '/api/collections' && method === 'POST') {
        if (!ctx.collectionEngine) return errorResponse('Engine not wired', 'InternalError', 500)
        const schema = z.object({
          name: z.string().min(1),
          parentId: z.string().optional(),
          userId: z.string().min(1),
          description: z.string().optional(),
          color: z.string().optional(),
          icon: z.string().optional(),
        })
        const parsed = await parseRequestBody(req, schema)
        if (!parsed.success) return parsed.response
        const collection = await ctx.collectionEngine.createCollection(parsed.data)
        return json(collection, 201)
      }

      // GET /api/collections/:id — get collection
      const collMatch = pathname.match(/^\/api\/collections\/([^/]+)$/)
      if (collMatch && method === 'GET') {
        if (!ctx.collectionEngine) return errorResponse('Engine not wired', 'InternalError', 500)
        const id = collMatch[1]
        if (!id) return errorResponse('Invalid collection id', 'ValidationError', 400)
        const collection = await ctx.collectionEngine.getCollection(id)
        if (!collection) return errorResponse('Collection not found', 'NotFound', 404)
        return json(collection)
      }

      // PATCH /api/collections/:id — update collection
      if (collMatch && method === 'PATCH') {
        if (!ctx.collectionEngine) return errorResponse('Engine not wired', 'InternalError', 500)
        const id = collMatch[1]
        if (!id) return errorResponse('Invalid collection id', 'ValidationError', 400)
        const schema = z.object({
          name: z.string().optional(),
          description: z.string().optional(),
          color: z.string().optional(),
          icon: z.string().optional(),
        })
        const parsed = await parseRequestBody(req, schema)
        if (!parsed.success) return parsed.response
        await ctx.collectionEngine.updateCollection(id, parsed.data)
        return json({ ok: true })
      }

      // DELETE /api/collections/:id — delete collection
      if (collMatch && method === 'DELETE') {
        if (!ctx.collectionEngine) return errorResponse('Engine not wired', 'InternalError', 500)
        const id = collMatch[1]
        if (!id) return errorResponse('Invalid collection id', 'ValidationError', 400)
        await ctx.collectionEngine.deleteCollection(id)
        return json({ ok: true })
      }

      // GET /api/collections/:id/children — get child collections
      const childrenMatch = pathname.match(/^\/api\/collections\/([^/]+)\/children$/)
      if (childrenMatch && method === 'GET') {
        if (!ctx.collectionEngine) return errorResponse('Engine not wired', 'InternalError', 500)
        const parentId = childrenMatch[1]
        if (!parentId) return errorResponse('Invalid parent id', 'ValidationError', 400)
        const children = await ctx.collectionEngine.getChildren(parentId)
        return json(children)
      }

      // POST /api/collections/:id/move — move collection to new parent
      if (childrenMatch && method === 'POST') {
        if (!ctx.collectionEngine) return errorResponse('Engine not wired', 'InternalError', 500)
        const collectionId = childrenMatch[1]
        if (!collectionId) return errorResponse('Invalid collection id', 'ValidationError', 400)
        const schema = z.object({
          parentId: z.string().nullable().optional(),
        })
        const parsed = await parseRequestBody(req, schema)
        if (!parsed.success) return parsed.response
        await ctx.collectionEngine.moveCollection(collectionId, parsed.data.parentId ?? null)
        return json({ ok: true })
      }

      // GET /api/collections/:id/items — get collection items
      const itemsMatch = pathname.match(/^\/api\/collections\/([^/]+)\/items$/)
      if (itemsMatch && method === 'GET') {
        if (!ctx.collectionEngine) return errorResponse('Engine not wired', 'InternalError', 500)
        const collectionId = itemsMatch[1]
        if (!collectionId) return errorResponse('Invalid collection id', 'ValidationError', 400)
        const items = await ctx.collectionEngine.getItems(collectionId)
        return json(items)
      }

      // POST /api/collections/:id/items — add item to collection
      if (itemsMatch && method === 'POST') {
        if (!ctx.collectionEngine) return errorResponse('Engine not wired', 'InternalError', 500)
        const collectionId = itemsMatch[1]
        if (!collectionId) return errorResponse('Invalid collection id', 'ValidationError', 400)
        const schema = z.object({
          itemType: z.string().min(1),
          itemId: z.string().min(1),
          order: z.number().optional(),
        })
        const parsed = await parseRequestBody(req, schema)
        if (!parsed.success) return parsed.response
        const item = await ctx.collectionEngine.addItem({
          collectionId,
          ...parsed.data,
        })
        return json(item, 201)
      }

      // DELETE /api/collections/:id/items/:itemId — remove item from collection
      const itemMatch = pathname.match(/^\/api\/collections\/([^/]+)\/items\/([^/]+)$/)
      if (itemMatch && method === 'DELETE') {
        if (!ctx.collectionEngine) return errorResponse('Engine not wired', 'InternalError', 500)
        const collectionId = itemMatch[1]
        const itemId = itemMatch[2]
        if (!collectionId || !itemId)
          return errorResponse('Invalid collection or item id', 'ValidationError', 400)
        await ctx.collectionEngine.removeItemByReference(collectionId, '', itemId)
        return json({ ok: true })
      }

      // PATCH /api/collections/:id/items/:itemId — update item order
      if (itemMatch && method === 'PATCH') {
        if (!ctx.collectionEngine) return errorResponse('Engine not wired', 'InternalError', 500)
        const collectionId = itemMatch[1]
        const itemId = itemMatch[2]
        if (!collectionId || !itemId)
          return errorResponse('Invalid collection or item id', 'ValidationError', 400)
        const schema = z.object({
          order: z.number(),
        })
        const parsed = await parseRequestBody(req, schema)
        if (!parsed.success) return parsed.response
        await ctx.collectionEngine.updateItemOrder(itemId, parsed.data.order)
        return json({ ok: true })
      }

      return errorResponse('Not found', 'NotFound', 404)
    } catch (err: unknown) {
      return errorResponse(
        err instanceof Error ? err.message : 'Internal error',
        'InternalError',
        500,
      )
    }
  }
}
