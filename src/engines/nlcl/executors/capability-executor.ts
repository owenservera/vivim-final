// src/engines/nlcl/executors/capability-executor.ts
// CapabilityExecutor — delegates to UnifiedCapabilityRegistry.
// Bridges NLCL intents to the existing typed capability system.

import type { CommandExecutor, CommandResult, ParsedIntent, NLCContext } from '../types.js'
import { newId } from '../../../ids.js'
import type { UnifiedCapabilityRegistry, CapabilityContext } from '../../unified-registry.js'

export class CapabilityExecutor implements CommandExecutor {
  readonly id = 'capability' as const

  constructor(private registry?: UnifiedCapabilityRegistry) {}

  async execute(intent: ParsedIntent, ctx: NLCContext): Promise<CommandResult> {
    const start = Date.now()
    const traceId = newId()

    if (!this.registry) {
      return this.fail(intent, traceId, start, 'Capability registry not available')
    }

    try {
      const capabilityId = (intent.input.capabilityId as string) ?? intent.input.slug as string
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
      delete input.capabilityId
      delete input.slug

      const result = await this.registry.execute(cap.id, input, capCtx)

      return {
        ok: true,
        intent: intent.intent,
        output: result,
        text: typeof result === 'string' ? result : `${cap.name} executed`,
        latencyMs: Date.now() - start,
        traceId,
        classification: cap.requiresConfirmation ? 'write' : 'read',
      }
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
