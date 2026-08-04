// src/server/knowledge-router.ts
// REST API router — knowledge endpoints (ingest, search, synthesize, export)
//
// PRINCIPLE: FRONTEND = BACKEND
// Every request is tagged with its source via X-Source header for audit logging.

import {
  KnowledgeIngestSchema,
  KnowledgeSynthesizeSchema,
  KnowledgeTopicSchema,
} from '../schema/api-validators.js'
import type { ExportScope } from '../engines/export.js'
import type { ImportSource } from '../engines/knowledge-ingestion.js'
import { newId } from '../ids.js'
import type { ServerContext } from './index.js'
import { errorResponse, json } from './response.js'
import { extractSource } from './source-middleware.js'

export function createKnowledgeRouter(ctx: ServerContext) {
  return async (req: Request): Promise<Response> => {
    const url = new URL(req.url)
    const { pathname } = url
    const method = req.method
    const _source = extractSource(req)

    try {
      // POST /api/knowledge/ingest
      if (pathname === '/api/knowledge/ingest' && method === 'POST') {
        const parsed = KnowledgeIngestSchema.safeParse(await req.json())
        if (!parsed.success) {
          return errorResponse(parsed.error.message, 'ValidationError', 400)
        }
        const result = await ctx.knowledgeIngestion?.ingest({
          source: parsed.data.source as ImportSource,
          filePath: parsed.data.filePath,
          deduplicate: parsed.data.deduplicate ?? true,
          extractEntities: parsed.data.extractEntities ?? true,
          extractDecisions: parsed.data.extractDecisions ?? true,
          generateEmbeddings: true,
        })
        if (!result) return errorResponse('Engine not wired', 'InternalError', 500)
        return json(result, 201)
      }

      // GET /api/knowledge/search?q=X&limit=N
      if (pathname === '/api/knowledge/search' && method === 'GET') {
        const q = url.searchParams.get('q') ?? ''
        if (!q) return errorResponse('q parameter required', 'ValidationError', 400)
        const limit = Number(url.searchParams.get('limit') ?? '20')
        const results = await ctx.semanticSearch?.search({ text: q, limit })
        if (!results) return errorResponse('Engine not wired', 'InternalError', 500)
        return json(results)
      }

      // POST /api/knowledge/synthesize
      if (pathname === '/api/knowledge/synthesize' && method === 'POST') {
        const parsed = KnowledgeSynthesizeSchema.safeParse(await req.json())
        if (!parsed.success) {
          return errorResponse(parsed.error.message, 'ValidationError', 400)
        }
        const result = await ctx.synthesizer?.synthesize({
          question: parsed.data.question,
          maxSources: parsed.data.maxSources ?? 10,
          synthesisStyle: parsed.data.synthesisStyle ?? 'summary',
          scope: {},
        })
        if (!result) return errorResponse('Engine not wired', 'InternalError', 500)
        return json(result)
      }

      // GET /api/knowledge/export?format=json&scope=full
      if (pathname === '/api/knowledge/export' && method === 'GET') {
        const format = (url.searchParams.get('format') ?? 'json') as 'json' | 'csv'
        const scope = (url.searchParams.get('scope') ?? 'full') as ExportScope
        const result = await ctx.exportEngine?.export({
          format,
          scope,
          outputPath: `export_${Date.now()}.${format}`,
          includeEmbeddings: url.searchParams.get('includeEmbeddings') !== 'false',
        })
        if (!result) return errorResponse('Engine not wired', 'InternalError', 500)
        return json(result)
      }

      // GET /api/knowledge/entities?type=X
      if (pathname === '/api/knowledge/entities' && method === 'GET') {
        const entityType = url.searchParams.get('type') ?? undefined
        const entities = await ctx.db.prisma.entity.findMany({
          where: entityType ? { type: entityType } : undefined,
          take: 100,
        })
        return json(entities)
      }

      // GET /api/knowledge/decisions?conversationId=X
      if (pathname === '/api/knowledge/decisions' && method === 'GET') {
        const conversationId = url.searchParams.get('conversationId') ?? undefined
        const decisions = await ctx.db.prisma.decisionRecord.findMany({
          where: conversationId ? { conversationId } : undefined,
          take: 100,
        })
        return json(decisions)
      }

      // GET /api/knowledge/topics
      if (pathname === '/api/knowledge/topics' && method === 'GET') {
        const topics = await ctx.db.prisma.topic.findMany({ take: 100 })
        return json(topics)
      }

      // POST /api/knowledge/topics
      if (pathname === '/api/knowledge/topics' && method === 'POST') {
        const parsed = KnowledgeTopicSchema.safeParse(await req.json())
        if (!parsed.success) {
          return errorResponse(parsed.error.message, 'ValidationError', 400)
        }
        const now = Date.now()
        const topic = await ctx.db.prisma.topic.create({
          data: {
            id: newId(),
            name: parsed.data.name,
            description: parsed.data.description ?? null,
            createdAt: now,
            updatedAt: now,
          },
        })
        return json(topic, 201)
      }

      // GET /api/knowledge/jobs
      if (pathname === '/api/knowledge/jobs' && method === 'GET') {
        const jobs = await ctx.db.prisma.importJob.findMany({
          orderBy: { startedAt: 'desc' },
          take: 50,
        })
        return json(jobs)
      }

      // GET /api/knowledge/jobs/:id
      const jobMatch = pathname.match(/^\/api\/knowledge\/jobs\/([^/]+)$/)
      if (jobMatch && method === 'GET') {
        const jobId = jobMatch[1]
        if (!jobId) return errorResponse('Invalid job id', 'ValidationError', 400)
        const job = await ctx.db.prisma.importJob.findUnique({ where: { id: jobId } })
        if (!job) return errorResponse('Job not found', 'NotFoundError', 404)
        return json(job)
      }

      return errorResponse('Not found', 'NotFoundError', 404)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Internal error'
      return errorResponse(message, 'InternalError', 500)
    }
  }
}
