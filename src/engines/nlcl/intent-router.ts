// src/engines/nlcl/intent-router.ts
// IntentRouter — routes parsed intents to the correct CommandExecutor.
// Also handles composite intents (multi-step commands like "go to cnn and summarize").
// When an ExecutionKernel is present, routes capability execution through
// the full lifecycle (policy → execute → verify → journal).

import { EngineError } from '../../errors.js'
import { newId } from '../../ids.js'
import type { ActionPlan, CapabilityRisk } from '../action-plan.js'
import type { ExecutionKernel } from '../execution-kernel.js'
import type { UnifiedCapabilityRegistry } from '../unified-registry.js'
import type {
  ActionClassification,
  CommandExecutor,
  CommandResult,
  ExecutorId,
  NLCContext,
  ParsedIntent,
} from './types.js'

export interface CompositeIntent {
  steps: ParsedIntent[]
  joinStrategy: 'sequential' | 'pipeline' | 'parallel'
}

/**
 * Maps NLCContext to CapabilityContext for registry execution.
 */
function toCapCtx(ctx: NLCContext): {
  conversationId?: string
  providerId?: string
  slaveId?: string
  userId?: string
  metadata: Record<string, unknown>
} {
  return {
    conversationId: ctx.conversationId,
    providerId: ctx.providerId,
    slaveId: ctx.slaveId,
    userId: ctx.userId,
    metadata: ctx.metadata,
  }
}

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

export class IntentRouter {
  private executors = new Map<ExecutorId, CommandExecutor>()
  private registry?: UnifiedCapabilityRegistry
  private kernel?: ExecutionKernel

  constructor(registry?: UnifiedCapabilityRegistry) {
    this.registry = registry
  }

  setRegistry(registry: UnifiedCapabilityRegistry): void {
    this.registry = registry
  }

  /** Inject the execution kernel for P0 lifecycle routing. */
  setKernel(kernel: ExecutionKernel): void {
    this.kernel = kernel
  }

  registerExecutor(executor: CommandExecutor): void {
    if (this.executors.has(executor.id)) {
      throw new EngineError(`Executor ${executor.id} already registered`)
    }
    this.executors.set(executor.id, executor)
  }

  getExecutor(id: ExecutorId): CommandExecutor | undefined {
    return this.executors.get(id)
  }

  listExecutors(): ExecutorId[] {
    return [...this.executors.keys()]
  }

  async route(intent: ParsedIntent, ctx: NLCContext): Promise<CommandResult> {
    const start = Date.now()
    const traceId = newId()

    if (intent.patternId === 'unresolved' || intent.intent === 'unresolved') {
      return {
        ok: false,
        intent: 'unresolved',
        error: `Could not understand: "${intent.rawInput}"`,
        latencyMs: Date.now() - start,
        traceId,
        classification: 'system',
        followUp: 'Try rephrasing, or type "help" to see available commands.',
      }
    }

    // Unit 25.4: Route via registry if capabilityId present
    if (intent.capabilityId && this.registry) {
      // Route through ExecutionKernel when available (P0 lifecycle)
      if (this.kernel) {
        return this.routeViaKernel(intent, ctx, start, traceId)
      }

      // Fallback: direct registry execution (backward compatible)
      try {
        const output = await this.registry.execute(
          intent.capabilityId,
          intent.input ?? {},
          toCapCtx(ctx),
        )
        return {
          ok: true,
          intent: intent.intent,
          output,
          latencyMs: Date.now() - start,
          traceId,
          classification: 'system',
          capabilityId: intent.capabilityId,
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err)
        return {
          ok: false,
          intent: intent.intent,
          error: message,
          latencyMs: Date.now() - start,
          traceId,
          classification: 'system',
          capabilityId: intent.capabilityId,
        }
      }
    }

    const pattern = this.findPattern(intent)
    if (!pattern) {
      return {
        ok: false,
        intent: intent.intent,
        error: `No executor for intent: ${intent.intent}`,
        latencyMs: Date.now() - start,
        traceId,
        classification: 'system',
      }
    }

    const executor = this.executors.get(pattern.executor)
    if (!executor) {
      return {
        ok: false,
        intent: intent.intent,
        error: `Executor "${pattern.executor}" not registered`,
        latencyMs: Date.now() - start,
        traceId,
        classification: 'system',
      }
    }

    return executor.execute(intent, ctx)
  }

