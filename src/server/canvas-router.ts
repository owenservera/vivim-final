// src/server/canvas-router.ts
// vivim-canvas HTTP router (v7.12). Maps /api/canvas/* to the canvas
// capability plane (v7.9). Every route is just `registry.execute` of a
// `cap:canvas:*` capability — the same surface a CLI/MCP/agent uses.

import type { ServerContext } from './index.js'
import type { UnifiedCapabilityRegistry } from '../engines/unified-registry.js'
import { errorResponse, json } from './response.js'

export interface CanvasRouterDeps {
  registry: UnifiedCapabilityRegistry
}

function ctxFrom(req: Request): { userId?: string; metadata: Record<string, unknown> } {
  const userId = req.headers.get('x-user-id') ?? undefined
  return { userId, metadata: {} }
}

export function createCanvasRouter(ctx: ServerContext) {
  const registry = ctx.registry
  if (!registry) {
    return async (_req: Request, _url: URL) =>
      errorResponse('Canvas not initialized', 'CanvasUnavailable', 503)
  }

  return async (req: Request, url: URL): Promise<Response> => {
    const cap = (id: string, input: Record<string, unknown>) =>
      registry.execute(id, input, ctxFrom(req)) as Promise<unknown>

    // GET /api/canvas/definitions  → canvas_list
    if (url.pathname === '/api/canvas/definitions' && req.method === 'GET') {
      try {
        return json({ ok: true, result: await cap('cap:canvas:list', {}) })
      } catch (e) {
        return errorResponse((e as Error).message, 'CanvasListFailed', 500)
      }
    }

    // POST /api/canvas/definitions → canvas_define (body = LayerDraft)
    if (url.pathname === '/api/canvas/definitions' && req.method === 'POST') {
      try {
        const body = (await req.json()) as Record<string, unknown>
        return json({ ok: true, result: await cap('cap:canvas:define', body) })
      } catch (e) {
        return errorResponse((e as Error).message, 'CanvasDefineFailed', 500)
      }
    }

    // POST /api/canvas/spawn → canvas_spawn
    if (url.pathname === '/api/canvas/spawn' && req.method === 'POST') {
      try {
        const body = (await req.json()) as Record<string, unknown>
        return json({ ok: true, result: await cap('cap:canvas:spawn', body) })
      } catch (e) {
        return errorResponse((e as Error).message, 'CanvasSpawnFailed', 500)
      }
    }

    // GET /api/canvas/observe?op=oracle|manifest → canvas_observe
    if (url.pathname === '/api/canvas/observe' && req.method === 'GET') {
      try {
        const op = url.searchParams.get('op') ?? 'oracle'
        return json({ ok: true, result: await cap('cap:canvas:observe', { op }) })
      } catch (e) {
        return errorResponse((e as Error).message, 'CanvasObserveFailed', 500)
      }
    }

    // DELETE /api/canvas/instance/:id → canvas_dismiss
    const dismissMatch = url.pathname.match(/^\/api\/canvas\/instance\/([^/]+)$/)
    if (dismissMatch && req.method === 'DELETE') {
      try {
        return json({ ok: true, result: await cap('cap:canvas:dismiss', { instanceId: dismissMatch[1] }) })
      } catch (e) {
        return errorResponse((e as Error).message, 'CanvasDismissFailed', 500)
      }
    }

    // POST /api/canvas/instance/:id/mutate → canvas_mutate
    const mutateMatch = url.pathname.match(/^\/api\/canvas\/instance\/([^/]+)\/mutate$/)
    if (mutateMatch && req.method === 'POST') {
      try {
        const body = (await req.json()) as Record<string, unknown>
        return json({
          ok: true,
          result: await cap('cap:canvas:mutate', {
            instanceId: mutateMatch[1],
            regionId: body.regionId,
            state: body.state,
          }),
        })
      } catch (e) {
        return errorResponse((e as Error).message, 'CanvasMutateFailed', 500)
      }
    }

    return errorResponse('Unknown canvas route', 'NotFound', 404)
  }
}
