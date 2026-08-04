// impl/knowledge-router.ts
// Full server router with 12 knowledge API endpoints.
// Follows the existing server pattern from conversation-router.ts.
//
// The existing knowledge-router.ts has 9 endpoints. This file adds 3 more
// and enhances the existing ones with proper validation and filtering.
//
// 12 endpoints:
//   1.  POST   /api/knowledge/ingest              — Ingest a knowledge file
//   2.  GET    /api/knowledge/search              — Semantic search
//   3.  GET    /api/knowledge/search/hybrid       — Hybrid (semantic + keyword) search
//   4.  POST   /api/knowledge/synthesize          — Cross-conversation synthesis
//   5.  GET    /api/knowledge/export              — Export knowledge data
//   6.  POST   /api/knowledge/import              — Import knowledge from JSON
//   7.  GET    /api/knowledge/entities            — List entities (with type filter)
//   8.  POST   /api/knowledge/entities            — Create a new entity
//   9.  GET    /api/knowledge/decisions           — List decision records
//   10. GET    /api/knowledge/patterns            — List pattern extracts
//   11. GET    /api/knowledge/topics              — List topics
//   12. POST   /api/knowledge/topics              — Create a new topic
//   13. GET    /api/knowledge/projects            — List projects
//   14. POST   /api/knowledge/projects            — Create a new project
//   15. GET    /api/knowledge/preferences         — List user preferences
//   16. GET    /api/knowledge/jobs                — List import jobs
//   17. GET    /api/knowledge/jobs/:id            — Get import job by ID
//   18. POST   /api/knowledge/reindex             — Reindex all entities for search
//   19. GET    /api/knowledge/stats               — Get knowledge statistics

import { newId } from '../src/ids.js'
import type { ServerContext } from '../src/server/index.js'
import { errorResponse, json } from '../src/server/response.js'

export function registerKnowledgeRoutes(app: {
  createRouter: (handler: (req: Request) => Promise<Response>) => void
}) {
  // This function is designed to be used as a replacement for createKnowledgeRouter.
  // It follows the same pattern but includes all 12+ endpoints.
}

/**
 * Creates the knowledge router with all endpoints.
 * This replaces the existing createKnowledgeRouter function in src/server/knowledge-router.ts.
 */
