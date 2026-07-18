// src/engines/nlcl/executors/generic-browser-executor.ts
// GenericBrowserExecutor (B8) — routes NL automation intents to the
// AutomationOrchestrator. Provider-free: uses the generic browser slave via
// ChromeGovernor. The role + recipe are resolved from the intent's params.

import { newId } from '../../../ids.js'
import type { ChromeGovernor } from '../../chrome-governor.js'
import type { AutomationOrchestrator } from '../../automation/orchestrator.js'
import type { CommandExecutor, CommandResult, NLCContext, ParsedIntent } from '../types.js'

export class GenericBrowserExecutor implements CommandExecutor {
  readonly id = 'generic-browser' as const

  constructor(
    private governor?: ChromeGovernor,
    private orchestrator?: AutomationOrchestrator,
  ) {}

  async execute(intent: ParsedIntent, ctx: NLCContext): Promise<CommandResult> {
    const start = Date.now()
    const traceId = newId()

    if (!this.orchestrator) {
      return this.fail(intent, traceId, start, 'Automation orchestrator not configured')
    }

    try {
      const params = (intent.input ?? {}) as Record<string, string>
      const role = params.role ?? this.inferRole(intent.intent)
      const recipeId = params.recipeId
      const destructive = params.destructive === 'true' || intent.classification === 'destructive'

      const result = await this.orchestrator.run({
        role,
        recipeId,
        intent: intent.intent,
        params,
        destructive,
      })

      return {
        ok: true,
        intent: intent.intent,
        output: result,
        text: `Ran ${role} via ${result.recipeId} (${result.steps} steps)`,
        latencyMs: Date.now() - start,
        traceId,
        classification: intent.classification,
      }
    } catch (err) {
      return this.fail(intent, traceId, start, err instanceof Error ? err.message : String(err))
    }
  }

  /** Map a raw automation intent to a default agent role. */
  private inferRole(intent: string): string {
    if (intent.includes('research') || intent.includes('report')) return 'researcher'
    if (intent.includes('extract') || intent.includes('scrape')) return 'extractor'
    if (intent.includes('summar') || intent.includes('rewrite') || intent.includes('translate')) return 'synthesizer'
    if (intent.includes('monitor') || intent.includes('watch')) return 'monitor'
    if (intent.includes('test') || intent.includes('smoke')) return 'tester'
    return 'researcher'
  }

  private fail(intent: ParsedIntent, traceId: string, start: number, error: string): CommandResult {
    return {
      ok: false,
      intent: intent.intent,
      error,
      latencyMs: Date.now() - start,
      traceId,
      classification: intent.classification,
    }
  }
}
