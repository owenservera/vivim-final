// src/engines/nlcl/executors/workflow-executor.ts
// WorkflowExecutor — delegates workflow intents to capability registry.

import { newId } from '../../../ids.js'
import type { CapabilityContext, UnifiedCapabilityRegistry } from '../../unified-registry.js'
import type { CommandExecutor, CommandResult, NLCContext, ParsedIntent } from '../types.js'

export class WorkflowExecutor implements CommandExecutor {
  readonly id = 'workflow' as const

  constructor(private registry?: UnifiedCapabilityRegistry) {}

  async execute(intent: ParsedIntent, ctx: NLCContext): Promise<CommandResult> {
    const start = Date.now()
    const traceId = newId()

    if (!this.registry) {
      return {
        ok: false,
        intent: intent.intent,
        error: 'Capability registry not available',
        latencyMs: Date.now() - start,
        traceId,
        classification: 'system',
      }
    }

    try {
      const capabilityId = (intent.input.capabilityId as string) ?? (intent.input.slug as string)
      if (!capabilityId) {
        return {
          ok: false,
          intent: intent.intent,
          error: 'No capability specified',
          latencyMs: Date.now() - start,
          traceId,
          classification: 'system',
        }
      }

      const cap = this.registry.get(capabilityId) ?? this.registry.getBySlug(capabilityId)
      if (!cap) {
        return {
          ok: false,
          intent: intent.intent,
          error: `Capability not found: ${capabilityId}`,
          latencyMs: Date.now() - start,
          traceId,
          classification: 'system',
        }
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

      const output = await this.registry.execute(cap.id, input, capCtx)

      return {
        ok: true,
        intent: intent.intent,
        output,
        latencyMs: Date.now() - start,
        traceId,
        classification: 'system',
        capabilityId: cap.id,
      }
    } catch (err) {
      return {
        ok: false,
        intent: intent.intent,
        error: err instanceof Error ? err.message : String(err),
        latencyMs: Date.now() - start,
        traceId,
        classification: 'system',
      }
    }
  }
}
