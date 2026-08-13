// src/engines/nlcl/executors/capability-executor.ts
// CapabilityExecutor — delegates to UnifiedCapabilityRegistry.
// Bridges NLCL intents to the existing typed capability system.
// When an ExecutionKernel is provided, routes through the full lifecycle
// (policy → execute → verify → journal) instead of direct registry.execute().

import { newId } from '../../../ids.js'
import type { ActionPlan, CapabilityRisk } from '../../action-plan.js'
import type { ExecutionKernel } from '../../execution-kernel.js'
import type { CapabilityContext, UnifiedCapabilityRegistry } from '../../unified-registry.js'
import { createNoOpResponseInterpreter, type ResponseInterpreter } from '../response-interpreter.js'
import type {
  ActionClassification,
  CommandExecutor,
  CommandResult,
  NLCContext,
  ParsedIntent,
} from '../types.js'

/** Map NLCL classification to ActionPlan risk tier. */
function classificationToRisk(classification?: ActionClassification): CapabilityRisk {
  switch (classification) {
    case 'destructive':
      return 'destructive'
    case 'communication':
      return 'external_communication'
    case 'financial':
      return 'security_sensitive'
    case 'write':
      return 'reversible_write'
    default:
      return 'read'
  }
}

export class CapabilityExecutor implements CommandExecutor {
  readonly id = 'capability' as const
  private responseInterpreter: ResponseInterpreter

  constructor(
    private registry?: UnifiedCapabilityRegistry,
    responseInterpreter?: ResponseInterpreter,
    private kernel?: ExecutionKernel,
  ) {
    this.responseInterpreter = responseInterpreter ?? createNoOpResponseInterpreter()
  }

  /** Inject the execution kernel after construction (for deferred init). */
  setKernel(kernel: ExecutionKernel): void {
    this.kernel = kernel
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
      const confirmationToken = input.confirmationToken as string | undefined
      const engineConfirmed = intent.confirmationSatisfied === true || confirmationToken != null

      // Route through ExecutionKernel when available (P0 lifecycle).
      // Falls back to direct registry.execute() for backward compatibility.
      let result: unknown
      if (this.kernel) {
        // Build a real single-node ActionPlan matching the canonical schema the kernel validates
        // (src/engines/action-plan.ts). The kernel executes each node via (node, nodeInput) -> registry.execute.
        const plan: ActionPlan = {
          version: 1,
          goal: `Execute ${cap.id}`,
          nodes: [
            {
              id: 'n1',
              capability: cap.id,
              input,
              dependsOn: [],
              risk: classificationToRisk(intent.classification),
              requiresConfirmation: cap.requiresConfirmation,
              verify: { type: 'none' },
            },
          ],
          groundedRefs: [],
          metadata: {
            patternId: intent.patternId,
            confidence: intent.confidence,
            rawInput: intent.rawInput,
            ...(confirmationToken ? { confirmationToken } : {}),
            ...(engineConfirmed ? { __confirmed: true } : {}),
          },
        }

        const kernelResult = await this.kernel.execute(plan, async (_node, nodeInput) =>
          this.registry!.execute(cap.id, nodeInput, capCtx),
        )

        if (!kernelResult.ok) {
          return this.fail(intent, traceId, start, kernelResult.error ?? 'Execution failed')
        }
        result = kernelResult.output
      } else {
        result = await this.registry.execute(cap.id, input, capCtx)
      }

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
