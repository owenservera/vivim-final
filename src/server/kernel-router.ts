// src/server/kernel-router.ts
// Kernel / Config REST routes — expose kernel oracle + universal config over HTTP.
// All routes under /api/kernel with Bearer token auth.
//
// PRINCIPLE: FRONTEND = BACKEND
// Every request is tagged with its source via X-Source header for audit logging.

import { z } from 'zod'
import type { ConfigUniversalSurface } from '../engines/config-universal-surface.js'
import type { ServerContext } from './index.js'
import { appErrorResponse, errorResponse } from './response.js'
import { extractSource } from './source-middleware.js'

export interface KernelRouterDeps {
  kernel: ServerContext['kernel']
  configSurface?: ConfigUniversalSurface
}

// AutoHealPolicy type
interface AutoHealPolicy {
  stalledEngineRestart: {
    enabled: boolean
    maxAgeMinutes: number
    backoffMs: number
  }
  healthDecayRestart: {
    enabled: boolean
    decayThreshold: number
    minHealth: number
    cooldownMinutes: number
  }
}

// Default policy
const DEFAULT_POLICY: AutoHealPolicy = {
  stalledEngineRestart: {
    enabled: false,
    maxAgeMinutes: 5,
    backoffMs: 1000,
  },
  healthDecayRestart: {
    enabled: false,
    decayThreshold: 10,
    minHealth: 0.5,
    cooldownMinutes: 1,
  },
}

// Cast op to SystemQueryType for the query engine
type SystemQueryType = 'health' | 'topology' | 'capability' | 'config' | 'all'

function asQueryType(op: string): SystemQueryType {
  if (
    op === 'health' ||
    op === 'topology' ||
    op === 'capability' ||
    op === 'config' ||
    op === 'all'
  ) {
    return op
  }
  return 'all'
}

