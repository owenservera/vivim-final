// src/server/capability-router.ts
// Unit 24.1 (universal execute route) + 24.2 (introspection route)
// The single execution transport for every capability across all surfaces.
// Mounted in createServerWithEngines after the auth gate.
//
// PRINCIPLE: FRONTEND = BACKEND
// Every request is tagged with its source via X-Source header for audit logging.

import type { CapabilityContext, UnifiedCapability } from '../engines/unified-registry.js'
import type { ServerContext } from './index.js'
import { errorResponse, json } from './response.js'
import { extractSource } from './source-middleware.js'

function toDetail(cap: UnifiedCapability): Record<string, unknown> {
  return {
    id: cap.id,
    slug: cap.slug,
    name: cap.name,
    description: cap.description,
    category: cap.category,
    surfaces: cap.surfaces,
    inputSchema: cap.inputSchema,
    outputSchema: cap.outputSchema,
    cliCommand: cap.cliCommand,
    ui: cap.ui,
    uiAction: cap.uiAction,
    apiEndpoint: cap.apiEndpoint,
    workflowNodeType: cap.workflowNodeType,
    mcpToolName: cap.mcpToolName,
    requiresConfirmation: cap.requiresConfirmation,
    tags: cap.tags,
  }
}

export function createCapabilityRouter(ctx: ServerContext) {
  return async function capabilityRouter(req: Request, url: URL): Promise<Response> {
    const registry = ctx.registry
    const source = extractSource(req)
    if (!registry) {
      return errorResponse('Capability registry not available', 'NotAvailable', 503)
    }

    // 24.2 — GET /api/capabilities?<surface>&<category>&<tag>
    if (req.method === 'GET' && url.pathname === '/api/capabilities') {
      const surface = (url.searchParams.get('surface') as any) ?? undefined
      const category = url.searchParams.get('category') ?? undefined
      const tag = url.searchParams.get('tag') ?? undefined
      const caps = registry.list({ surface, category, tag })
      return json(caps.map(toDetail))
    }

    // 24.1 — POST /api/capabilities/:id/execute (slug alias resolves same handler)
    const execMatch = url.pathname.match(/^\/api\/capabilities\/([^/]+)\/execute$/)
    if (req.method === 'POST' && execMatch) {
      const id = decodeURIComponent(execMatch[1] ?? '')
      const cap = registry.get(id) ?? registry.getBySlug(id)
      if (!cap) {
        return errorResponse(`Capability ${id} not found`, 'NotFound', 404)
      }

      let body: { input?: Record<string, unknown>; ctx?: Partial<CapabilityContext> } = {}
      try {
        const parsed = await req.json()
        if (parsed && typeof parsed === 'object') {
          body = parsed as typeof body
        }
      } catch {
        body = {}
      }
      const input = (body.input ?? {}) as Record<string, unknown>

      const required = (cap.inputSchema.required as string[] | undefined) ?? []
      for (const key of required) {
        if (!(key in input)) {
          return errorResponse(`Missing required input: ${key}`, 'ValidationError', 400)
        }
      }

      const capCtx: CapabilityContext = {
        conversationId: body.ctx?.conversationId,
        providerId: body.ctx?.providerId,
        slaveId: body.ctx?.slaveId,
        userId: body.ctx?.userId,
        metadata: (body.ctx?.metadata as Record<string, unknown>) ?? {},
      }

      try {
        const start = Date.now()
        const output = await registry.execute(cap.id, input, capCtx)
        const latencyMs = Date.now() - start
        ctx.eventBus?.emit({
          type: 'capability:executed',
          capabilityId: cap.id,
          latencyMs,
        } as any)
        return json({
          ok: true,
          capabilityId: cap.id,
          output,
          traceId: globalThis.crypto?.randomUUID?.() ?? 'n/a',
          latencyMs,
        })
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        const isValidation = message.startsWith('Missing required input')
        return errorResponse(message, 'ExecutionError', isValidation ? 400 : 500)
      }
    }

    // 24.2 — GET /api/capabilities/:id (single detail)
    const detailMatch = url.pathname.match(/^\/api\/capabilities\/([^/]+)$/)
    if (req.method === 'GET' && detailMatch) {
      const id = decodeURIComponent(detailMatch[1] ?? '')
      const cap = registry.get(id) ?? registry.getBySlug(id)
      if (!cap) {
        return errorResponse(`Capability ${id} not found`, 'NotFound', 404)
      }
      return json(toDetail(cap))
    }

    return errorResponse('Not found', 'NotFound', 404)
  }
}
