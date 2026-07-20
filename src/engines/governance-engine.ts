// src/engines/governance-engine.ts
// GovernanceEngine — multi-role / multi-model allocation (capability-as-data).
//
// Allocation strategy is *data-driven* (not a DSL): a governance_policy node
// declares a strategy + role bindings; evaluateAllocation resolves agents per
// role. endStrategy (early/graceful/exhaustive) governs how parallel tool calls
// and the final output are resolved. Modeled on pydantic-graph RunEndStrategy.

import { BudgetExceededError } from '../errors.js'
import type { AgenticStoreContract } from '../storage/contracts/agentic-store.js'

export type EndStrategy = 'early' | 'graceful' | 'exhaustive'

export type AllocationCtx = {
  roleId?: string
  // map of agentId -> reputation snapshot for cost_aware / reputationFloor
  agentReputation?: Record<string, { score: number; avgCostCents: number }>
  costBudgetCents?: number
  reputationFloor?: number
}

export interface ResolvedRole {
  roleId: string
  agentId: string
  model?: string
  weight?: number
}

export class GovernanceEngine {
  constructor(private readonly store: AgenticStoreContract) {}

  /**
   * Resolve role -> agent bindings for a policy. round_robin advances a per-role
   * cursor (persisted in rotationStateJson); cost_aware picks the lowest-cost
   * candidate within budget; reputationFloor filters weak agents.
   */
  async evaluateAllocation(policyId: string, ctx: AllocationCtx = {}): Promise<ResolvedRole[]> {
    const bindings = await this.store.evaluateAllocation(policyId, {
      roleId: ctx.roleId,
    })
    let resolved = bindings
    if (ctx.reputationFloor != null) {
      const floor = ctx.reputationFloor
      resolved = resolved.filter((b) => {
        const rep = ctx.agentReputation?.[b.agentId]
        return !rep || rep.score >= floor
      })
    }
    if (ctx.costBudgetCents != null) {
      const budget = ctx.costBudgetCents
      resolved = resolved.filter((b) => {
        const rep = ctx.agentReputation?.[b.agentId]
        return !rep || rep.avgCostCents <= budget
      })
    }
    return resolved
  }

  /**
   * Honor endStrategy when resolving parallel tool calls / final output:
   *  - early: stop at first success.
   *  - graceful: run all, keep the first success, tolerate failures.
   *  - exhaustive: run all, aggregate, fail the whole if any fails.
   */
  applyEndStrategy<T>(
    strategy: EndStrategy,
    results: Array<{ ok: boolean; value: T }>,
  ): { ok: boolean; values: T[]; first: T | null } {
    const successes = results.filter((r) => r.ok)
    const first = successes[0]?.value ?? null
    if (strategy === 'early') {
      return { ok: successes.length > 0, values: first ? [first] : [], first }
    }
    if (strategy === 'graceful') {
      return { ok: successes.length > 0, values: successes.map((r) => r.value), first }
    }
    // exhaustive
    return { ok: results.every((r) => r.ok), values: results.map((r) => r.value), first }
  }

  /** Raise before/after a costly call — first-class cost enforcement. */
  assertBudget(
    kind: 'cost' | 'tokens' | 'iterations' | 'duration',
    used: number,
    limit: number,
  ): void {
    if (used > limit) throw new BudgetExceededError(kind, used, limit)
  }
}
