// src/server/canvas-router.ts
// vivim-canvas HTTP router (v7.12). Maps /api/canvas/* to the canvas
// capability plane (v7.9). Every route is just `registry.execute` of a
// `cap:canvas:*` capability — the same surface a CLI/MCP/agent uses.
//
// PRINCIPLE: FRONTEND = BACKEND
// Every request is tagged with its source via X-Source header for audit logging.

import { z } from 'zod'
import type { CapabilityEventBus } from '../engines/capability-event-bus.js'
import type { UnifiedCapabilityRegistry } from '../engines/unified-registry.js'
import { catchDebug } from '../lib/catch-logger.js'
import type { ServerContext } from './index.js'
import { appErrorResponse, errorResponse, json } from './response.js'
import { extractSource } from './source-middleware.js'

export interface CanvasRouterDeps {
  registry: UnifiedCapabilityRegistry
}

function ctxFrom(req: Request): { userId?: string; metadata: Record<string, unknown> } {
  const userId = req.headers.get('x-user-id') ?? undefined
  return { userId, metadata: {} }
}

/**
 * An empty ResolvedSurface — returned when no conceptual model is wired.
 * Stops the frontend 404 cascade so the canvas renders with 0 nodes
 * instead of looping endless retries.
 */
function emptySurface(traceId: string): Record<string, unknown> {
  return {
    traceId,
    workspaceId: 'ws:global',
    slots: [],
    resolvedAt: Date.now(),
    durationMs: 0,
  }
}

