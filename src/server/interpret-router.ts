import type { NLCLEngine } from '../engines/nlcl/nlcl-engine.js'
import type { NLCContext } from '../engines/nlcl/types.js'
import { errorResponse, json } from './response.js'
import { extractSource } from './source-middleware.js'

export interface InterpretBody {
  text: string
  ctx?: {
    conversationId?: string
    providerId?: string
    slaveId?: string
    userId?: string
    metadata?: Record<string, unknown>
    conversationState?: Record<string, unknown>
    canvasState?: Record<string, unknown>
    activeSessionId?: string
  }
}

export interface InterpretResponse {
  ok: boolean
  capabilityId?: string
  output?: unknown
  text?: string
  error?: string
  traceId: string
  latencyMs: number
  requiresConfirmation?: boolean
  confirmation?: { token: string; prompt: string }
  clarification?: {
    prompt: string
    missing?: string[]
    ambiguous?: string[]
    options?: string[]
  }
}

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
      return json({
        ok: true,
        requiresConfirmation: true,
        confirmation: {
          token,
          prompt: `Confirm: ${result.text ?? 'This action requires confirmation'}`,
        },
        traceId: result.traceId,
        latencyMs: Date.now() - start,
      })
    }

    // Handle clarification / missing parameters
    if (result.clarification || result.error?.includes('Missing required')) {
      return json({
        ok: false,
        clarification: result.clarification ?? {
          prompt: `Missing parameters for: ${result.intent}`,
          missing: result.error ? [result.error] : [],
        },
        traceId: result.traceId,
        latencyMs: Date.now() - start,
      })
    }

    // Normal response
    return json({
      ok: result.ok,
      capabilityId: result.capabilityId,
      output: result.output,
      text: result.text,
      error: result.error,
      traceId: result.traceId,
      latencyMs: Date.now() - start,
      requiresConfirmation: result.requiresConfirmation,
      confirmation: result.confirmation,
      clarification: result.clarification,
    } as InterpretResponse)
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
