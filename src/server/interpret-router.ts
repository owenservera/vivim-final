// src/server/interpret-router.ts
// POST /api/interpret — thin adapter that delegates to the canonical /api/nlcl/interpret
// handler. Audit finding A.2 fix: previously this router minted its OWN confirmation
// token (different from the one NLCLEngine minted), so confirmations never matched.
// Now it just wraps the engine result in the InterpretResponse discriminated union
// (already defined in src/schema/api-types.ts) — one envelope, one token, one shape.

import { z } from 'zod'
import type { NLCLEngine } from '../engines/nlcl/nlcl-engine.js'
import type { NLCContext } from '../engines/nlcl/types.js'
import type {
  InterpretBody,
  InterpretClarificationResponse,
  InterpretConfirmationResponse,
  InterpretErrorResponse,
  InterpretResponse,
  InterpretSuccessResponse,
} from '../schema/api-types.js'
import { errorResponse, json } from './response.js'
import { extractSource } from './source-middleware.js'

/**
 * Creates the /api/interpret router — now a thin adapter over `interpretViaEngine`
 * that wraps the engine's CommandResult into the canonical InterpretResponse union.
 * The response shape is IDENTICAL to /api/nlcl/interpret (audit A.2 fix).
 */
export function createInterpretRouter(nlclEngine: NLCLEngine) {
  return async function interpretRouter(req: Request): Promise<Response> {
    if (req.method !== 'POST') {
      return errorResponse('Method not allowed', 'MethodNotAllowed', 405)
    }

    const _source = extractSource(req)

    const bodySchema = z.object({
      text: z.string().min(1),
      ctx: z.object({
        conversationId: z.string().optional(),
        providerId: z.string().optional(),
        slaveId: z.string().optional(),
        userId: z.string().optional(),
        metadata: z.record(z.unknown()).optional(),
      }).optional(),
    })
    let body: z.infer<typeof bodySchema>
    try {
      const parsed = bodySchema.safeParse(await req.json())
      if (!parsed.success) return errorResponse(parsed.error.message, 'ValidationError', 400)
      body = parsed.data
    } catch {
      return errorResponse('Invalid JSON body', 'BadRequest', 400)
    }

    const start = Date.now()

    const nlclCtx: NLCContext = {
      conversationId: body.ctx?.conversationId,
      providerId: body.ctx?.providerId,
      slaveId: body.ctx?.slaveId,
      userId: body.ctx?.userId,
      metadata: body.ctx?.metadata ?? {},
      surface: 'frontend',
    }

    const result = await nlclEngine.interpret(body.text, nlclCtx)
    const response = wrapCommandResultAsInterpretResponse(result, Date.now() - start)
    return json(response)
  }
}

/**
 * Shared wrapper — used by both /api/interpret and /api/nlcl/interpret so the
 * response shape is guaranteed identical (audit A.2 fix: previously the two
 * routes returned different shapes with different field names).
 */
export function wrapCommandResultAsInterpretResponse(
  result: {
    ok: boolean
    intent: string
    output?: unknown
    text?: string
    error?: string
    latencyMs: number
    traceId: string
    requiresConfirmation?: boolean
    classification?: string
    capabilityId?: string
    confirmation?: { token: string; prompt: string }
    clarification?: { prompt: string; missing?: string[]; ambiguous?: string[]; options?: string[] }
  },
  latencyMs: number,
): InterpretResponse {
  // Confirmation — uses the engine-issued token directly (audit A.1 fix).
  if (result.requiresConfirmation && result.confirmation) {
    const response: InterpretConfirmationResponse = {
      ok: true,
      requiresConfirmation: true,
      confirmation: {
        token: result.confirmation.token,
        prompt: result.confirmation.prompt,
      },
      traceId: result.traceId,
      latencyMs,
    }
    return response
  }

  // Clarification
  if (result.clarification) {
    const response: InterpretClarificationResponse = {
      ok: false,
      clarification: result.clarification,
      traceId: result.traceId,
      latencyMs,
    }
    return response
  }

  // Error
  if (!result.ok) {
    const response: InterpretErrorResponse = {
      ok: false,
      error: result.error ?? 'Interpretation failed',
      traceId: result.traceId,
      latencyMs,
    }
    return response
  }

  // Success
  const response: InterpretSuccessResponse = {
    ok: true,
    capabilityId: result.capabilityId ?? 'unknown',
    output: result.output,
    text: result.text,
    traceId: result.traceId,
    latencyMs,
  }
  return response
}

/**
 * Creates minimal interpret router for standalone use.
 */
export function createInterpretRouterMinimal(deps: { nlclEngine: NLCLEngine }) {
  return createInterpretRouter(deps.nlclEngine)
}
