import type { NLCLEngine } from '../engines/nlcl/nlcl-engine.js'
import type { NLCContext } from '../engines/nlcl/types.js'
import type {
  InterpretClarificationResponse,
  InterpretConfirmationResponse,
  InterpretErrorResponse,
  InterpretSuccessResponse,
  InterpretBody,
} from '../schema/api-types.js'
import { errorResponse, json } from './response.js'
import { extractSource } from './source-middleware.js'

/**
 * Creates the /api/interpret router.
 * Binds context, runs resolver + parameter extraction + confirmation flow,
 * and returns either executed result or clarification/confirmation request.
 */
export function createInterpretRouter(nlclEngine: NLCLEngine) {
  return async function interpretRouter(req: Request): Promise<Response> {
    if (req.method !== 'POST') {
      return errorResponse('Method not allowed', 'MethodNotAllowed', 405)
    }

    const _source = extractSource(req)

    let body: InterpretBody
    try {
      const parsed = await req.json()
      body = parsed as InterpretBody
    } catch {
      return errorResponse('Invalid JSON body', 'BadRequest', 400)
    }

    if (!body?.text) {
      return errorResponse('Missing text field', 'BadRequest', 400)
    }

    const start = Date.now()

    // Build NLCContext directly from request body
    const nlclCtx: NLCContext = {
      conversationId: body.ctx?.conversationId,
      providerId: body.ctx?.providerId,
      slaveId: body.ctx?.slaveId,
      userId: body.ctx?.userId,
      metadata: body.ctx?.metadata ?? {},
      surface: 'frontend',
    }

    // Interpret through NLCL engine
    const result = await nlclEngine.interpret(body.text, nlclCtx)

    // Handle confirmation flow (25.6)
    if (result.requiresConfirmation) {
      const token = generateConfirmationToken()
      const response: InterpretConfirmationResponse = {
        ok: true,
        requiresConfirmation: true,
        confirmation: {
          token,
          prompt: `Confirm: ${result.text ?? 'This action requires confirmation'}`,
        },
        traceId: result.traceId,
        latencyMs: Date.now() - start,
      }
      return json(response)
    }

    // Handle clarification / missing parameters
    if (result.clarification || result.error?.includes('Missing required')) {
      if (result.clarification) {
        const response: InterpretClarificationResponse = {
          ok: false,
          clarification: result.clarification,
          traceId: result.traceId,
          latencyMs: Date.now() - start,
        }
        return json(response)
      }
      const response: InterpretErrorResponse = {
        ok: false,
        error: result.error ?? 'Missing required parameters',
        traceId: result.traceId,
        latencyMs: Date.now() - start,
      }
      return json(response)
    }

    // Normal response
    const response: InterpretSuccessResponse = {
      ok: result.ok,
      capabilityId: result.capabilityId ?? 'unknown',
      output: result.output,
      text: result.text,
      traceId: result.traceId,
      latencyMs: Date.now() - start,
    }
    return json(response)
  }
}

function generateConfirmationToken(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

/**
 * Creates minimal interpret router for standalone use.
 */
export function createInterpretRouterMinimal(deps: { nlclEngine: NLCLEngine }) {
  return createInterpretRouter(deps.nlclEngine)
}
