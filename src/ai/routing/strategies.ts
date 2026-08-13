/**
 * VIVIM AI Gateway — Default Routing Strategies
 * @module ai/routing/strategies
 *
 * Pluggable scoring strategies that compose into the default router.
 */

import type { AIRequest, ProviderManifest, RoutingCandidate } from '../core/types.js'
import type { IRoutingStrategy, RoutingDependencies } from './router.js'
import type { OutcomeTracker } from '../../engines/outcome-tracker.js'

/**
 * Explicit: caller pinned providerId + modelId. Just return that candidate
 * (with a perfect score) if it survived discovery.
 */
export class ExplicitStrategy implements IRoutingStrategy {
  readonly name = 'explicit' as const

  async score(
    _request: AIRequest,
    candidates: readonly RoutingCandidate[],
    _deps: RoutingDependencies,
  ): Promise<readonly RoutingCandidate[]> {
    // Explicit strategy trusts the caller's pin — just return candidates as-is
    // (discovery already filtered to only the pinned ones).
    return candidates.map((c) => ({ ...c, score: 1.0 }))
  }
}

/**
 * Priority: order by registry order (first registered = highest priority).
 * Stable, predictable, good for "prefer local over remote" setups.
 */
export class PriorityStrategy implements IRoutingStrategy {
  readonly name = 'priority' as const

  async score(
    _request: AIRequest,
    candidates: readonly RoutingCandidate[],
    deps: RoutingDependencies,
  ): Promise<readonly RoutingCandidate[]> {
    const providers = await deps.providerRegistry.list()
    const priorityById = new Map<ProviderManifest['id'], number>()
    providers.forEach((p, i) => priorityById.set(p.id, providers.length - i))

    return [...candidates]
      .map((c) => ({
        ...c,
        score: c.score + (priorityById.get(c.providerId) ?? 0) * 0.01,
      }))
      .sort((a, b) => b.score - a.score)
  }
}

/**
 * Local-only: filter out remote providers, then score by priority.
 */
export class LocalOnlyStrategy implements IRoutingStrategy {
  readonly name = 'local-only' as const

  async score(
    _request: AIRequest,
    candidates: readonly RoutingCandidate[],
    deps: RoutingDependencies,
  ): Promise<readonly RoutingCandidate[]> {
    const providers = await deps.providerRegistry.list()
    const localIds = new Set(
      providers.filter((p) => p.kind === 'local' || p.kind === 'embedded').map((p) => p.id),
    )

    const filtered = candidates.filter((c) => localIds.has(c.providerId))
    // Then sort by score descending
    return [...filtered].sort((a, b) => b.score - a.score)
  }
}

/**
 * Lowest-cost: prefer models with lower pricing.
 * Reads pricing from candidate extensions if available (ModelDescriptor.extensions.pricing).
 * Free models (no pricing info) get no penalty.
 */
export class LowestCostStrategy implements IRoutingStrategy {
  readonly name = 'lowest-cost' as const

  async score(
    _request: AIRequest,
    candidates: readonly RoutingCandidate[],
    _deps: RoutingDependencies,
  ): Promise<readonly RoutingCandidate[]> {
    return [...candidates]
      .map((c) => {
        // Read pricing from model extensions if available
        const pricing = (c as any).extensions?.pricing as
          | { inputPer1k?: number; outputPer1k?: number }
          | undefined
        if (!pricing) return { ...c, score: c.score } // No pricing info = no penalty
        const avgCost = ((pricing.inputPer1k ?? 0) + (pricing.outputPer1k ?? 0)) / 2
        const costPenalty = Math.min(1, avgCost / 0.1) // Normalize: $0.10/1k tokens = full penalty
        return { ...c, score: c.score * (1 - costPenalty * 0.5) }
      })
      .sort((a, b) => b.score - a.score)
  }
}

/**
 * Learned: route based on historical outcome scores from OutcomeTracker.
 * Blends policy score (eligibility) + health + outcome EMA + task affinity.
 * Only scores providers with enough observations (minSamples).
 */
export class LearnedStrategy implements IRoutingStrategy {
  readonly name = 'best-fit' as const

  constructor(private outcomeTracker: OutcomeTracker) {}

  async score(
    _request: AIRequest,
    candidates: readonly RoutingCandidate[],
    _deps: RoutingDependencies,
  ): Promise<readonly RoutingCandidate[]> {
    return [...candidates]
      .map((c) => {
        const outcomeScore = this.outcomeTracker.getScoreOrDefault(c.providerId)
        // Blend: policy base (60%) + outcome EMA (40%)
        // outcomeScore is only reliable if sampleCount >= minSamples,
        // but getScoreOrDefault already returns 0.5 for unknowns.
        const blended = c.score * 0.6 + outcomeScore * 0.4
        const reasons = [
          {
            factor: 'outcome-ema',
            score: outcomeScore,
            explanation: `Outcome EMA: ${outcomeScore.toFixed(2)}`,
          },
        ]
        return { ...c, score: blended, reasons }
      })
      .sort((a, b) => b.score - a.score)
  }
}
