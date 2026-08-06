// src/server/capability-router.ts
// Unit 24.1 (universal execute route) + 24.2 (introspection route)
// The single execution transport for every capability across all surfaces.
// Mounted in createServerWithEngines after the auth gate.
//
// PRINCIPLE: FRONTEND = BACKEND
// Every request is tagged with its source via X-Source header for audit logging.
//
// Work Items 01/03/05: Added Zod validation for request bodies, consistent error
// codes, and traceId propagation aligned with api-types.ts contract.

import type { z } from 'zod'
import type { CapabilityContext, UnifiedCapability } from '../engines/unified-registry.js'
import type {
  CapabilityDetail,
  CapabilityExecuteResponse,
  CapabilityListResponse,
} from '../schema/api-types.js'
import { CapabilityExecuteBodySchema } from '../schema/api-validators.js'
import { AppError } from './errors.js'
import type { ServerContext } from './index.js'
import { appErrorResponse, errorResponse, json } from './response.js'
import { extractSource } from './source-middleware.js'

function toDetail(cap: UnifiedCapability): CapabilityDetail {
  return {
    id: cap.id,
    slug: cap.slug,
    name: cap.name,
    description: cap.description ?? null,
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
    requiresConfirmation: cap.requiresConfirmation ?? false,
    tags: cap.tags,
  }
}

export function createCapabilityRouter(ctx: ServerContext) {
  return async function capabilityRouter(req: Request, url: URL): Promise<Response> {
    const registry = ctx.registry
    const _source = extractSource(req)
    if (!registry) {
      return errorResponse('Capability registry not available', 'NotAvailable', 503)
    }

    // 24.2 — GET /api/capabilities?<surface>&<category>&<tag>
    if (req.method === 'GET' && url.pathname === '/api/capabilities') {
      const surface =
        (url.searchParams.get('surface') as
          | import('../engines/unified-registry.js').CapabilitySurface
          | null) ?? undefined
      const category = url.searchParams.get('category') ?? undefined
      const tag = url.searchParams.get('tag') ?? undefined
      const caps = registry.list({ surface, category, tag })
      const response: CapabilityListResponse = {
        capabilities: caps.map(toDetail),
        total: caps.length,
      }
      return json(response)
    }

    // 24.1 — POST /api/capabilities/:id/execute (slug alias resolves same handler)
    const execMatch = url.pathname.match(/^\/api\/capabilities\/([^/]+)\/execute$/)
    if (req.method === 'POST' && execMatch) {
      const id = decodeURIComponent(execMatch[1] ?? '')
      const cap = (await registry.getBySlugAsync(id)) ?? registry.get(id)
      if (!cap) {
        return errorResponse(`Capability ${id} not found`, 'NotFound', 404)
      }

      // Work Item 05: Zod-validated request body parsing
      let body: z.infer<typeof CapabilityExecuteBodySchema>
      try {
        const raw = await req.json()
        const parsed = CapabilityExecuteBodySchema.safeParse(raw)
        if (!parsed.success) {
          return errorResponse(parsed.error.message, 'ValidationError', 400)
        }
        body = parsed.data
      } catch {
        body = {}
      }

      const input = body.input ?? {}

      const required = (cap.inputSchema?.required as string[] | undefined) ?? []
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
        metadata: body.ctx?.metadata ?? {},
      }

      try {
        const start = Date.now()
        const output = await registry.execute(cap.id, input, capCtx)
        const latencyMs = Date.now() - start
        const traceId = globalThis.crypto?.randomUUID?.() ?? 'n/a'
        ctx.eventBus?.emit({
          type: 'capability:executed',
          capabilityId: cap.id,
          providerId: (cap as { providerId?: string }).providerId ?? 'local',
          traceId,
          ok: true,
          latencyMs,
        })
        const response: CapabilityExecuteResponse = {
          ok: true,
          capabilityId: cap.id,
          output,
          traceId,
          latencyMs,
        }
        return json(response)
      } catch (err) {
        return appErrorResponse(AppError.from(err, 'ExecutionError'))
      }
    }

    // 24.2 — GET /api/capabilities/:id (single detail)
    const detailMatch = url.pathname.match(/^\/api\/capabilities\/([^/]+)$/)
    if (req.method === 'GET' && detailMatch) {
      const id = decodeURIComponent(detailMatch[1] ?? '')
      const cap = (await registry.getBySlugAsync(id)) ?? registry.get(id)
      if (!cap) {
        return errorResponse(`Capability ${id} not found`, 'NotFound', 404)
      }
      return json(toDetail(cap))
    }

    return errorResponse('Not found', 'NotFound', 404)
  }
}
