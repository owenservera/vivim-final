// src/server/conversation-router.ts
// REST API router — core endpoints

import type {
  PlanTier,
  ResolvedCapabilities,
  ResolvedCapability,
} from '../engines/capability-resolution.js'
import type { ServerContext } from './index.js'
import { errorResponse, json } from './response.js'

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
        const provider = await ctx.db.getProvider(id)
        if (!provider) return errorResponse('Provider not found', 'NotFoundError', 404)
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
        if (!conversation) return errorResponse('Conversation not found', 'NotFoundError', 404)
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
        if (!conversation) return errorResponse('Conversation not found', 'NotFoundError', 404)
        const providerId = (conversation as { providerId: string }).providerId

        const resolved = await ctx.resolutionEngine.resolve(providerId, 'free')
        const capability = flattenResolved(resolved).find((c) => c.slug === slug)
        if (!capability) return errorResponse('Capability not found', 'NotFoundError', 404)

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
            const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
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

      // POST /api/fleet/start — delegate to ChromeGovernor.spawn()
      if (pathname === '/api/fleet/start' && method === 'POST') {
        if (!ctx.governor) return errorResponse('Engine not wired', 'InternalError', 500)
        const body = (await req.json()) as { providerId: string; accountId: string }
        const slave = await ctx.governor.spawn(body.providerId, body.accountId)
        return json(slave, 201)
      }

      // Conversations
      if (pathname === '/api/conversations' && method === 'GET') {
        const limit = Number(url.searchParams.get('limit') ?? '50')
        const conversations = await ctx.db.listConversations({ limit })
        return json(conversations)
      }

      if (pathname === '/api/conversations' && method === 'POST') {
        const body = (await req.json()) as {
          providerId: string
          accountId?: string
          title?: string
        }
        const session = await ctx.db.ensureProviderSession({
          providerId: body.providerId,
          accountId: body.accountId,
        })
        const conv = await ctx.db.createConversation({
          id: crypto.randomUUID(),
          providerSessionId: session.id,
          providerId: body.providerId,
          title: body.title,
        })
        return json(conv, 201)
      }

      // POST /api/conversations/:id/send — delegate to ConversationManager.send()
      const sendMatch = pathname.match(/^\/api\/conversations\/([^/]+)\/send$/)
      if (sendMatch && method === 'POST') {
        const conversationId = sendMatch[1]
        if (!conversationId) return errorResponse('Invalid conversation id', 'ValidationError', 400)
        if (!ctx.conversationManager) return errorResponse('Engine not wired', 'InternalError', 500)
        const body = (await req.json()) as { message: string }
        const result = await ctx.conversationManager.send(conversationId, body.message)
        return json(result)
      }

      // Messages
      const msgsMatch = pathname.match(/^\/api\/conversations\/([^/]+)\/messages$/)
      if (msgsMatch && method === 'GET') {
        const conversationId = msgsMatch[1]
        if (!conversationId) return errorResponse('Invalid conversation id', 'ValidationError', 400)
        const limit = Number(url.searchParams.get('limit') ?? '100')
        const messages = await ctx.db.getMessages(conversationId, { limit })
        return json(messages)
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
            path: process.env.CHROME_PATH ?? null,
            extraArgs: [],
            disableGpu: false,
          },
        })
      }

      // PUT /api/config/governor — update governor config
      if (pathname === '/api/config/governor' && method === 'PUT') {
        const body = (await req.json()) as Record<string, unknown>
        await ctx.db.setConfig('governor', JSON.stringify(body))
        return json({ ok: true, note: 'Restart required for fleet config changes' })
      }

      return errorResponse('Not found', 'NotFoundError', 404)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Internal error'
      return errorResponse(message, 'InternalError', 500)
    }
  }
}
