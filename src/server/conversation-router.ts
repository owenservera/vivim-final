// src/server/conversation-router.ts
// REST API router — core endpoints
// Work Items 01/03: Consistent error handling with AppError, standardized error codes

import { z } from 'zod'
import type {
  PlanTier,
  ResolvedCapabilities,
  ResolvedCapability,
} from '../engines/capability-resolution.js'
import { catchDebug } from '../lib/catch-logger.js'
import type { ServerContext } from './index.js'
import { appErrorResponse, errorResponse, json } from './response.js'
import { parseRequestBody } from './validate.js'

/** Flatten grouped ResolvedCapabilities into a single ordered array. */
function flattenResolved(resolved: ResolvedCapabilities): ResolvedCapability[] {
  return [
    ...resolved.composer,
    ...resolved.header,
    ...resolved.message,
    ...resolved.sidebar,
    ...resolved.inline,
  ]
}

export function createConversationRouter(ctx: ServerContext) {
  return async (req: Request): Promise<Response> => {
    const url = new URL(req.url)
    const { pathname } = url
    const method = req.method

    try {
      // Providers
      if (pathname === '/api/providers' && method === 'GET') {
        const providers = await ctx.db.listProviders()
        return json(providers)
      }

      if (pathname.match(/^\/api\/providers\/[^/]+$/) && method === 'GET') {
        const id = pathname.split('/')[3]
        if (!id) return errorResponse('Invalid provider id', 'ValidationError', 400)
        // Use cross-boundary cache for provider lookups (system-side, rarely changes)
        const { getCrossBoundaryCache } = await import('../storage/cross-boundary-cache.js')
        const cache = getCrossBoundaryCache()
        const provider = await cache.get(
          `provider:${id}`,
          () => ctx.db.getProvider(id),
        )
        if (!provider) return errorResponse('Provider not found', 'NotFound', 404)
        return json(provider)
      }

      // GET /api/providers/:id/capabilities — delegate to CapabilityResolutionEngine
      const capMatch = pathname.match(/^\/api\/providers\/([^/]+)\/capabilities$/)
      if (capMatch && method === 'GET') {
        const providerId = capMatch[1]
        if (!providerId) return errorResponse('Invalid provider id', 'ValidationError', 400)
        if (!ctx.resolutionEngine) return errorResponse('Engine not wired', 'InternalError', 500)
        const planTier = (url.searchParams.get('planTier') ?? 'free') as PlanTier
        const resolved = await ctx.resolutionEngine.resolve(providerId, planTier)
        return json({ ...resolved, capabilities: flattenResolved(resolved) })
      }

      // GET /api/conversations/:id/capabilities — resolve via the conversation's provider
      const convCapMatch = pathname.match(/^\/api\/conversations\/([^/]+)\/capabilities$/)
      if (convCapMatch && method === 'GET') {
        const conversationId = convCapMatch[1]
        if (!conversationId) return errorResponse('Invalid conversation id', 'ValidationError', 400)
        if (!ctx.resolutionEngine) return errorResponse('Engine not wired', 'InternalError', 500)
        const conversation = await ctx.db.getConversation(conversationId)
        if (!conversation) return errorResponse('Conversation not found', 'NotFound', 404)
        const providerId = (conversation as { providerId: string }).providerId
        const planTier = (url.searchParams.get('planTier') ?? 'free') as PlanTier
        const resolved = await ctx.resolutionEngine.resolve(providerId, planTier)
        return json({ ...resolved, capabilities: flattenResolved(resolved) })
      }

      // POST /api/conversations/:id/capabilities/:slug/execute
      const execMatch = pathname.match(
        /^\/api\/conversations\/([^/]+)\/capabilities\/([^/]+)\/execute$/,
      )
      if (execMatch && method === 'POST') {
        const conversationId = execMatch[1]
        const slug = execMatch[2]
        if (!conversationId || !slug) {
          return errorResponse('Invalid conversation or capability', 'ValidationError', 400)
        }
        if (!ctx.resolutionEngine) return errorResponse('Engine not wired', 'InternalError', 500)
        const conversation = await ctx.db.getConversation(conversationId)
        if (!conversation) return errorResponse('Conversation not found', 'NotFound', 404)
        const providerId = (conversation as { providerId: string }).providerId

        const resolved = await ctx.resolutionEngine.resolve(providerId, 'free')
        const capability = flattenResolved(resolved).find((c) => c.slug === slug)
        if (!capability) return errorResponse('Capability not found', 'NotFound', 404)

        const traceId = crypto.randomUUID()
        ctx.eventBus.emit({
          type: 'capability:progress',
          step: 0,
          total: 1,
          description: `Dispatched ${slug}`,
          moduleId: capability.id,
          slaveId: conversationId,
        })

        // 90.6: real backend execution. ChromeGovernor may expose
        // executeCapability in a later phase; prefer it if present. Otherwise
        // delegate through the engine that owns the capability and surface a
        // `dispatched` result so progress can still stream over WS.
        const governor = ctx.governor as
          | {
              executeCapability?: (
                ref: string,
                slug: string,
                opts?: {
                  resolver?: { getConversationProviderId?: (id: string) => Promise<string | null> }
                  capabilityLookup?: (
                    slug: string,
                  ) => { id: string; inputSchema?: { properties?: Record<string, unknown> } } | null
                  params?: Record<string, unknown>
                },
              ) => Promise<unknown>
            }
          | undefined
        let executed: unknown
        let ok = true
        if (governor?.executeCapability) {
          try {
            const parsed = z
              .record(z.string(), z.unknown())
              .safeParse(await req.json().catch(() => ({})))
            // [audit] log the error with context here
            const body: Record<string, unknown> = parsed.success ? parsed.data : {}
            executed = await governor.executeCapability(conversationId, slug, {
              resolver: {
                getConversationProviderId: async (id) => {
                  const conv = await ctx.db.getConversation(id)
                  return conv ? (conv as { providerId: string }).providerId : null
                },
              },
              capabilityLookup: (s) => ctx.registry?.getBySlug(s) ?? null,
              params: body ?? {},
            })
          } catch (err) {
            ok = false
            executed = { error: err instanceof Error ? err.message : 'execution failed' }
          }
        } else {
          executed = { status: 'dispatched', slug, conversationId }
        }

        ctx.eventBus.emit({
          type: 'capability:executed',
          capabilityId: capability.id,
          providerId,
          traceId,
          ok,
          latencyMs: 0,
        })

        return json({ ok, slug, conversationId, traceId, result: executed })
      }

      // Sandbox debug surface (90.8)
      if (pathname === '/api/sandbox/debug' && method === 'GET') {
        return json({
          providers: await ctx.db.listProviders(),
          recentEvents: ctx.eventBus.snapshot(),
        })
      }
      if (pathname === '/api/sandbox/debug' && method === 'POST') {
        ctx.eventBus.removeAllListeners()
        ctx.eventBus.clearRecent()
        return json({ status: 'reset' })
      }

      // Fleet
      if (pathname === '/api/fleet/status' && method === 'GET') {
        return json([])
      }

      // DELETE /api/fleet/:id — kill a Chrome slave
      const fleetDelMatch = pathname.match(/^\/api\/fleet\/([^/]+)$/)
      if (fleetDelMatch && method === 'DELETE') {
        const slaveId = fleetDelMatch[1]
        if (!slaveId) return errorResponse('Invalid fleet id', 'ValidationError', 400)
        if (!ctx.governor) return json({ ok: true })
        try {
          await ctx.governor.kill(slaveId)
        } catch (err) {
          catchDebug(err, 'server:conversation-router:180')
          // best-effort kill; return success
        }
        return json({ ok: true })
      }

      // POST /api/fleet/start — delegate to ChromeGovernor.spawn()
      if (pathname === '/api/fleet/start' && method === 'POST') {
        if (!ctx.governor) return errorResponse('Engine not wired', 'InternalError', 500)
        const schema = z.object({ providerId: z.string().min(1), accountId: z.string().min(1) })
        const parsed = await parseRequestBody(req, schema)
        if (!parsed.success) return parsed.response
        const slave = await ctx.governor.spawn(parsed.data.providerId, parsed.data.accountId)
        return json(slave, 201)
      }

      // Conversations
      if (pathname === '/api/conversations' && method === 'GET') {
        const limit = Number(url.searchParams.get('limit') ?? '50')
        const conversations = await ctx.db.listConversations({ limit })
        return json(conversations)
      }

      if (pathname === '/api/conversations' && method === 'POST') {
        const schema = z.object({
          providerId: z.string().min(1),
          accountId: z.string().optional(),
          title: z.string().optional(),
        })
        const parsed = await parseRequestBody(req, schema)
        if (!parsed.success) return parsed.response
        const session = await ctx.db.ensureProviderSession({
          providerId: parsed.data.providerId,
          accountId: parsed.data.accountId,
        })
        const conv = await ctx.db.createConversation({
          id: crypto.randomUUID(),
          providerSessionId: session.id,
          providerId: parsed.data.providerId,
          title: parsed.data.title,
        })
        return json(conv, 201)
      }

      // POST /api/conversations/:id/send — delegate to ConversationManager.send()
      const sendMatch = pathname.match(/^\/api\/conversations\/([^/]+)\/send$/)
      if (sendMatch && method === 'POST') {
        const conversationId = sendMatch[1]
        if (!conversationId) return errorResponse('Invalid conversation id', 'ValidationError', 400)
        if (!ctx.conversationManager) return errorResponse('Engine not wired', 'InternalError', 500)
        const schema = z.object({ message: z.string().min(1) })
        const parsed = await parseRequestBody(req, schema)
        if (!parsed.success) return parsed.response
        // 30s timeout — prevents hanging when no Chrome slave is connected.
        const SEND_TIMEOUT_MS = 30_000
        const result = await Promise.race([
          ctx.conversationManager.send(conversationId, parsed.data.message),
          new Promise<never>((_, reject) =>
            setTimeout(
              () => reject(new Error('Send timed out — no Chrome slave connected')),
              SEND_TIMEOUT_MS,
            ),
          ),
        ]).catch((err) => ({
          ok: false as const,
          messageId: '',
          blocks: [] as never[],
          text: '',
          latencyMs: SEND_TIMEOUT_MS,
          error: err instanceof Error ? err.message : String(err),
        }))
        return json(result)
      }

      // Messages
      const msgsMatch = pathname.match(/^\/api\/conversations\/([^/]+)\/messages$/)
      if (msgsMatch && method === 'GET') {
        const conversationId = msgsMatch[1]
        if (!conversationId) return errorResponse('Invalid conversation id', 'ValidationError', 400)
        const limit = Number(url.searchParams.get('limit') ?? '100')

        // Check for metadata filters
        const isPinned = url.searchParams.get('isPinned')
        const isArchived = url.searchParams.get('isArchived')
        const readStatus = url.searchParams.get('readStatus')

        if (isPinned !== null || isArchived !== null || readStatus !== null) {
          // Use metadata query
          if (!ctx.conversationManager)
            return errorResponse('Engine not wired', 'InternalError', 500)
          const filters: Record<string, unknown> = { conversationId }
          if (isPinned !== null) filters.isPinned = Number(isPinned)
          if (isArchived !== null) filters.isArchived = Number(isArchived)
          if (readStatus !== null) filters.readStatus = readStatus
          const messages = await ctx.conversationManager.queryMessagesByMetadata(filters)
          return json(messages)
        }

        const messages = await ctx.db.getMessages(conversationId, { limit })
        return json(messages)
      }

      // PATCH /api/conversations/:id/messages/:mid — update message metadata
      const msgMetaMatch = pathname.match(/^\/api\/conversations\/([^/]+)\/messages\/([^/]+)$/)
      if (msgMetaMatch && method === 'PATCH') {
        const conversationId = msgMetaMatch[1]
        const messageId = msgMetaMatch[2]
        if (!conversationId || !messageId)
          return errorResponse('Invalid conversation or message id', 'ValidationError', 400)
        if (!ctx.conversationManager) return errorResponse('Engine not wired', 'InternalError', 500)

        const schema = z.object({
          isPinned: z.number().optional(),
          isArchived: z.number().optional(),
          readStatus: z.string().optional(),
        })
        const parsed = await parseRequestBody(req, schema)
        if (!parsed.success) return parsed.response

        await ctx.conversationManager.updateMessageMetadata(messageId, parsed.data)
        return json({ ok: true })
      }

      // PATCH /api/conversations/:id/messages/batch — batch update metadata
      const batchMetaMatch = pathname.match(/^\/api\/conversations\/([^/]+)\/messages\/batch$/)
      if (batchMetaMatch && method === 'PATCH') {
        const conversationId = batchMetaMatch[1]
        if (!conversationId) return errorResponse('Invalid conversation id', 'ValidationError', 400)
        if (!ctx.conversationManager) return errorResponse('Engine not wired', 'InternalError', 500)

        const schema = z.object({
          messageIds: z.array(z.string()).min(1),
          metadata: z.object({
            isPinned: z.number().optional(),
            isArchived: z.number().optional(),
            readStatus: z.string().optional(),
          }),
        })
        const parsed = await parseRequestBody(req, schema)
        if (!parsed.success) return parsed.response

        for (const messageId of parsed.data.messageIds) {
          await ctx.conversationManager.updateMessageMetadata(messageId, parsed.data.metadata)
        }
        return json({ ok: true, updated: parsed.data.messageIds.length })
      }

      // DELETE /api/conversations/:id — delegate to ConversationStore.deleteConversation()
      const delMatch = pathname.match(/^\/api\/conversations\/([^/]+)$/)
      if (delMatch && method === 'DELETE') {
        const conversationId = delMatch[1]
        if (!conversationId) return errorResponse('Invalid conversation id', 'ValidationError', 400)
        await ctx.db.prisma.conversation.delete({ where: { id: conversationId } })
        return json({ ok: true })
      }

      // GET /api/health — general liveness + DB readiness (local-first, single-user)
      // Session 2 (2026-08-07): Added `db: 'ok'|'unreachable'` to the response
      // so the frontend health route can distinguish backend-up from db-up.
      // Returns 503 when the DB is unreachable so load balancers can route
      // around a degraded instance.
      // Step 11: Added `dbs` sub-object with health telemetry for both DBs.
      if (pathname === '/api/health' && method === 'GET') {
        let dbStatus: 'ok' | 'unreachable' = 'ok'
        try {
          // Cheap liveness probe — listProviders hits the provider table.
          await ctx.db.listProviders()
        } catch {
          dbStatus = 'unreachable'
        }
        const status = dbStatus === 'ok' ? 'ok' : 'degraded'

        // DB health telemetry (non-blocking, best-effort)
        let dbs: Record<string, unknown> | undefined
        try {
          const { getDbHealth } = await import('../../storage/db-health.js')
          const health = await getDbHealth()
          dbs = {
            system: {
              integrityCheck: health.system.integrityCheck,
              fileSizeBytes: health.system.fileSizeBytes,
              schemaVersion: health.system.schemaVersion,
            },
            user: {
              integrityCheck: health.user.integrityCheck,
              fileSizeBytes: health.user.fileSizeBytes,
              schemaVersion: health.user.schemaVersion,
            },
          }
        } catch {
          // Health telemetry is best-effort — don't fail the endpoint
        }

        return json({ status, db: dbStatus, dbs }, dbStatus === 'ok' ? 200 : 503)
      }

      // Session — local-first stub (no real auth; returns success for login)
      if (pathname === '/api/session') {
        if (method === 'GET') {
          return json({ authenticated: false, userId: null, email: null })
        }
        if (method === 'POST') {
          const parsed = z
            .object({ email: z.string().optional(), action: z.string().optional() })
            .safeParse(await req.json().catch(() => ({})))
          // [audit] log the error with context here
          const body = parsed.success ? parsed.data : {}
          if (body.action === 'logout') {
            return json({ authenticated: false })
          }
          // Local-first: login always succeeds
          return json({
            authenticated: true,
            userId: body.email ?? 'user:local',
            email: body.email ?? null,
          })
        }
      }

      // Admin
      if (pathname === '/api/admin/seed' && method === 'POST') {
        return json({ status: 'ok' })
      }

      // Health providers endpoint (4.5)
      if (pathname === '/api/health/providers' && method === 'GET') {
        const healthKernel = (
          ctx as { healthKernel?: import('../engines/provider-health.js').ProviderHealthKernel }
        ).healthKernel
        if (!healthKernel) {
          return json({})
        }
        const allHealth = healthKernel.getAllHealth()
        const result: Record<string, unknown> = {}
        for (const [providerId, h] of allHealth) {
          result[providerId] = h
        }
        return json(result)
      }

      // Mirror state endpoint (5.4)
      const mirrorMatch = pathname.match(/^\/api\/conversations\/([^/]+)\/mirror$/)
      if (mirrorMatch && method === 'GET') {
        const convId = mirrorMatch[1]
        if (!convId) return errorResponse('Invalid conversation id', 'ValidationError', 400)
        const mirror = (ctx as { mirror?: import('../engines/mirror-engine.js').MirrorEngine })
          .mirror
        if (!mirror) return json({ chrome: {}, ui: {}, lastSyncAt: 0, pendingUpdates: 0 })
        const state = await mirror.projectState(convId)
        return json(state)
      }

      // Config
      const configMatch = pathname.match(/^\/api\/config\/([^/]+)$/)
      if (configMatch && method === 'GET') {
        const engineId = configMatch[1]
        if (!engineId) return errorResponse('Invalid engine id', 'ValidationError', 400)
        const config = await ctx.db.getConfig(engineId)
        return json(config)
      }

      // GET /api/config/governor — governor config
      if (pathname === '/api/config/governor' && method === 'GET') {
        const govConfig =
          (ctx.governor as unknown as { config?: Record<string, unknown> })?.config ?? {}
        return json({
          fleetConfig: {
            portRange: govConfig.portRange ?? [9300, 9400],
            healthProbeIntervalMs: govConfig.healthProbeIntervalMs ?? 30_000,
            autoRestart: govConfig.autoRestart ?? true,
            maxRestarts: govConfig.maxRestarts ?? 3,
            circuitBreakerThreshold: govConfig.circuitBreakerThreshold ?? 5,
            circuitBreakerResetMs: govConfig.circuitBreakerResetMs ?? 60_000,
          },
          chromeConfig: {
            path: govConfig.chromePath ?? '',
            extraArgs: govConfig.extraArgs ?? [],
            disableGpu: govConfig.disableGpu ?? false,
          },
        })
      }

      // PUT /api/config/governor — update governor config
      if (pathname === '/api/config/governor' && method === 'PUT') {
        const parsed = await parseRequestBody(req, z.record(z.string(), z.unknown()))
        if (!parsed.success) return parsed.response
        const body = parsed.data
        await ctx.db.setConfig('governor', JSON.stringify(body))
        return json({ ok: true, note: 'Restart required for fleet config changes' })
      }

      return errorResponse('Not found', 'NotFound', 404)
    } catch (err: unknown) {
      return appErrorResponse(err)
    }
  }
}