export function createCanvasRouter(ctx: ServerContext) {
  const registry = ctx.registry
  const conceptualModel = (ctx as unknown as { conceptualModel?: unknown }).conceptualModel
  if (!registry) {
    return async (_req: Request, _url: URL) =>
      errorResponse('Canvas not initialized', 'NotAvailable', 503)
  }

  return async (req: Request, url: URL): Promise<Response> => {
    const _source = extractSource(req)
    const cap = (id: string, input: Record<string, unknown>) =>
      registry.execute(id, input, ctxFrom(req)) as Promise<unknown>

    // GET /api/canvas/definitions  → canvas_list
    if (url.pathname === '/api/canvas/definitions' && req.method === 'GET') {
      try {
        return json({ ok: true, result: await cap('cap:canvas:list', {}) })
      } catch (e) {
        return appErrorResponse(e)
      }
    }

    // POST /api/canvas/definitions → canvas_define (body = LayerDraft)
    if (url.pathname === '/api/canvas/definitions' && req.method === 'POST') {
      try {
        const body = z.record(z.unknown()).parse(await req.json())
        return json({ ok: true, result: await cap('cap:canvas:define', body) })
      } catch (e) {
        return appErrorResponse(e)
      }
    }

    // POST /api/canvas/spawn → canvas_spawn
    if (url.pathname === '/api/canvas/spawn' && req.method === 'POST') {
      try {
        const body = z.record(z.unknown()).parse(await req.json())
        return json({ ok: true, result: await cap('cap:canvas:spawn', body) })
      } catch (e) {
        return appErrorResponse(e)
      }
    }

    // POST /api/canvas/resolve → resolves a surface from provider state
    // Returns a ResolvedSurface matching the request's workspace + accounts.
    // Called by the frontend useResolvedNodes hook (TanStack Query).
    if (url.pathname === '/api/canvas/resolve' && req.method === 'POST') {
      try {
        const traceId = req.headers.get('x-trace-id') ?? `canvas:resolve:${Date.now()}`
        // If conceptual model is wired, delegate to it; otherwise return empty surface.
        if (
          conceptualModel &&
          typeof (conceptualModel as { resolveSurface?: unknown }).resolveSurface === 'function'
        ) {
          const schema = z.object({
            workspaceId: z.string().optional(),
            userId: z.string().optional(),
            providerIds: z.array(z.string()).optional(),
            slotIds: z.array(z.string()).optional(),
            variant: z.string().optional(),
          })
          const parsed = schema.safeParse(await req.json())
          const body = parsed.success ? parsed.data : {}
          const providerId = body.providerIds?.[0] ?? 'generic'
          const family = await (
            conceptualModel as {
              resolveFamilyForProvider: (pid: string) => Promise<{ id: string } | null>
            }
          ).resolveFamilyForProvider(providerId)
          if (family) {
            const slots = await (
              conceptualModel as {
                resolveSurface: (pid: string, fid: string, slotIds?: string[]) => Promise<unknown[]>
              }
            ).resolveSurface(providerId, family.id, body.slotIds)
            return json({
              traceId,
              workspaceId: body.workspaceId ?? 'ws:global',
              slots,
              resolvedAt: Date.now(),
              durationMs: 0,
            })
          }
        }
        return json(emptySurface(traceId))
      } catch (_e) {
        return json(emptySurface(`resolve:error:${Date.now()}`))
      }
    }

    // GET /api/canvas/events?workspaceId= — SSE stream for live canvas events
    // The frontend subscribes via EventSource. Keeps the connection alive
    // with periodic comments so the browser doesn't treat it as a dead stream.
    if (url.pathname === '/api/canvas/events' && req.method === 'GET') {
      const workspaceId = url.searchParams.get('workspaceId') ?? 'ws:global'
      const eventBus = (ctx as unknown as { eventBus?: CapabilityEventBus }).eventBus
      const encoder = new TextEncoder()
      let interval: ReturnType<typeof setInterval> | null = null
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(
            encoder.encode(
              `event: connected\ndata: {"type":"connected","workspaceId":"${workspaceId}","timestamp":${Date.now()}}\n\n`,
            ),
          )
          interval = setInterval(() => {
            controller.enqueue(encoder.encode(`:keepalive ${Date.now()}\n\n`))
          }, 15_000)

          // P0-4: Bridge EventBus canvas events to SSE stream
          if (eventBus) {
            const canvasEvents = [
              'canvas:layer:spawned',
              'canvas:layer:dismissed',
              'canvas:def:updated',
              'canvas:mutated',
              'canvas:node',
            ] as const
            for (const eventType of canvasEvents) {
              eventBus.on(eventType, (evt: { type: string; [key: string]: unknown }) => {
                try {
                  controller.enqueue(
                    encoder.encode(`event: ${evt.type}\ndata: ${JSON.stringify(evt)}\n\n`),
                  )
                } catch {
                  catchDebug(_err, 'server:canvas-router:163')
                  // Stream may have closed
                }
              })
            }
          }
        },
        cancel() {
          if (interval) clearInterval(interval)
        },
      })
      return new Response(stream, {
        status: 200,
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
          'Access-Control-Allow-Origin': '*',
        },
      })
    }

    // GET /api/canvas/observe?op=oracle|manifest → canvas_observe
    if (url.pathname === '/api/canvas/observe' && req.method === 'GET') {
      try {
        const op = url.searchParams.get('op') ?? 'oracle'
        return json({ ok: true, result: await cap('cap:canvas:observe', { op }) })
      } catch (e) {
        return appErrorResponse(e)
      }
    }

    // DELETE /api/canvas/instance/:id → canvas_dismiss
    const dismissMatch = url.pathname.match(/^\/api\/canvas\/instance\/([^/]+)$/)
    if (dismissMatch && req.method === 'DELETE') {
      try {
        return json({
          ok: true,
          result: await cap('cap:canvas:dismiss', { instanceId: dismissMatch[1] }),
        })
      } catch (e) {
        return appErrorResponse(e)
      }
    }

    // POST /api/canvas/instance/:id/mutate → canvas_mutate
    const mutateMatch = url.pathname.match(/^\/api\/canvas\/instance\/([^/]+)\/mutate$/)
    if (mutateMatch && req.method === 'POST') {
      try {
        const body = z.record(z.unknown()).parse(await req.json())
        return json({
          ok: true,
          result: await cap('cap:canvas:mutate', {
            instanceId: mutateMatch[1],
            regionId: body.regionId,
            state: body.state,
          }),
        })
      } catch (e) {
        return appErrorResponse(e)
      }
    }

    // GET /api/canvas/manifest → canvas_observe { op: 'manifest' }
    if (url.pathname === '/api/canvas/manifest' && req.method === 'GET') {
      try {
        return json({ ok: true, result: await cap('cap:canvas:observe', { op: 'manifest' }) })
      } catch (e) {
        return appErrorResponse(e)
      }
    }

    return errorResponse('Unknown canvas route', 'NotFound', 404)
  }
}
