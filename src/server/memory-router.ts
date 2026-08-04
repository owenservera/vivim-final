// src/server/memory-router.ts
// REST API router — memory export/import endpoints
//
// PRINCIPLE: FRONTEND = BACKEND
// Every request is tagged with its source via X-Source header for audit logging.

import { z } from 'zod'
import type { ServerContext } from './index.js'
import { errorResponse, json } from './response.js'
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

      return errorResponse('Not found', 'NotFoundError', 404)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Internal error'
      return errorResponse(message, 'InternalError', 500)
    }
  }
}