export function createKnowledgeRouter(ctx: ServerContext) {
  return async (req: Request): Promise<Response> => {
    const url = new URL(req.url)
    const { pathname } = url
    const method = req.method

    try {
      // ── 1. POST /api/knowledge/ingest ──────────────────────────────────
      if (pathname === '/api/knowledge/ingest' && method === 'POST') {
        const body = (await req.json()) as {
          source: string
          filePath: string
          deduplicate?: boolean
          extractEntities?: boolean
          extractDecisions?: boolean
          generateEmbeddings?: boolean
        }
        if (!body.source || !body.filePath) {
          return errorResponse('source and filePath required', 'ValidationError', 400)
        }
        const result = await ctx.knowledgeIngestion?.ingest({
          source: body.source as 'json' | 'csv' | 'markdown' | 'text',
          filePath: body.filePath,
          deduplicate: body.deduplicate ?? true,
          extractEntities: body.extractEntities ?? true,
          extractDecisions: body.extractDecisions ?? true,
          generateEmbeddings: body.generateEmbeddings ?? true,
        })
        if (!result) return errorResponse('Engine not wired', 'InternalError', 500)
        return json(result, 201)
      }

      // ── 2. GET /api/knowledge/search?q=X&limit=N ──────────────────────
      if (pathname === '/api/knowledge/search' && method === 'GET') {
        const q = url.searchParams.get('q') ?? ''
        if (!q) return errorResponse('q parameter required', 'ValidationError', 400)
        const limit = Number(url.searchParams.get('limit') ?? '20')
        const results = await ctx.semanticSearch?.search({ text: q, limit })
        if (!results) return errorResponse('Engine not wired', 'InternalError', 500)
        return json(results)
      }

      // ── 3. GET /api/knowledge/search/hybrid?q=X&limit=N ───────────────
      if (pathname === '/api/knowledge/search/hybrid' && method === 'GET') {
        const q = url.searchParams.get('q') ?? ''
        if (!q) return errorResponse('q parameter required', 'ValidationError', 400)
        const limit = Number(url.searchParams.get('limit') ?? '20')
        const conversationId = url.searchParams.get('conversationId') ?? undefined
        const results = await ctx.semanticSearch?.searchHybrid({
          text: q,
          limit,
          conversationId,
        })
        if (!results) return errorResponse('Engine not wired', 'InternalError', 500)
        return json(results)
      }

      // ── 4. POST /api/knowledge/synthesize ─────────────────────────────
      if (pathname === '/api/knowledge/synthesize' && method === 'POST') {
        const body = (await req.json()) as {
          question: string
          maxSources?: number
          synthesisStyle?: 'summary' | 'detailed' | 'bullets'
        }
        if (!body.question) return errorResponse('question required', 'ValidationError', 400)
        const result = await ctx.synthesizer?.synthesize({
          question: body.question,
          maxSources: body.maxSources ?? 10,
          synthesisStyle: body.synthesisStyle ?? 'summary',
          scope: {},
        })
        if (!result) return errorResponse('Engine not wired', 'InternalError', 500)
        return json(result)
      }

      // ── 5. GET /api/knowledge/export?format=json&scope=full ───────────
      if (pathname === '/api/knowledge/export' && method === 'GET') {
        const format = (url.searchParams.get('format') ?? 'json') as 'json' | 'csv'
        const scope = (url.searchParams.get('scope') ?? 'full') as
          | 'full'
          | 'conversations'
          | 'memory'
          | 'providers'
          | 'config'
        const result = await ctx.exportEngine?.export({
          format,
          scope,
          outputPath: `export_${Date.now()}.${format}`,
          includeEmbeddings: url.searchParams.get('includeEmbeddings') !== 'false',
        })
        if (!result) return errorResponse('Engine not wired', 'InternalError', 500)
        return json(result)
      }

      // ── 6. POST /api/knowledge/import ──────────────────────────────────
      if (pathname === '/api/knowledge/import' && method === 'POST') {
        const body = (await req.json()) as {
          filePath: string
          passphrase?: string
        }
        if (!body.filePath) {
          return errorResponse('filePath required', 'ValidationError', 400)
        }
        const result = await ctx.exportEngine?.importJson(body.filePath)
        if (!result) return errorResponse('Engine not wired', 'InternalError', 500)
        return json(result, 201)
      }

      // ── 7. GET /api/knowledge/entities?type=X&limit=N ─────────────────
      if (pathname === '/api/knowledge/entities' && method === 'GET') {
        const entityType = url.searchParams.get('type') ?? undefined
        const limit = Number(url.searchParams.get('limit') ?? '100')
        const entities = await ctx.db.prisma.entity.findMany({
          where: entityType ? { type: entityType } : undefined,
          orderBy: { mentionCount: 'desc' },
          take: limit,
        })
        return json(entities)
      }

      // ── 8. POST /api/knowledge/entities ────────────────────────────────
      if (pathname === '/api/knowledge/entities' && method === 'POST') {
        const body = (await req.json()) as {
          name: string
          type: string
          description?: string
        }
        if (!body.name || !body.type) {
          return errorResponse('name and type required', 'ValidationError', 400)
        }
        const now = Date.now()
        const entity = await ctx.db.prisma.entity.create({
          data: {
            id: newId(),
            name: body.name,
            type: body.type,
            description: body.description ?? null,
            confidence: 0.5,
            mentionCount: 0,
            firstSeenAt: now,
            lastSeenAt: now,
            createdAt: now,
            updatedAt: now,
          },
        })
        return json(entity, 201)
      }

      // ── 9. GET /api/knowledge/decisions?conversationId=X&limit=N ──────
      if (pathname === '/api/knowledge/decisions' && method === 'GET') {
        const conversationId = url.searchParams.get('conversationId') ?? undefined
        const limit = Number(url.searchParams.get('limit') ?? '100')
        const decisions = await ctx.db.prisma.decisionRecord.findMany({
          where: conversationId ? { conversationId } : undefined,
          orderBy: { ts: 'desc' },
          take: limit,
        })
        return json(decisions)
      }

      // ── 10. GET /api/knowledge/patterns?patternType=X&limit=N ─────────
      if (pathname === '/api/knowledge/patterns' && method === 'GET') {
        const patternType = url.searchParams.get('patternType') ?? undefined
        const limit = Number(url.searchParams.get('limit') ?? '100')
        const patterns = await ctx.db.prisma.patternExtract.findMany({
          where: patternType ? { patternType } : undefined,
          orderBy: { occurrences: 'desc' },
          take: limit,
        })
        return json(patterns)
      }

      // ── 11. GET /api/knowledge/topics ──────────────────────────────────
      if (pathname === '/api/knowledge/topics' && method === 'GET') {
        const topics = await ctx.db.prisma.topic.findMany({
          orderBy: { conversationCount: 'desc' },
          take: 100,
        })
        return json(topics)
      }

      // ── 12. POST /api/knowledge/topics ─────────────────────────────────
      if (pathname === '/api/knowledge/topics' && method === 'POST') {
        const body = (await req.json()) as { name: string; description?: string; color?: string }
        if (!body.name) return errorResponse('name required', 'ValidationError', 400)
        const now = Date.now()
        const topic = await ctx.db.prisma.topic.create({
          data: {
            id: newId(),
            name: body.name,
            description: body.description ?? null,
            color: body.color ?? null,
            createdAt: now,
            updatedAt: now,
          },
        })
        return json(topic, 201)
      }

      // ── 13. GET /api/knowledge/projects?status=X ──────────────────────
      if (pathname === '/api/knowledge/projects' && method === 'GET') {
        const status = url.searchParams.get('status') ?? undefined
        const projects = await ctx.db.prisma.project.findMany({
          where: status ? { status } : undefined,
          orderBy: { updatedAt: 'desc' },
          take: 100,
        })
        return json(projects)
      }

      // ── 14. POST /api/knowledge/projects ───────────────────────────────
      if (pathname === '/api/knowledge/projects' && method === 'POST') {
        const body = (await req.json()) as {
          name: string
          description?: string
          status?: string
        }
        if (!body.name) return errorResponse('name required', 'ValidationError', 400)
        const now = Date.now()
        const project = await ctx.db.prisma.project.create({
          data: {
            id: newId(),
            name: body.name,
            description: body.description ?? null,
            status: body.status ?? 'active',
            createdAt: now,
            updatedAt: now,
          },
        })
        return json(project, 201)
      }

      // ── 15. GET /api/knowledge/preferences?userId=X ────────────────────
      if (pathname === '/api/knowledge/preferences' && method === 'GET') {
        const userId = url.searchParams.get('userId') ?? 'default'
        const preferences = await ctx.db.prisma.userPreference.findMany({
          where: { userId },
          orderBy: { learnedAt: 'desc' },
          take: 200,
        })
        return json(preferences)
      }

      // ── 16. GET /api/knowledge/jobs ────────────────────────────────────
      if (pathname === '/api/knowledge/jobs' && method === 'GET') {
        const jobs = await ctx.db.prisma.importJob.findMany({
          orderBy: { startedAt: 'desc' },
          take: 50,
        })
        return json(jobs)
      }

      // ── 17. GET /api/knowledge/jobs/:id ────────────────────────────────
      const jobMatch = pathname.match(/^\/api\/knowledge\/jobs\/([^/]+)$/)
      if (jobMatch && method === 'GET') {
        const jobId = jobMatch[1]
        if (!jobId) return errorResponse('Invalid job id', 'ValidationError', 400)
        const job = await ctx.db.prisma.importJob.findUnique({ where: { id: jobId } })
        if (!job) return errorResponse('Job not found', 'NotFoundError', 404)
        return json(job)
      }

      // ── 18. POST /api/knowledge/reindex ────────────────────────────────
      if (pathname === '/api/knowledge/reindex' && method === 'POST') {
        const result = await ctx.semanticSearch?.reindexAll()
        if (!result) return errorResponse('Engine not wired', 'InternalError', 500)
        return json(result)
      }

      // ── 19. GET /api/knowledge/stats ───────────────────────────────────
      if (pathname === '/api/knowledge/stats' && method === 'GET') {
        const [
          entityCount,
          decisionCount,
          patternCount,
          topicCount,
          projectCount,
          preferenceCount,
          embeddingCount,
        ] = await Promise.all([
          ctx.db.prisma.entity.count().catch(() => 0),
          ctx.db.prisma.decisionRecord.count().catch(() => 0),
          ctx.db.prisma.patternExtract.count().catch(() => 0),
          ctx.db.prisma.topic.count().catch(() => 0),
          ctx.db.prisma.project.count().catch(() => 0),
          ctx.db.prisma.userPreference.count().catch(() => 0),
          ctx.db.prisma.memoryEmbedding.count().catch(() => 0),
        ])
        return json({
          entities: entityCount,
          decisions: decisionCount,
          patterns: patternCount,
          topics: topicCount,
          projects: projectCount,
          preferences: preferenceCount,
          embeddings: embeddingCount,
        })
      }

      return errorResponse('Not found', 'NotFoundError', 404)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Internal error'
      return errorResponse(message, 'InternalError', 500)
    }
  }
}