export function createKernelRouter(
  deps: KernelRouterDeps,
): (req: Request, url: URL) => Promise<Response | null> {
  const { kernel, configSurface } = deps

  return async (req: Request, url: URL): Promise<Response | null> => {
    const _source = extractSource(req)

    // Oracle query endpoint
    if (url.pathname === '/api/kernel/oracle/query' && req.method === 'POST') {
      const schema = z.object({
        op: z.string().optional().default('all'),
        filter: z.record(z.unknown()).optional(),
        limit: z.number().int().positive().optional(),
      })
      const parsed = schema.safeParse(await req.json().catch(() => ({})))
      if (!parsed.success) {
        return errorResponse(parsed.error.message, 'ValidationError', 400)
      }
      const { op, filter, limit } = parsed.data

      if (!kernel?.context()?.oracle?.query) {
        return errorResponse('Oracle not available', 'NotAvailable', 503)
      }

      const result = await kernel.context()?.oracle?.query?.query({
        type: asQueryType(op),
        filter,
        limit,
      })
      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Oracle heal endpoint
    if (url.pathname === '/api/kernel/oracle/heal' && req.method === 'POST') {
      const schema = z.object({ issueId: z.string().min(1, 'issueId is required') })
      const parsed = schema.safeParse(await req.json().catch(() => ({})))
      if (!parsed.success) {
        return errorResponse(parsed.error.message, 'ValidationError', 400)
      }

      if (!kernel?.context()?.oracle?.actuator) {
        return errorResponse('Actuator not available', 'NotAvailable', 503)
      }

      const result = await kernel.context()?.oracle?.actuator?.heal(parsed.data.issueId)
      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Oracle scan endpoint
    if (url.pathname === '/api/kernel/oracle/scan' && req.method === 'POST') {
      if (!kernel?.context()?.oracle?.diagnostic) {
        return errorResponse('Diagnostic not available', 'NotAvailable', 503)
      }

      const result = await kernel.context()?.oracle?.diagnostic?.scan()
      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Oracle events endpoint
    if (url.pathname.startsWith('/api/kernel/oracle/events')) {
      const limit = Number(url.searchParams.get('limit') ?? '50')

      if (!kernel?.context()?.oracle?.events) {
        return errorResponse('Events not available', 'NotAvailable', 503)
      }

      const events = await kernel.context()?.oracle?.events?.getRecentEvents(limit)
      return new Response(JSON.stringify(events), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Oracle visibility endpoint
    if (url.pathname === '/api/kernel/oracle/visibility' && req.method === 'GET') {
      if (!kernel?.context()?.oracle?.query) {
        return errorResponse('Query not available', 'NotAvailable', 503)
      }

      const result = await kernel.context()?.oracle?.query?.query({ type: 'all' })
      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Oracle manifest endpoint
    if (url.pathname === '/api/kernel/oracle/manifest' && req.method === 'GET') {
      const registry = kernel?.context()?.registry?.describe()
      return new Response(JSON.stringify({ manifest: registry }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Oracle policy endpoints
    if (url.pathname === '/api/kernel/oracle/policy') {
      if (req.method === 'GET') {
        return new Response(JSON.stringify(DEFAULT_POLICY), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }

      if (req.method === 'PUT') {
        const schema = z.object({
          enabled: z.boolean().optional(),
          maxRetries: z.number().int().nonnegative().optional(),
          backoffMs: z.number().int().nonnegative().optional(),
          scope: z.string().optional(),
        })
        const parsed = schema.safeParse(await req.json().catch(() => ({})))
        if (!parsed.success) {
          return errorResponse(parsed.error.message, 'ValidationError', 400)
        }
        return new Response(JSON.stringify(parsed.data as AutoHealPolicy), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }
    }

    // Config scopes endpoint
    if (configSurface && url.pathname === '/api/kernel/config/scopes' && req.method === 'GET') {
      const scopes = configSurface.listScopes()
      return new Response(JSON.stringify(scopes), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Config get endpoint
    if (
      configSurface &&
      url.pathname.match(/^\/api\/kernel\/config\/[^/]+\/[^/]+$/) &&
      req.method === 'GET'
    ) {
      const parts = url.pathname.split('/').filter(Boolean)
      const scope = parts[2]
      const key = parts[3]

      if (!scope || !key) {
        return errorResponse('scope.key required', 'ValidationError', 400)
      }

      const value = configSurface.get(scope, key)
      return new Response(JSON.stringify({ value }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Config set endpoint
    if (
      configSurface &&
      url.pathname.match(/^\/api\/kernel\/config\/[^/]+\/[^/]+$/) &&
      req.method === 'PUT'
    ) {
      const parts = url.pathname.split('/').filter(Boolean)
      const scope = parts[2]
      const key = parts[3]
      const schema = z.object({ value: z.unknown() })
      const parsed = schema.safeParse(await req.json().catch(() => ({})))
      if (!parsed.success) {
        return errorResponse(parsed.error.message, 'ValidationError', 400)
      }

      if (!scope || !key) {
        return errorResponse('scope.key required', 'ValidationError', 400)
      }

      try {
        const result = configSurface.set(scope, key, parsed.data.value as unknown)
        return new Response(JSON.stringify(result), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      } catch (err) {
        return appErrorResponse(err)
      }
    }

    // Config snapshot endpoint
    if (configSurface && url.pathname === '/api/kernel/config/snapshot' && req.method === 'POST') {
      const id = configSurface.snapshot()
      return new Response(JSON.stringify({ id }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Config rollback endpoint
    if (configSurface && url.pathname === '/api/kernel/config/rollback' && req.method === 'POST') {
      const schema = z.object({ id: z.string().min(1, 'id is required') })
      const parsed = schema.safeParse(await req.json().catch(() => ({})))
      if (!parsed.success) {
        return errorResponse(parsed.error.message, 'ValidationError', 400)
      }

      configSurface.rollback(parsed.data.id)
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    return null
  }
}
