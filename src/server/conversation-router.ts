// src/server/conversation-router.ts
// REST API router — core endpoints

import type { PlanTier } from '../engines/capability-resolution.js'
import type { ServerContext } from './index.js'
import { errorResponse, json } from './response.js'

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
        return json(resolved)
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
        return json([])
      }

      if (pathname === '/api/conversations' && method === 'POST') {
        const body = (await req.json()) as { providerId: string; title?: string }
        const conv = await ctx.db.createConversation({
          id: crypto.randomUUID(),
          providerSessionId: 'default',
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

      // Config
      const configMatch = pathname.match(/^\/api\/config\/([^/]+)$/)
      if (configMatch && method === 'GET') {
        const engineId = configMatch[1]
        if (!engineId) return errorResponse('Invalid engine id', 'ValidationError', 400)
        const config = await ctx.db.getConfig(engineId)
        return json(config)
      }

      return errorResponse('Not found', 'NotFoundError', 404)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Internal error'
      return errorResponse(message, 'InternalError', 500)
    }
  }
}
