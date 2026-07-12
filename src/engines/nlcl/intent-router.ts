// src/engines/nlcl/intent-router.ts
// IntentRouter — routes parsed intents to the correct CommandExecutor.
// Also handles composite intents (multi-step commands like "go to cnn and summarize").

import type { CommandExecutor, CommandResult, ParsedIntent, NLCContext, ExecutorId } from './types.js'
import { newId } from '../../ids.js'

export interface CompositeIntent {
  steps: ParsedIntent[]
  joinStrategy: 'sequential' | 'pipeline' | 'parallel'
}

export class IntentRouter {
  private executors = new Map<ExecutorId, CommandExecutor>()

  registerExecutor(executor: CommandExecutor): void {
    if (this.executors.has(executor.id)) {
      throw new Error(`Executor ${executor.id} already registered`)
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
    const traceId = intent.patternId === 'unresolved' ? newId() : newId()

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

  async routeComposite(
    composite: CompositeIntent,
    ctx: NLCContext,
  ): Promise<CommandResult> {
    const start = Date.now()
    const traceId = newId()
    const results: CommandResult[] = []
    let pipelineData: unknown = undefined

    for (let i = 0; i < composite.steps.length; i++) {
      const step = composite.steps[i]!
      const stepCtx = { ...ctx }

      if (composite.joinStrategy === 'pipeline' && pipelineData && i > 0) {
        step.input = { ...step.input, content: typeof pipelineData === 'string' ? pipelineData : JSON.stringify(pipelineData) }
      }

      const result = await this.route(step, stepCtx)
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

  private patternRegistry: Map<string, { executor: ExecutorId }> = new Map()

  registerPatternIntent(intent: string, executor: ExecutorId): void {
    this.patternRegistry.set(intent, { executor })
  }

  private findPattern(intent: ParsedIntent): { executor: ExecutorId } | null {
    return this.patternRegistry.get(intent.intent) ?? null
  }
}
