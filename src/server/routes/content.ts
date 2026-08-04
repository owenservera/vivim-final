// src/server/routes/content.ts
// REST API routes for content item management.

import type { ServerContext } from '../index.js'
import { errorResponse, json } from '../response.js'

export function createContentRouter(ctx: ServerContext) {
  return async function contentRouter(req: Request): Promise<Response | undefined> {
    const url = new URL(req.url)
    const path = url.pathname

    const store = (ctx as unknown as { contentStore?: {
      getItemById(id: string): Promise<unknown>
      queryItems(query: unknown): Promise<unknown[]>
      createItem(input: unknown): Promise<unknown>
      updateItem(id: string, updates: unknown): Promise<unknown>
      deleteItem(id: string): Promise<void>
      searchItems(query: string, opts?: unknown): Promise<unknown[]>
    }}).contentStore

    if (!store) {
      return errorResponse('ContentStore not available', 'EngineUnavailable', 503)
    }

    try {
      // GET /api/content/search
      if (req.method === 'GET' && path === '/api/content/search') {
        const q = url.searchParams.get('q') ?? ''
        const containerId = url.searchParams.get('containerId') ?? undefined
        const contentType = url.searchParams.get('contentType') ?? undefined
        const items = await store.searchItems(q, { containerId, contentType })
        return json({ items, count: (items as unknown[]).length })
      }

      // GET /api/content
      if (req.method === 'GET' && path === '/api/content') {
        const containerId = url.searchParams.get('containerId') ?? undefined
        const providerId = url.searchParams.get('providerId') ?? undefined
        const accountId = url.searchParams.get('accountId') ?? undefined
        const contentType = url.searchParams.get('contentType') ?? undefined
        const limit = url.searchParams.get('limit') ? Number(url.searchParams.get('limit')) : undefined
        const offset = url.searchParams.get('offset') ? Number(url.searchParams.get('offset')) : undefined
        const items = await store.queryItems({ containerId, providerId, accountId, contentType, limit, offset })
        return json({ items, count: (items as unknown[]).length })
      }

      // POST /api/content
      if (req.method === 'POST' && path === '/api/content') {
        const body = (await req.json()) as {
          providerId?: string
          accountId?: string
          containerId?: string
          parentItemId?: string
          conversationId?: string
          providerNativeId?: string
          contentType?: string
          authorName?: string
          authorAvatarUrl?: string
          authorProviderId?: string
          title?: string
          bodyText?: string
          bodyRichJson?: string
          summaryText?: string
          url?: string
          metadataJson?: string
          sortTimestamp?: number
        }
        if (!body.contentType || typeof body.contentType !== 'string') {
          return errorResponse('contentType is required', 'ValidationError', 400)
        }
        if (!body.providerId || typeof body.providerId !== 'string') {
          return errorResponse('providerId is required', 'ValidationError', 400)
        }
        if (!body.accountId || typeof body.accountId !== 'string') {
          return errorResponse('accountId is required', 'ValidationError', 400)
        }
        const item = await store.createItem(body)
        return json({ item }, 201)
      }

      // GET /api/content/:id
      const itemMatch = path.match(/^\/api\/content\/([^/]+)$/)
      if (req.method === 'GET' && itemMatch && itemMatch[1]) {
        const item = await store.getItemById(itemMatch[1])
        if (!item) return errorResponse('Content item not found', 'NotFound', 404)
        return json({ item })
      }

      // PUT /api/content/:id
      if (req.method === 'PUT' && itemMatch && itemMatch[1]) {
        const body = (await req.json()) as Record<string, unknown>
        const item = await store.updateItem(itemMatch[1], body)
        return json({ item })
      }

      // DELETE /api/content/:id
      if (req.method === 'DELETE' && itemMatch && itemMatch[1]) {
        await store.deleteItem(itemMatch[1])
        return json({ success: true })
      }

      return undefined
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return errorResponse(message, 'InternalError', 500)
    }
  }
}
