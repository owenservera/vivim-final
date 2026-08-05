// src/server/routes/knowledge.ts
// REST API routes for Phase 0 memory intelligence — entities, topics, projects, preferences.

import { z } from 'zod'
import type { MemoryIntelligenceStoreImpl } from '../../storage/impl/memory-intelligence-store-impl.js'
import type { ServerContext } from '../index.js'
import { errorResponse, json } from '../response.js'

export function createKnowledgeRouter(ctx: ServerContext) {
  return async function knowledgeRouter(req: Request): Promise<Response | undefined> {
    const url = new URL(req.url)
    const path = url.pathname

    // Get the intelligence store from context
    const store = (ctx as unknown as { intelligenceStore?: MemoryIntelligenceStoreImpl })
      .intelligenceStore
    if (!store) {
      return errorResponse('MemoryIntelligenceStore not available', 'EngineUnavailable', 503)
    }

    try {
      // ═══════════════════════════════════════════════════════════════════
      // Entity routes
      // ═══════════════════════════════════════════════════════════════════

      // GET /api/knowledge/entities/search
      if (req.method === 'GET' && path === '/api/knowledge/entities/search') {
        const name = url.searchParams.get('name') ?? undefined
        const type = url.searchParams.get('type') ?? undefined
        const limit = url.searchParams.get('limit')
          ? Number(url.searchParams.get('limit'))
          : undefined
        const entities = await store.listEntities({ name, type, limit })
        return json({ entities, count: entities.length })
      }

      // GET /api/knowledge/entities
      if (req.method === 'GET' && path === '/api/knowledge/entities') {
        const type = url.searchParams.get('type') ?? undefined
        const limit = url.searchParams.get('limit')
          ? Number(url.searchParams.get('limit'))
          : undefined
        const entities = await store.listEntities({ type, limit })
        return json({ entities, count: entities.length })
      }

      // POST /api/knowledge/entities
      if (req.method === 'POST' && path === '/api/knowledge/entities') {
        const schema = z.object({
          name: z.string().min(1, 'name is required'),
          type: z.string().min(1, 'type is required'),
          description: z.string().optional(),
        })
        const parsed = schema.safeParse(await req.json())
        if (!parsed.success) return errorResponse(parsed.error.message, 'ValidationError', 400)
        const entity = await store.createEntity(parsed.data)
        return json({ entity }, 201)
      }

      // GET /api/knowledge/entities/:id
      const entityMatch = path.match(/^\/api\/knowledge\/entities\/([^/]+)$/)
      if (req.method === 'GET' && entityMatch && entityMatch[1]) {
        const entity = await store.getEntityById(entityMatch[1])
        if (!entity) return errorResponse('Entity not found', 'NotFound', 404)
        return json({ entity })
      }

      // PUT /api/knowledge/entities/:id
      if (req.method === 'PUT' && entityMatch && entityMatch[1]) {
        const schema = z.object({
          name: z.string().optional(),
          type: z.string().optional(),
          description: z.string().optional(),
          confidence: z.number().min(0).max(1).optional(),
        })
        const parsed = schema.safeParse(await req.json())
        if (!parsed.success) return errorResponse(parsed.error.message, 'ValidationError', 400)
        const entity = await store.updateEntity(entityMatch[1], parsed.data)
        return json({ entity })
      }

      // DELETE /api/knowledge/entities/:id
      if (req.method === 'DELETE' && entityMatch && entityMatch[1]) {
        await store.softDeleteEntity(entityMatch[1])
        return json({ ok: true })
      }

      // ═══════════════════════════════════════════════════════════════════
      // Topic routes
      // ═══════════════════════════════════════════════════════════════════

      // GET /api/knowledge/topics/search
      if (req.method === 'GET' && path === '/api/knowledge/topics/search') {
        const name = url.searchParams.get('name') ?? undefined
        const limit = url.searchParams.get('limit')
          ? Number(url.searchParams.get('limit'))
          : undefined
        const topics = await store.listTopics({ limit })
        const filtered = name
          ? topics.filter((t) => t.name.toLowerCase().includes(name.toLowerCase()))
          : topics
        return json({ topics: filtered, count: filtered.length })
      }

      // GET /api/knowledge/topics
      if (req.method === 'GET' && path === '/api/knowledge/topics') {
        const limit = url.searchParams.get('limit')
          ? Number(url.searchParams.get('limit'))
          : undefined
        const topics = await store.listTopics({ limit })
        return json({ topics, count: topics.length })
      }

      // POST /api/knowledge/topics
      if (req.method === 'POST' && path === '/api/knowledge/topics') {
        const body = (await req.json()) as {
          name?: string
          description?: string
          color?: string
        }
        if (!body.name || typeof body.name !== 'string') {
          return errorResponse('name is required', 'ValidationError', 400)
        }
        const topic = await store.createTopic({
          name: body.name,
          description: body.description,
          color: body.color,
        })
        return json({ topic }, 201)
      }

      // GET /api/knowledge/topics/:id
      const topicMatch = path.match(/^\/api\/knowledge\/topics\/([^/]+)$/)
      if (req.method === 'GET' && topicMatch && topicMatch[1]) {
        const topic = await store.getTopicById(topicMatch[1])
        if (!topic) return errorResponse('Topic not found', 'NotFound', 404)
        return json({ topic })
      }

      // PUT /api/knowledge/topics/:id
      if (req.method === 'PUT' && topicMatch && topicMatch[1]) {
        const body = (await req.json()) as {
          name?: string
          description?: string
          color?: string
        }
        const topic = await store.updateTopic(topicMatch[1], body)
        return json({ topic })
      }

      // DELETE /api/knowledge/topics/:id
      if (req.method === 'DELETE' && topicMatch && topicMatch[1]) {
        await store.softDeleteTopic(topicMatch[1])
        return json({ ok: true })
      }

      // ═══════════════════════════════════════════════════════════════════
      // Project routes
      // ═══════════════════════════════════════════════════════════════════

      // GET /api/knowledge/projects/search
      if (req.method === 'GET' && path === '/api/knowledge/projects/search') {
        const name = url.searchParams.get('name') ?? undefined
        const limit = url.searchParams.get('limit')
          ? Number(url.searchParams.get('limit'))
          : undefined
        const projects = await store.listProjects({ limit })
        const filtered = name
          ? projects.filter((p) => p.name.toLowerCase().includes(name.toLowerCase()))
          : projects
        return json({ projects: filtered, count: filtered.length })
      }

      // GET /api/knowledge/projects
      if (req.method === 'GET' && path === '/api/knowledge/projects') {
        const status = url.searchParams.get('status') ?? undefined
        const limit = url.searchParams.get('limit')
          ? Number(url.searchParams.get('limit'))
          : undefined
        const projects = await store.listProjects({ status, limit })
        return json({ projects, count: projects.length })
      }

      // POST /api/knowledge/projects
      if (req.method === 'POST' && path === '/api/knowledge/projects') {
        const body = (await req.json()) as {
          name?: string
          description?: string
          status?: string
        }
        if (!body.name || typeof body.name !== 'string') {
          return errorResponse('name is required', 'ValidationError', 400)
        }
        const project = await store.createProject({
          name: body.name,
          description: body.description,
          status: body.status,
        })
        return json({ project }, 201)
      }

      // GET /api/knowledge/projects/:id
      const projectMatch = path.match(/^\/api\/knowledge\/projects\/([^/]+)$/)
      if (req.method === 'GET' && projectMatch && projectMatch[1]) {
        const project = await store.getProjectById(projectMatch[1])
        if (!project) return errorResponse('Project not found', 'NotFound', 404)
        return json({ project })
      }

      // PUT /api/knowledge/projects/:id
      if (req.method === 'PUT' && projectMatch && projectMatch[1]) {
        const body = (await req.json()) as {
          name?: string
          description?: string
          status?: string
        }
        const project = await store.updateProject(projectMatch[1], body)
        return json({ project })
      }

      // DELETE /api/knowledge/projects/:id
      if (req.method === 'DELETE' && projectMatch && projectMatch[1]) {
        await store.softDeleteProject(projectMatch[1])
        return json({ ok: true })
      }

      // ═══════════════════════════════════════════════════════════════════
      // UserPreference routes
      // ═══════════════════════════════════════════════════════════════════

      // GET /api/knowledge/preferences
      if (req.method === 'GET' && path === '/api/knowledge/preferences') {
        const userId = url.searchParams.get('userId') ?? undefined
        const limit = url.searchParams.get('limit')
          ? Number(url.searchParams.get('limit'))
          : undefined
        const preferences = await store.listUserPreferences({ userId, limit })
        return json({ preferences, count: preferences.length })
      }

      // POST /api/knowledge/preferences
      if (req.method === 'POST' && path === '/api/knowledge/preferences') {
        const body = (await req.json()) as {
          userId?: string
          key?: string
          value?: string
          source?: string
          confidence?: number
        }
        if (!body.userId || typeof body.userId !== 'string') {
          return errorResponse('userId is required', 'ValidationError', 400)
        }
        if (!body.key || typeof body.key !== 'string') {
          return errorResponse('key is required', 'ValidationError', 400)
        }
        if (!body.value || typeof body.value !== 'string') {
          return errorResponse('value is required', 'ValidationError', 400)
        }
        const preference = await store.upsert(
          body.userId,
          body.key,
          body.value,
          body.source,
          body.confidence,
        )
        return json({ preference }, 201)
      }

      // GET /api/knowledge/preferences/:id
      const prefMatch = path.match(/^\/api\/knowledge\/preferences\/([^/]+)$/)
      if (req.method === 'GET' && prefMatch && prefMatch[1]) {
        const preference = await store.getUserPreferenceById(prefMatch[1])
        if (!preference) return errorResponse('Preference not found', 'NotFound', 404)
        return json({ preference })
      }

      // PUT /api/knowledge/preferences/:id
      if (req.method === 'PUT' && prefMatch && prefMatch[1]) {
        const body = (await req.json()) as {
          value?: string
          confidence?: number
        }
        const preference = await store.updateUserPreference(prefMatch[1], body)
        return json({ preference })
      }

      // DELETE /api/knowledge/preferences/:id
      if (req.method === 'DELETE' && prefMatch && prefMatch[1]) {
        await store.softDeleteUserPreference(prefMatch[1])
        return json({ ok: true })
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return errorResponse(message, 'KnowledgeError', 400)
    }

    return undefined
  }
}
