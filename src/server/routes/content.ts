// src/server/routes/content.ts
// REST API routes for content item management.

import type { ServerContext } from '../index.js'
import { errorResponse, json } from '../response.js'
import { z } from 'zod'

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
        const schema = z.object({
          providerId: z.string().min(1, 'providerId is required'),
          accountId: z.string().min(1, 'accountId is required'),
          containerId: z.string().optional(),
          parentItemId: z.string().optional(),
          conversationId: z.string().optional(),
          providerNativeId: z.string().optional(),
          contentType: z.string().min(1, 'contentType is required'),
          authorName: z.string().optional(),
          authorAvatarUrl: z.string().optional(),
          authorProviderId: z.string().optional(),
          title: z.string().optional(),
          bodyText: z.string().optional(),
          bodyRichJson: z.string().optional(),
          summaryText: z.string().optional(),
          url: z.string().optional(),
          metadataJson: z.string().optional(),
          sortTimestamp: z.number().optional(),
        })
        const parsed = schema.safeParse(await req.json())
        if (!parsed.success) return errorResponse(parsed.error.message, 'ValidationError', 400)
        const item = await store.createItem(parsed.data)
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
