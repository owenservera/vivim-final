// src/engines/budget-engine.ts
// BudgetEngine — first-class cost/usage budget enforcement.
//
// Mirrors pydantic_ai UsageLimits: request/tool/token limits, checked before
// and after calls; raises BudgetExceededError (reused from errors.ts) on breach.
// Costs accrue on the agent_run node (costJson) so runs are durable + resumable.

import { BudgetExceededError } from '../errors.js'
import type { AgenticStoreContract } from '../storage/contracts/agentic-store.js'

export interface UsageLimits {
  requestLimit?: number | null
  toolCallsLimit?: number | null
  inputTokensLimit?: number | null
  outputTokensLimit?: number | null
  totalTokensLimit?: number | null
}

export interface RunUsage {
  requests: number
  toolCalls: number
  inputTokens: number
  outputTokens: number
  totalTokens: number
  costCents: number
}

export class BudgetEngine {
  constructor(private readonly store: AgenticStoreContract) {}

  /** Check before a model request: request + input + total token limits. */
  checkBeforeRequest(runId: string, usage: RunUsage, limits: UsageLimits): void {
    void runId
    if (limits.requestLimit != null && usage.requests >= limits.requestLimit) {
      throw new BudgetExceededError('iterations', usage.requests, limits.requestLimit)
    }
    if (limits.inputTokensLimit != null && usage.inputTokens > limits.inputTokensLimit) {
      throw new BudgetExceededError('tokens', usage.inputTokens, limits.inputTokensLimit)
    }
    if (limits.totalTokensLimit != null && usage.totalTokens > limits.totalTokensLimit) {
      throw new BudgetExceededError('tokens', usage.totalTokens, limits.totalTokensLimit)
    }
  }

  /** Check after a model response: output + total token limits. */
  checkTokens(usage: RunUsage, limits: UsageLimits): void {
    if (limits.outputTokensLimit != null && usage.outputTokens > limits.outputTokensLimit) {
      throw new BudgetExceededError('tokens', usage.outputTokens, limits.outputTokensLimit)
    }
    if (limits.totalTokensLimit != null && usage.totalTokens > limits.totalTokensLimit) {
      throw new BudgetExceededError('tokens', usage.totalTokens, limits.totalTokensLimit)
    }
  }

  /** Check before a tool call: tool-calls limit. */
  checkBeforeToolCall(usage: RunUsage, limits: UsageLimits): void {
    if (limits.toolCallsLimit != null && usage.toolCalls > limits.toolCallsLimit) {
      throw new BudgetExceededError('iterations', usage.toolCalls, limits.toolCallsLimit)
    }
  }

  /** Accrue cost onto the run node (durable). */
  async accrue(runId: string, costCents: number, tokens = 0): Promise<void> {
    await this.store.accrueCost(runId, costCents, tokens)
  }

  /** Guard a cost figure against a hard cap (reused BudgetExceededError). */
  async guard(
    runId: string,
    kind: 'cost' | 'tokens' | 'iterations' | 'duration',
    used: number,
    limit: number,
  ): Promise<void> {
    await this.store.checkBudget(runId, kind, used, limit)
  }
}