  async routeComposite(composite: CompositeIntent, ctx: NLCContext): Promise<CommandResult> {
    const start = Date.now()
    const traceId = newId()
    const results: CommandResult[] = []
    let pipelineData: unknown

    for (let i = 0; i < composite.steps.length; i++) {
      const step = composite.steps[i]
      if (!step) continue
      const stepCtx = { ...ctx }

      // Unit 25.4: Pipeline data propagation
      if (composite.joinStrategy === 'pipeline' && pipelineData && i > 0) {
        step.input = {
          ...step.input,
          content: typeof pipelineData === 'string' ? pipelineData : JSON.stringify(pipelineData),
        }
      }

      // Unit 25.4: Route via registry if capabilityId present, else fall back to router
      const result = await this.routeStep(step, stepCtx)
      results.push(result)

      if (composite.joinStrategy === 'sequential' && !result.ok) {
        return {
          ok: false,
          intent: 'composite',
          error: `Step ${i + 1} failed: ${result.error}`,
          output: { results, failedAt: i + 1 },
          latencyMs: Date.now() - start,
          traceId,
          classification: 'system',
        }
      }

      if (composite.joinStrategy === 'pipeline') {
        pipelineData = result.output
      }
    }

    const lastResult = results[results.length - 1]
    return {
      ok: true,
      intent: 'composite',
      output: { results, finalOutput: lastResult?.output },
      text: lastResult?.text ?? 'Composite command completed',
      latencyMs: Date.now() - start,
      traceId,
      classification: lastResult?.classification ?? 'system',
    }
  }

  /** Route a single step via registry if capabilityId present, else router. */
  private async routeStep(step: ParsedIntent, ctx: NLCContext): Promise<CommandResult> {
    if (step.capabilityId && this.registry) {
      // Route through ExecutionKernel when available (P0 lifecycle)
      if (this.kernel) {
        const start = Date.now()
        const traceId = newId()
        return this.routeViaKernel(step, ctx, start, traceId)
      }

      // Fallback: direct registry execution (backward compatible)
      try {
        const output = await this.registry.execute(
          step.capabilityId,
          step.input ?? {},
          toCapCtx(ctx),
        )
        return {
          ok: true,
          intent: step.intent,
          output,
          latencyMs: 0,
          traceId: newId(),
          classification: 'system',
          capabilityId: step.capabilityId,
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err)
        return {
          ok: false,
          intent: step.intent,
          error: message,
          latencyMs: 0,
          traceId: newId(),
          classification: 'system',
          capabilityId: step.capabilityId,
        }
      }
    }
    return this.route(step, ctx)
  }

  /**
   * Route an intent through the ExecutionKernel.
   * Builds an ActionPlan from the intent, then executes through the kernel lifecycle.
   */
  private async routeViaKernel(
    intent: ParsedIntent,
    ctx: NLCContext,
    start: number,
    traceId: string,
  ): Promise<CommandResult> {
    try {
      const cap = this.registry!.get(intent.capabilityId!) ?? this.registry!.getBySlug(intent.capabilityId!)
      if (!cap) {
        return {
          ok: false,
          intent: intent.intent,
          error: `Capability not found: ${intent.capabilityId}`,
          latencyMs: Date.now() - start,
          traceId,
          classification: 'system',
          capabilityId: intent.capabilityId,
        }
      }

      const input = { ...intent.input }
      delete input.capabilityId
      delete input.slug
      // The confirmation token mints once (NLCL layer) and rides through the already-confirmed resume.
      const confirmationToken = input.confirmationToken as string | undefined
      const engineConfirmed = intent.confirmationSatisfied === true || confirmationToken != null

      // Build a real single-node ActionPlan matching the canonical schema the ExecutionKernel validates
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

      const kernelResult = await this.kernel!.execute(plan, async (_node, nodeInput) =>
        this.registry!.execute(cap.id, nodeInput, toCapCtx(ctx)),
      )

      if (!kernelResult.ok) {
        return {
          ok: false,
          intent: intent.intent,
          error: kernelResult.error ?? 'Execution failed',
          latencyMs: Date.now() - start,
          traceId,
          classification: 'system',
          capabilityId: intent.capabilityId,
        }
      }

      return {
        ok: true,
        intent: intent.intent,
        output: kernelResult.output,
        latencyMs: Date.now() - start,
        traceId,
        classification: 'system',
        capabilityId: intent.capabilityId,
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      return {
        ok: false,
        intent: intent.intent,
        error: message,
        latencyMs: Date.now() - start,
        traceId,
        classification: 'system',
        capabilityId: intent.capabilityId,
      }
    }
  }

  private patternRegistry: Map<string, { executor: ExecutorId }> = new Map()

  registerPatternIntent(intent: string, executor: ExecutorId): void {
    this.patternRegistry.set(intent, { executor })
  }

  private findPattern(intent: ParsedIntent): { executor: ExecutorId } | null {
    return this.patternRegistry.get(intent.intent) ?? null
  }
}
