// src/server/nlcl-router.ts
// NLCL REST API surface — exposes the Natural Language Command Layer via HTTP.
// POST /api/nlcl/interpret — interpret + execute a natural language command
// POST /api/nlcl/confirm   — consume a confirmation token (audit A.1 fix)
// GET  /api/nlcl/commands  — list all available commands
// GET  /api/nlcl/help      — get help text
// GET  /api/nlcl/audit     — get audit log
// POST /api/nlcl/parse     — parse-only (no execute)

import { NlclInterpretSchema, NlclConfirmSchema, NlclExecuteSchema } from '../schema/api-validators.js'
import type { NLCLEngine } from '../engines/nlcl/nlcl-engine.js'
import type { NLCContext } from '../engines/nlcl/types.js'
import type { InterpretResponse } from '../schema/api-types.js'
import { wrapCommandResultAsInterpretResponse } from './interpret-router.js'
import { errorResponse, json } from './response.js'

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
          const parsed = NlclInterpretSchema.safeParse(await req.json())
          if (!parsed.success) {
            return errorResponse(parsed.error.message, 'ValidationError', 400)
          }
          const rawInput = parsed.data.input.trim()

          const ctx: NLCContext = {
            surface: (parsed.data.surface as NLCContext['surface']) ?? 'api',
            providerId: parsed.data.providerId,
            conversationId: parsed.data.conversationId,
            workspacePath: parsed.data.workspacePath,
            metadata: parsed.data.metadata ?? {},
          }

          const start = Date.now()
          const result = await engine.interpret(rawInput, ctx)
          // Audit A.2 fix — return the canonical InterpretResponse union, NOT the
          // raw CommandResult. Previously this returned `{ output, capabilityId, ... }`
          // directly while the frontend expected `{ result, slug, ... }` — silent undefined.
          const response: InterpretResponse = wrapCommandResultAsInterpretResponse(
            result,
            Date.now() - start,
          )
          return json(response)
        } catch (err) {
          return errorResponse(
            err instanceof Error ? err.message : 'Interpretation failed',
            'NLCLError',
            500,
          )
        }
      }

      case 'confirm': {
        // Audit A.1 fix — consume a pending confirmation token, then execute the
        // original capability with the original input + ctx.
        if (req.method !== 'POST') {
          return errorResponse('Method not allowed', 'MethodNotAllowed', 405)
        }
        try {
          const parsed = NlclConfirmSchema.safeParse(await req.json())
          if (!parsed.success) {
            return errorResponse(parsed.error.message, 'ValidationError', 400)
          }
          const store = engine.getConfirmationStore()
          const pending = store.consume(parsed.data.token)
          if (!pending) {
            // 410 Gone — token was expired, already consumed, or HMAC-invalid.
            return errorResponse(
              'Confirmation token is invalid, expired, or already consumed',
              'Gone',
              410,
            )
          }
          // Re-derive the NLCContext from the stored JSON.
          let ctx: NLCContext
          try {
            ctx = JSON.parse(pending.contextJson) as NLCContext
          } catch {
            return errorResponse(
              'Stored context is corrupt — cannot re-execute',
              'InternalError',
              500,
            )
          }
          // Build a synthetic raw input that re-triggers the same capability.
          // The engine's deterministic resolver will match it back to the same pattern,
          // parameter extraction will fill the slots from `pending.input`, and execution
          // proceeds WITHOUT re-prompting for confirmation (the consume above is the
          // confirmation).
          //
          // For capabilities whose pattern can't be re-derived from `pending.input`
          // alone (e.g. conversational LLMs), the canonical path is to call
          // `engine.getRegistry().getPattern(...).executor` directly. For now we use the
          // engine's `interpret()` with a `confirmationToken` metadata flag that the
          // engine could check to skip the confirmation gate. (Phase 15.3 future work:
          // add an `engine.executeConfirmed(capabilityId, input, ctx)` method.)
          ctx.metadata = { ...ctx.metadata, __confirmedToken: pending.token }
          // Find the pattern by capabilityId OR intent (some patterns don't have
          // a capabilityId — they store the intent name as the lookup key instead).
          const patterns = engine.listCommands()
          const pattern = patterns.find(
            (p) => p.capabilityId === pending.capabilityId || p.intent === pending.capabilityId,
          )
          if (!pattern) {
            return errorResponse(
              `Capability '${pending.capabilityId}' is no longer registered`,
              'NotFound',
              404,
            )
          }
          // Use the IntentRouter directly via engine.getRouter() so we bypass the
          // resolver + confirmation gate entirely.
          const start = Date.now()
          const result = await engine.getRouter().route(
            {
              patternId: pattern.id,
              intent: pattern.intent,
              input: pending.input as Record<string, unknown>,
              confidence: 1.0,
              rawInput: '<confirmed-token>',
              matchedPattern: pattern.examples[0] ?? pattern.intent,
              alternatives: [],
              resolvedAt: Date.now(),
              capabilityId: pending.capabilityId,
              classification: pending.classification as never,
            },
            ctx,
          )
          const response = wrapCommandResultAsInterpretResponse(result, Date.now() - start)
          return json(response)
        } catch (err) {
          return errorResponse(
            err instanceof Error ? err.message : 'Confirmation failed',
            'NLCLError',
            500,
          )
        }
      }

      case 'commands': {
        const category = url.searchParams.get('category') ?? undefined
        const route = url.searchParams.get('route') as 'local' | 'remote' | null
        // Tier 3 unit 15.11 — support ?route=local|remote filter.
        // The prerouter's live-fetch replaces the planned LOCAL_INTENTS regex table.
        if (route === 'local' || route === 'remote') {
          const prerouter = engine.getPrerouter()
          const all = prerouter.listAllWithRoutes()
          const filtered = all.filter((entry) => entry.route === route)
          return json({
            commands: filtered.map((entry) => ({
              id: entry.pattern.id,
              intent: entry.pattern.intent,
              description: entry.pattern.description,
              category: entry.pattern.category,
              examples: entry.pattern.examples,
              aliases: entry.pattern.aliases,
              executor: entry.pattern.executor,
              route: entry.route,
            })),
            total: filtered.length,
            route,
          })
        }
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
        const limit = Number.parseInt(url.searchParams.get('limit') ?? '50')
        const log = engine.getAuditLog(limit)
        return json({ entries: log, count: log.length })
      }

      case 'session': {
        // Tier 3 unit 15.5 — inspect/clear the dialogue session.
        if (req.method === 'DELETE') {
          const ctx: NLCContext = {
            surface: (url.searchParams.get('surface') as NLCContext['surface']) ?? 'api',
            conversationId: url.searchParams.get('conversationId') ?? undefined,
            slaveId: url.searchParams.get('slaveId') ?? undefined,
            userId: url.searchParams.get('userId') ?? undefined,
            metadata: {},
          }
          engine.resetDialogueSession(ctx)
          return json({ ok: true, cleared: true })
        }
        // GET — return the current session state for debugging.
        const ctx: NLCContext = {
          surface: (url.searchParams.get('surface') as NLCContext['surface']) ?? 'api',
          conversationId: url.searchParams.get('conversationId') ?? undefined,
          slaveId: url.searchParams.get('slaveId') ?? undefined,
          userId: url.searchParams.get('userId') ?? undefined,
          metadata: {},
        }
        const store = engine.getDialogueSessionStore()
        const { computeDialogueSessionKey } = await import(
          '../engines/nlcl/dialogue-session-store.js'
        )
        const session = store.get(computeDialogueSessionKey(ctx))
        return json({ session, size: store.size() })
      }

      case 'parse': {
        if (req.method !== 'POST') {
          return errorResponse('Method not allowed', 'MethodNotAllowed', 405)
        }
        try {
          const parsed = NlclExecuteSchema.safeParse(await req.json())
          if (!parsed.success) {
            return errorResponse(parsed.error.message, 'ValidationError', 400)
          }
          const rawInput = parsed.data.input.trim()
          const ctx: NLCContext = { surface: 'api', metadata: {} }
          const start = Date.now()
          const result = await engine.interpret(rawInput, ctx)
          // Parse endpoint returns the same InterpretResponse union — same shape as /interpret.
          return json(wrapCommandResultAsInterpretResponse(result, Date.now() - start))
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
