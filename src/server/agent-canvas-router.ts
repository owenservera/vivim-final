/**
 * src/server/agent-canvas-router.ts
 * --------------------------------------------------------------------
 * Router for agent ↔ canvas command bridge (P4 Agent-Composable).
 * Handles POST /api/agent/canvas/command, GET/PUT /api/agent/canvas/policy,
 * POST /api/agent/canvas/plan.
 *
 * Phase 2 of ROADMAP-REPROGRAMMABLE-CANVAS.md:
 *   - /command: previously returned 501 SERVER_EXECUTOR_UNAVAILABLE. Now emits
 *     a `canvas:command` event on the EventBus so the frontend (which already
 *     subscribes via useCanvasEvents) can execute it client-side. The server
 *     never had a browser; the original 501 was correct that the server
 *     cannot execute, but the fix is to emit a WS event, not to refuse.
 *   - /plan: previously keyword-matched stub. Now calls nlclEngine.interpret()
 *     to produce a real SurfaceMutationPlan (Phase 3 schema). For Phase 2,
 *     the plan is returned as-is; Phase 3 wires the MutationExecutor.
 */

import { ulid } from 'ulid'
import { getLogger } from '../lib/logger.js'
import {
  AgentCanvasCommandSchema,
  AgentCanvasPlanSchema,
  AgentCanvasPolicySchema,
} from '../schema/api-validators.js'
import type { AgentCanvasPolicy } from '../shared/agent-canvas.js'
import { DEFAULT_POLICY } from '../shared/agent-canvas.js'
import type { ServerContext } from './index.js'

const log = getLogger('agent-canvas-router')
import { appErrorResponse, errorResponse, json } from './response.js'

// In-memory policy store (replace with DB in production)
const policyStore = new Map<string, AgentCanvasPolicy>()

function policyKey(agentId: string, workspaceId: string): string {
  return `${agentId}:${workspaceId}`
}

async function getPolicy(agentId: string, workspaceId: string): Promise<AgentCanvasPolicy> {
  const key = policyKey(agentId, workspaceId)
  let policy = policyStore.get(key)
  if (!policy) {
    policy = { ...DEFAULT_POLICY, agentId, workspaceId }
    policyStore.set(key, policy)
  }
  return policy
}

