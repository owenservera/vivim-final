// src/engines/nlcl/intent-router.ts
// IntentRouter — routes parsed intents to the correct CommandExecutor.
// Also handles composite intents (multi-step commands like "go to cnn and summarize").

import { EngineError } from '../../errors.js'
import { newId } from '../../ids.js'
import type { UnifiedCapabilityRegistry } from '../unified-registry.js'
import type {
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

export class IntentRouter {
  private executors = new Map<ExecutorId, CommandExecutor>()
  private registry?: UnifiedCapabilityRegistry

  constructor(registry?: UnifiedCapabilityRegistry) {
    this.registry = registry
  }

  setRegistry(registry: UnifiedCapabilityRegistry): void {
    this.registry = registry
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
      const step = composite.steps[i]!
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

  private patternRegistry: Map<string, { executor: ExecutorId }> = new Map()

  registerPatternIntent(intent: string, executor: ExecutorId): void {
    this.patternRegistry.set(intent, { executor })
  }

  private findPattern(intent: ParsedIntent): { executor: ExecutorId } | null {
    return this.patternRegistry.get(intent.intent) ?? null
  }
}
