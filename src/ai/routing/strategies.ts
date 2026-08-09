/**
 * VIVIM AI Gateway — Default Routing Strategies
 * @module ai/routing/strategies
 *
 * Pluggable scoring strategies that compose into the default router.
 */

import type { AIRequest, ProviderManifest, RoutingCandidate } from '../core/types.js'
import type { IRoutingStrategy, RoutingDependencies } from './router.js'

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
 * Lowest-cost: prefer models with lower (or zero) pricing.
 * (Future: read pricing from ModelDescriptor.extensions.pricing.)
 */
export class LowestCostStrategy implements IRoutingStrategy {
  readonly name = 'lowest-cost' as const

  async score(
    _request: AIRequest,
    candidates: readonly RoutingCandidate[],
    _deps: RoutingDependencies,
  ): Promise<readonly RoutingCandidate[]> {
    // Models with no pricing info get score 0.5; priced models get penalized
    return [...candidates]
      .map((c) => ({
        ...c,
        // Free models (no pricing) score highest; we'd need pricing data to be precise
        score: c.score * 0.5,
      }))
      .sort((a, b) => b.score - a.score)
  }
}