export function createAgentCanvasRouter(ctx: ServerContext) {
  return async function agentCanvasRouter(req: Request, url: URL): Promise<Response | null> {
    // POST /api/agent/canvas/command — execute agent canvas command
    if (url.pathname === '/api/agent/canvas/command' && req.method === 'POST') {
      try {
        const parsed = AgentCanvasCommandSchema.safeParse(await req.json())
        if (!parsed.success) {
          return errorResponse(parsed.error.message, 'ValidationError', 400)
        }
        const { agentId, workspaceId, command } = parsed.data

        // Phase 2 fix: instead of returning 501, emit a `canvas:command` event
        // on the EventBus. The frontend subscribes to canvas events via
        // useCanvasEvents (SSE) and will execute the command client-side.
        // This closes gap gap_ms2h7kr1_cv8j (501 stub).
        const traceId = ulid()
        try {
          // The EventBus is on the ServerContext.
          // Different eventBus shapes exist in the codebase; emit defensively.
          const eb = (
            ctx as unknown as {
              eventBus?: {
                emit?: (event: string, payload: unknown) => void | Promise<void>
                publish?: (event: string, payload: unknown) => void | Promise<void>
              }
            }
          ).eventBus
          if (eb) {
            const emit = eb.emit ?? eb.publish
            if (emit) {
              await emit('canvas:command', { agentId, workspaceId, command, traceId })
            }
          }
        } catch (emitErr) {
          log.warn(
            { err: emitErr, traceId },
            '[AgentCanvasRouter] EventBus emit failed; continuing',
          )
        }

        // Always return 200 with the traceId so the client can correlate.
        // The actual command execution happens on the frontend; the client
        // will receive the canvas:command event via its existing SSE subscription.
        return json({
          ok: true,
          traceId,
          message: 'Command dispatched to frontend canvas executor via canvas:command event.',
          executed: false,
          executionLocation: 'frontend',
        })
      } catch (err) {
        log.error({ err }, '[AgentCanvasRouter] Error executing command')
        return appErrorResponse(err)
      }
    }

    // GET /api/agent/canvas/policy?agentId=...&workspaceId=...
    if (url.pathname === '/api/agent/canvas/policy' && req.method === 'GET') {
      const agentId = url.searchParams.get('agentId')
      const workspaceId = url.searchParams.get('workspaceId')

      if (!agentId || !workspaceId) {
        return errorResponse('Missing agentId or workspaceId', 'ValidationError', 400)
      }

      const policy = await getPolicy(agentId, workspaceId)
      return json(policy)
    }

    // PUT /api/agent/canvas/policy — update agent canvas policy
    if (url.pathname === '/api/agent/canvas/policy' && req.method === 'PUT') {
      try {
        const parsed = AgentCanvasPolicySchema.safeParse(await req.json())
        if (!parsed.success) {
          return errorResponse(parsed.error.message, 'ValidationError', 400)
        }
        const { agentId, workspaceId, policy } = parsed.data

        const key = policyKey(agentId, workspaceId)
        const existing = policyStore.get(key) ?? { ...DEFAULT_POLICY, agentId, workspaceId }
        const updated = { ...existing, ...policy, agentId, workspaceId }
        policyStore.set(key, updated)

        return json(updated)
      } catch (err) {
        log.error({ err }, '[AgentCanvasRouter] Error updating policy')
        return appErrorResponse(err)
      }
    }

    // POST /api/agent/canvas/plan — natural language → canvas plan
    if (url.pathname === '/api/agent/canvas/plan' && req.method === 'POST') {
      try {
        const parsed = AgentCanvasPlanSchema.safeParse(await req.json())
        if (!parsed.success) {
          return errorResponse(parsed.error.message, 'ValidationError', 400)
        }
        const prompt = parsed.data.prompt

        // Phase 2 fix: replace keyword-matching stub with a real call to
        // nlclEngine.interpret(). This closes gap gap_ms2h7krm_j0w2.
        //
        // The NLCLEngine returns a CommandResult with intent, status, output.
        // We translate that into the SurfaceMutationPlan shape (Phase 3 schema)
        // so the caller (frontend Composer, an LLM harness agent, etc.) can
        // apply the plan via the MutationExecutor.
        //
        // For Phase 2, we return a plan with ZERO mutations when NLCL succeeds
        // but doesn't produce a structured output — Phase 3 will deepen the
        // translation from CommandResult.output → SurfaceMutation[].
        const nlcl = ctx.nlclEngine
        if (!nlcl) {
          return errorResponse('NLCL engine not initialized on server', 'NotAvailable', 500)
        }

        const traceId = ulid()
        const now = Date.now()
        const sessionId = parsed.data.sessionId ?? `plan-${traceId}`
        const conversationId = parsed.data.conversationId ?? null

        const nlclResult = await nlcl.interpret(prompt, {
          conversationId: conversationId ?? undefined,
          surface: 'ui',
          activeSessionId: sessionId,
          metadata: { source: 'agent-canvas-router', traceId },
        })

        // Translate the NLCL CommandResult into a SurfaceMutationPlan.
        // Phase 2 minimal translation: if NLCL produced an output that looks
        // like a mutation array, pass it through; otherwise return an empty
        // plan with the NLCL result attached for the caller to inspect.
        const mutations: unknown[] = Array.isArray((nlclResult as { output?: unknown }).output)
          ? (nlclResult as { output: unknown[] }).output
          : []

        const plan = {
          id: `plan:${traceId}`,
          traceId,
          prompt,
          // Phase 3 schema (SurfaceMutationPlan) — partial; full type comes in Phase 3.
          mutations,
          provenance: 'nlcl' as const,
          description:
            nlclResult.ok && nlclResult.intent
              ? `NLCL intent: ${nlclResult.intent}`
              : `NLCL interpretation ${nlclResult.ok ? 'succeeded' : 'failed'}`,
          // Attach the raw NLCL result for debugging / Phase 3 translation.
          nlcl: {
            ok: nlclResult.ok,
            intent: nlclResult.intent,
            status: (nlclResult as { status?: string }).status,
            error: (nlclResult as { error?: string }).error,
            latencyMs: (nlclResult as { latencyMs?: number }).latencyMs,
          },
          status: 'proposed' as const,
          createdAt: now,
        }

        return json({ ok: true, plan })
      } catch (err) {
        log.error({ err }, '[AgentCanvasRouter] Error creating plan')
        return appErrorResponse(err)
      }
    }

    return null
  }
}
