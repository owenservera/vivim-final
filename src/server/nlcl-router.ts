// src/server/nlcl-router.ts
// NLCL REST API surface — exposes the Natural Language Command Layer via HTTP.
// POST /api/nlcl/interpret — interpret + execute a natural language command
// GET  /api/nlcl/commands — list all available commands
// GET  /api/nlcl/help — get help text
// GET  /api/nlcl/audit — get audit log

import type { NLCLEngine } from '../engines/nlcl/nlcl-engine.js'
import type { NLCContext } from '../engines/nlcl/types.js'
import { json, errorResponse } from './response.js'

export function createNLCLRouter(engine: NLCLEngine) {
  return async function nlclRouter(req: Request): Promise<Response> {
    const url = new URL(req.url)
    const path = url.pathname.replace('/api/nlcl/', '')

    switch (path) {
      case 'interpret': {
        if (req.method !== 'POST') {
          return errorResponse('Method not allowed', 'MethodNotAllowed', 405)
        }
        try {
          const body = (await req.json()) as {
            input?: string
            surface?: string
            providerId?: string
            conversationId?: string
            workspacePath?: string
          }
          const rawInput = body.input?.trim()
          if (!rawInput) {
            return errorResponse('Missing "input" field', 'ValidationError', 400)
          }

          const ctx: NLCContext = {
            surface: (body.surface as NLCContext['surface']) ?? 'api',
            providerId: body.providerId,
            conversationId: body.conversationId,
            workspacePath: body.workspacePath,
            metadata: {},
          }

          const result = await engine.interpret(rawInput, ctx)
          return json(result)
        } catch (err) {
          return errorResponse(
            err instanceof Error ? err.message : 'Interpretation failed',
            'NLCLError',
            500,
          )
        }
      }

      case 'commands': {
        const category = url.searchParams.get('category') ?? undefined
        const commands = engine.listCommands({ category })
        return json({
          commands: commands.map((c) => ({
            id: c.id,
            intent: c.intent,
            description: c.description,
            category: c.category,
            examples: c.examples,
            aliases: c.aliases,
            executor: c.executor,
          })),
          total: commands.length,
        })
      }

      case 'help': {
        const help = engine.getHelp()
        return json(help)
      }

      case 'audit': {
        const limit = parseInt(url.searchParams.get('limit') ?? '50')
        const log = engine.getAuditLog(limit)
        return json({ entries: log, count: log.length })
      }

      case 'parse': {
        if (req.method !== 'POST') {
          return errorResponse('Method not allowed', 'MethodNotAllowed', 405)
        }
        try {
          const body = (await req.json()) as { input?: string }
          const rawInput = body.input?.trim()
          if (!rawInput) {
            return errorResponse('Missing "input" field', 'ValidationError', 400)
          }
          const ctx: NLCContext = { surface: 'api', metadata: {} }
          const result = await engine.interpret(rawInput, ctx)
          return json({
            ok: result.ok,
            intent: result.intent,
            text: result.text,
            output: result.output,
            error: result.error,
            latencyMs: result.latencyMs,
          })
        } catch (err) {
          return errorResponse(
            err instanceof Error ? err.message : 'Parse failed',
            'NLCLError',
            500,
          )
        }
      }

      default:
        return errorResponse(`Unknown NLCL endpoint: ${path}`, 'NotFound', 404)
    }
  }
}
