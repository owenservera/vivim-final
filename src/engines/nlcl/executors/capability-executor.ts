// src/engines/nlcl/executors/capability-executor.ts
// CapabilityExecutor — delegates to UnifiedCapabilityRegistry.
// Bridges NLCL intents to the existing typed capability system.

import { newId } from '../../../ids.js'
import type { CapabilityContext, UnifiedCapabilityRegistry } from '../../unified-registry.js'
import { createNoOpResponseInterpreter, type ResponseInterpreter } from '../response-interpreter.js'
import type { CommandExecutor, CommandResult, NLCContext, ParsedIntent } from '../types.js'

export class CapabilityExecutor implements CommandExecutor {
  readonly id = 'capability' as const
  private responseInterpreter: ResponseInterpreter

  constructor(
    private registry?: UnifiedCapabilityRegistry,
    responseInterpreter?: ResponseInterpreter,
  ) {
    this.responseInterpreter = responseInterpreter ?? createNoOpResponseInterpreter()
  }

  async execute(intent: ParsedIntent, ctx: NLCContext): Promise<CommandResult> {
    const start = Date.now()
    const traceId = newId()

    if (!this.registry) {
      return this.fail(intent, traceId, start, 'Capability registry not available')
    }

    try {
      const capabilityId = (intent.input.capabilityId as string) ?? (intent.input.slug as string)
      if (!capabilityId) {
        return this.fail(intent, traceId, start, 'No capability specified')
      }

      const cap = this.registry.get(capabilityId) ?? this.registry.getBySlug(capabilityId)
      if (!cap) {
        return this.fail(intent, traceId, start, `Capability not found: ${capabilityId}`)
      }

      const capCtx: CapabilityContext = {
        conversationId: ctx.conversationId,
        providerId: ctx.providerId,
        slaveId: ctx.slaveId,
        userId: ctx.userId,
        metadata: ctx.metadata,
      }

      const input = { ...intent.input }
      input.capabilityId = undefined
      input.slug = undefined

      const result = await this.registry.execute(cap.id, input, capCtx)

      const raw: CommandResult = {
        ok: true,
        intent: intent.intent,
        output: result,
        text: typeof result === 'string' ? result : undefined,
        latencyMs: Date.now() - start,
        traceId,
        classification: cap.requiresConfirmation ? 'write' : 'read',
      }

      // Enrich the response text via ResponseInterpreter.
      // Extracts meaningful text from structured output, applies hedging,
      // and adds dialogue continuity hints.
      return this.responseInterpreter.enrich(raw, {
        resolutionLayer: ctx.resolutionLayer,
        confidence: ctx.confidence,
        dialogueTurnCount: ctx.dialogueTurnCount,
        recentEntities: ctx.recentEntities,
        conversationId: ctx.conversationId,
        providerId: ctx.providerId,
      })
    } catch (err) {
      return this.fail(intent, traceId, start, err instanceof Error ? err.message : String(err))
    }
  }

  private fail(intent: ParsedIntent, traceId: string, start: number, error: string): CommandResult {
    return {
      ok: false,
      intent: intent.intent,
      error,
      latencyMs: Date.now() - start,
      traceId,
      classification: 'system',
    }
  }
}
