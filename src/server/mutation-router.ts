// src/server/mutation-router.ts
// Phase 3 of ROADMAP-REPROGRAMMABLE-CANVAS.md — The Mutation DSL.
//
// HTTP routes for the MutationExecutor:
//   POST   /api/mutation/apply    — apply a single mutation or a plan
//   POST   /api/mutation/preview  — dry-run a plan, return diff
//   GET    /api/mutation/history  — recent mutations (most recent first)
//   POST   /api/mutation/undo     — undo the most recent mutation
//   POST   /api/mutation/redo     — redo the most recently undone mutation
//   GET    /api/mutation/status   — canUndo, canRedo, history length
//
// The router uses the singleton mutationExecutor from
// src/reprogrammability/dsl/executor.ts. All requests are validated with
// Zod before reaching the executor.
//
// CONTRACT_VERSION: 1

import { z } from 'zod'
import { getLogger } from '../lib/logger.js'
import { UnsupportedMutationError } from '../reprogrammability/contract.js'
import { mutationExecutor } from '../reprogrammability/dsl/executor.js'
import { DslParseError, parseMutation, parseMutationList } from '../reprogrammability/dsl/parser.js'
import {
  SurfaceMutationPlanSchema,
  SurfaceMutationSchema,
} from '../reprogrammability/mutation-schema.js'
import { SurfaceNotFoundError } from '../reprogrammability/registry.js'
import { errorResponse, json } from './response.js'

const log = getLogger('mutation-router')

const ApplyInputSchema = z.union([
  z.object({
    plan: SurfaceMutationPlanSchema,
  }),
  z.object({
    mutation: SurfaceMutationSchema,
  }),
  z.object({
    dsl: z.string().min(1),
  }),
  z.object({
    dslList: z.string().min(1),
  }),
])

const PreviewInputSchema = z.union([
  z.object({ plan: SurfaceMutationPlanSchema }),
  z.object({ dsl: z.string().min(1) }),
  z.object({ dslList: z.string().min(1) }),
])

export function createMutationRouter() {
  return async function mutationRouter(req: Request, url: URL): Promise<Response | null> {
    // POST /api/mutation/apply
    if (url.pathname === '/api/mutation/apply' && req.method === 'POST') {
      let body: unknown
      try {
        body = await req.json()
      } catch {
        return errorResponse('Invalid JSON body', 'VALIDATION_ERROR', 400)
      }

      const parsed = ApplyInputSchema.safeParse(body)
      if (!parsed.success) {
        return errorResponse(
          `Invalid input: ${parsed.error.issues.map((i) => i.message).join('; ')}`,
          'VALIDATION_ERROR',
          400,
        )
      }

      try {
        const input = parsed.data
        if ('plan' in input) {
          const result = await mutationExecutor.applyPlan(input.plan)
          return json({ ok: result.ok, result })
        }
        if ('mutation' in input) {
          const record = await mutationExecutor.apply(input.mutation)
          return json({ ok: record.ok, record })
        }
        if ('dsl' in input) {
          const mutation = parseMutation(input.dsl)
          const record = await mutationExecutor.apply(mutation)
          return json({ ok: record.ok, record })
        }
        if ('dslList' in input) {
          const mutations = parseMutationList(input.dslList)
          const records = []
          for (const m of mutations) {
            const r = await mutationExecutor.apply(m)
            records.push(r)
            if (!r.ok) break
          }
          return json({ ok: records.every((r) => r.ok), records })
        }
        // Unreachable — Zod union exhaustively matched above.
        return errorResponse('Unreachable', 'INTERNAL_ERROR', 500)
      } catch (err) {
        return handleExecutorError(err)
      }
    }

    // POST /api/mutation/preview
    if (url.pathname === '/api/mutation/preview' && req.method === 'POST') {
      let body: unknown
      try {
        body = await req.json()
      } catch {
        return errorResponse('Invalid JSON body', 'VALIDATION_ERROR', 400)
      }

      const parsed = PreviewInputSchema.safeParse(body)
      if (!parsed.success) {
        return errorResponse(
          `Invalid input: ${parsed.error.issues.map((i) => i.message).join('; ')}`,
          'VALIDATION_ERROR',
          400,
        )
      }

      try {
        const input = parsed.data
        let plan
        if ('plan' in input) plan = input.plan
        else if ('dsl' in input) {
          const m = parseMutation(input.dsl)
          plan = {
            id: `preview-${Date.now()}`,
            mutations: [m],
            provenance: m.provenance,
          }
        } else if ('dslList' in input) {
          const mutations = parseMutationList(input.dslList)
          plan = {
            id: `preview-${Date.now()}`,
            mutations,
            provenance: mutations[0]?.provenance ?? 'manual',
          }
        } else {
          return errorResponse('Unreachable', 'INTERNAL_ERROR', 500)
        }

        const preview = await mutationExecutor.previewPlan(plan)
        return json({ ok: true, preview })
      } catch (err) {
        return handleExecutorError(err)
      }
    }

    // GET /api/mutation/history
    if (url.pathname === '/api/mutation/history' && req.method === 'GET') {
      const limitParam = url.searchParams.get('limit')
      const limit = limitParam
        ? Math.min(100, Math.max(1, Number.parseInt(limitParam, 10) || 50))
        : 50
      const history = mutationExecutor.history(limit)
      return json({ ok: true, history, count: history.length })
    }

    // GET /api/mutation/status
    if (url.pathname === '/api/mutation/status' && req.method === 'GET') {
      return json({
        ok: true,
        canUndo: mutationExecutor.canUndo(),
        canRedo: mutationExecutor.canRedo(),
        historyLength: mutationExecutor.history(1000).length,
      })
    }

    // POST /api/mutation/undo
    if (url.pathname === '/api/mutation/undo' && req.method === 'POST') {
      try {
        const record = await mutationExecutor.undo()
        if (!record) {
          return json({ ok: false, error: 'Nothing to undo' }, 400)
        }
        return json({ ok: true, record })
      } catch (err) {
        return handleExecutorError(err)
      }
    }

    // POST /api/mutation/redo
    if (url.pathname === '/api/mutation/redo' && req.method === 'POST') {
      try {
        const record = await mutationExecutor.redo()
        if (!record) {
          return json({ ok: false, error: 'Nothing to redo' }, 400)
        }
        return json({ ok: true, record })
      } catch (err) {
        return handleExecutorError(err)
      }
    }

    return null
  }
}

function handleExecutorError(err: unknown): Response {
  if (err instanceof DslParseError) {
    return errorResponse(`DSL parse error: ${err.message}`, 'DSL_PARSE_ERROR', 400)
  }
  if (err instanceof SurfaceNotFoundError) {
    return errorResponse(err.message, 'SURFACE_NOT_FOUND', 404)
  }
  if (err instanceof UnsupportedMutationError) {
    return errorResponse(err.message, 'UNSUPPORTED_MUTATION', 422)
  }
  log.error({ err }, '[mutation-router] unexpected error')
  return errorResponse(
    err instanceof Error ? err.message : 'Internal server error',
    'INTERNAL_ERROR',
    500,
  )
}
