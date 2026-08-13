// src/server/memory-router.ts
// REST API router — memory export/import endpoints
//
// PRINCIPLE: FRONTEND = BACKEND
// Every request is tagged with its source via X-Source header for audit logging.

import { z } from 'zod'
import type { Card } from '../engines/fsrs-scheduler.js'
import type { ServerContext } from './index.js'
import { appErrorResponse, errorResponse, json } from './response.js'
import { extractSource } from './source-middleware.js'

export function createMemoryRouter(ctx: ServerContext) {
  return async (req: Request): Promise<Response> => {
    const url = new URL(req.url)
    const { pathname } = url
    const method = req.method
    const _source = extractSource(req)

    try {
      // GET /api/memory/export?format=json|markdown
      if (pathname === '/api/memory/export' && method === 'GET') {
        if (!ctx.memoryEngine) {
          return errorResponse('Memory engine not available', 'InternalError', 500)
        }
        const { MemoryExportEngine } = await import('../engines/memory-export.js')
        const exportEngine = new MemoryExportEngine(ctx.memoryEngine)
        const format = (url.searchParams.get('format') ?? 'json') as 'json' | 'markdown'
        const data = await exportEngine.export(format)
        return new Response(data, {
          status: 200,
          headers: {
            'Content-Type': format === 'json' ? 'application/json' : 'text/markdown',
            'Content-Disposition': `attachment; filename="memory-export.${format}"`,
          },
        })
      }

      // POST /api/memory/import
      if (pathname === '/api/memory/import' && method === 'POST') {
        if (!ctx.memoryEngine) {
          return errorResponse('Memory engine not available', 'InternalError', 500)
        }
        const schema = z.object({ json: z.string().min(1, 'json field is required') })
        const parsed = schema.safeParse(await req.json())
        if (!parsed.success) return errorResponse(parsed.error.message, 'ValidationError', 400)
        const { MemoryExportEngine } = await import('../engines/memory-export.js')
        const exportEngine = new MemoryExportEngine(ctx.memoryEngine)
        const result = await exportEngine.import(parsed.data.json)
        return json(result)
      }

      // ── FSRS-6 Spaced Repetition Endpoints (Phase 5) ───────────────────────

      // GET /api/memory/review/due?limit=50
      if (pathname === '/api/memory/review/due' && method === 'GET') {
        if (!ctx.memoryEngine) {
          return errorResponse('Memory engine not available', 'InternalError', 500)
        }
        const limit = parseInt(url.searchParams.get('limit') ?? '50', 10)
        const dueCards: Card[] = await ctx.memoryEngine.collectDueMemories(limit)
        return json(dueCards)
      }

      // POST /api/memory/review/:id
      const reviewMatch = pathname.match(/^\/api\/memory\/review\/([^/]+)$/)
      if (reviewMatch && method === 'POST') {
        if (!ctx.memoryEngine) {
          return errorResponse('Memory engine not available', 'InternalError', 500)
        }
        const memoryId = reviewMatch[1]!
        const schema = z.object({ rating: z.number().min(0).max(5) })
        const parsed = schema.safeParse(await req.json())
        if (!parsed.success) return errorResponse(parsed.error.message, 'ValidationError', 400)
        const result = await ctx.memoryEngine.applyReview(memoryId, parsed.data.rating)
        return json(result)
      }

      return errorResponse('Not found', 'NotFound', 404)
    } catch (err: unknown) {
      return appErrorResponse(err)
    }
  }
}
