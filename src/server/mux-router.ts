// src/server/mux-router.ts
// REST API router — provider muxing endpoints (auto-route, mux, cost-report, preferences)
//
// PRINCIPLE: FRONTEND = BACKEND
// Every request is tagged with its source via X-Source header for audit logging.

import { z } from 'zod'
import type { CostOptimizer } from '../engines/cost-optimizer.js'
import type { MuxStrategy, ProviderMuxEngine } from '../engines/provider-mux.js'
import { errorResponse, json } from './response.js'
import { extractSource } from './source-middleware.js'

export interface MuxRouterContext {
  providerMux?: ProviderMuxEngine
  costOptimizer?: CostOptimizer
}

export function createMuxRouter(ctx: MuxRouterContext) {
  return async (req: Request): Promise<Response> => {
    const url = new URL(req.url)
    const { pathname } = url
    const method = req.method
    const _source = extractSource(req)

    try {
      // POST /api/route/auto — auto-route to best provider
      if (pathname === '/api/route/auto' && method === 'POST') {
        if (!ctx.providerMux) {
          return errorResponse('ProviderMuxEngine not wired', 'InternalError', 500)
        }
        const schema = z.object({
          message: z.string().min(1, 'message is required'),
          conversationId: z.string().optional(),
          capabilityId: z.string().optional(),
        })
        const parsed = schema.safeParse(await req.json())
        if (!parsed.success) return errorResponse(parsed.error.message, 'ValidationError', 400)
        const result = await ctx.providerMux.autoRoute(parsed.data.message, parsed.data.capabilityId)
        return json(result)
      }

      // POST /api/route/mux — multi-provider mux with strategy
      if (pathname === '/api/route/mux' && method === 'POST') {
        if (!ctx.providerMux) {
          return errorResponse('ProviderMuxEngine not wired', 'InternalError', 500)
        }
        const schema = z.object({
          message: z.string().min(1, 'message is required'),
          strategy: z.enum(['fan_out', 'round_robin', 'priority', 'cost_optimized', 'learned']).optional(),
          targetProviderIds: z.array(z.string()).optional(),
          maxProviders: z.number().int().positive().optional(),
          synthesisEnabled: z.boolean().optional(),
          costBudgetCents: z.number().int().nonnegative().optional(),
        })
        const parsed = schema.safeParse(await req.json())
        if (!parsed.success) return errorResponse(parsed.error.message, 'ValidationError', 400)
        const result = await ctx.providerMux.mux({
          message: parsed.data.message,
          strategy: parsed.data.strategy ?? 'fan_out',
          targetProviderIds: parsed.data.targetProviderIds,
          maxProviders: parsed.data.maxProviders ?? 3,
          synthesisEnabled: parsed.data.synthesisEnabled ?? false,
          costBudgetCents: parsed.data.costBudgetCents,
          timeoutMs: 30_000,
        })
        return json(result)
      }

      // POST /api/route/fanout — fan-out to specific providers
      if (pathname === '/api/route/fanout' && method === 'POST') {
        if (!ctx.providerMux) {
          return errorResponse('ProviderMuxEngine not wired', 'InternalError', 500)
        }
        const schema = z.object({
          message: z.string().min(1, 'message is required'),
          providerIds: z.array(z.string()).min(1, 'providerIds is required'),
          timeoutMs: z.number().int().positive().optional(),
          synthesisEnabled: z.boolean().optional(),
        })
        const parsed = schema.safeParse(await req.json())
        if (!parsed.success) return errorResponse(parsed.error.message, 'ValidationError', 400)
        const result = await ctx.providerMux.mux({
          message: parsed.data.message,
          strategy: 'fan_out',
          targetProviderIds: parsed.data.providerIds,
          maxProviders: parsed.data.providerIds.length,
          synthesisEnabled: parsed.data.synthesisEnabled ?? false,
          timeoutMs: parsed.data.timeoutMs ?? 30_000,
        })
        return json(result)
      }

      // GET /api/route/cost-report — cost report per provider
      if (pathname === '/api/route/cost-report' && method === 'GET') {
        if (!ctx.costOptimizer) {
          return errorResponse('CostOptimizer not wired', 'InternalError', 500)
        }
        const providerId = url.searchParams.get('providerId')
        const defaultFrom = Date.now() - 30 * 24 * 60 * 60 * 1000
        const from = Number(url.searchParams.get('from') ?? String(defaultFrom))
        const to = Number(url.searchParams.get('to') ?? String(Date.now()))
        if (!providerId) {
          // Return summaries for all providers
          const summaries = await ctx.costOptimizer.getProviderSummaries(from, to)
          return json({ summaries })
        }
        const report = await ctx.costOptimizer.getCostReport(providerId, from, to)
        return json(report)
      }

      // GET /api/route/preferences — learned routing preferences
      if (pathname === '/api/route/preferences' && method === 'GET') {
        if (!ctx.providerMux) {
          return errorResponse('ProviderMuxEngine not wired', 'InternalError', 500)
        }
        const capabilityId = url.searchParams.get('capabilityId') ?? undefined
        // Access store through engine — we need to expose this or access store directly
        // For now, use the store contract via the engine
        const muxStore = (
          ctx.providerMux as unknown as {
            store: {
              getRoutingPreferences: (capId?: string) => Promise<
                Array<{
                  id: string
                  capabilityId: string
                  providerId: string
                  score: number
                  sampleCount: number
                  updatedAt: number
                }>
              >
            }
          }
        ).store
        const prefs = await muxStore.getRoutingPreferences(capabilityId)
        return json({ preferences: prefs })
      }

      return errorResponse('Not found', 'NotFound', 404)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      return errorResponse(message, 'InternalError', 500)
    }
  }
}
