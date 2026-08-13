/**
 * VIVIM AI Gateway — Default Router
 * @module ai/routing/default-router
 *
 * Full pipeline: discover → filter by policy eligibility → score → decide.
 * Throws PROVIDER_UNAVAILABLE-coded VivimAIError if no candidate survives.
 */

import { AI_ERRORS } from '../core/errors.js'
import type {
  AIRequest,
  ModelDescriptor,
  ProviderId,
  ProviderManifest,
  RoutingCandidate,
  RoutingDecision,
} from '../core/types.js'
import type {
  IRouter,
  IRoutingStrategy,
  RoutingDependencies,
  RoutingStrategyName,
} from './router.js'
import { ExplicitStrategy, LearnedStrategy, LocalOnlyStrategy, LowestCostStrategy, PriorityStrategy } from './strategies.js'
import type { OutcomeTracker } from '../../engines/outcome-tracker.js'

export class DefaultRouter implements IRouter {
  private readonly strategies = new Map<RoutingStrategyName, IRoutingStrategy>()

  constructor(outcomeTracker?: OutcomeTracker) {
    // Register default strategies
    this.registerStrategy(new ExplicitStrategy())
    this.registerStrategy(new PriorityStrategy())
    this.registerStrategy(new LocalOnlyStrategy())
    this.registerStrategy(new LowestCostStrategy())
    // Register LearnedStrategy only if OutcomeTracker is available
    if (outcomeTracker) {
      this.registerStrategy(new LearnedStrategy(outcomeTracker))
    }
  }

  registerStrategy(strategy: IRoutingStrategy): void {
    this.strategies.set(strategy.name, strategy)
  }

  getStrategy(name: RoutingStrategyName): IRoutingStrategy | undefined {
    return this.strategies.get(name)
  }

  async route(request: AIRequest, deps: RoutingDependencies): Promise<RoutingDecision> {
    const candidates = await this.explain(request, deps)
    if (candidates.length === 0) {
      throw AI_ERRORS.providerUnavailable(
        request.model?.providerId ?? ('unknown' as ProviderId),
        new Error(
          'No provider survived routing (policy/resource/capability filtered all candidates)',
        ),
      )
    }
    const winner = candidates[0]!
    return {
      providerId: winner.providerId,
      modelId: winner.modelId,
      candidates,
      decidedAt: new Date().toISOString(),
    }
  }

  async explain(
    request: AIRequest,
    deps: RoutingDependencies,
  ): Promise<readonly RoutingCandidate[]> {
    // 1. Discover candidates
    const candidates = await this.discoverCandidates(request, deps)
    if (candidates.length === 0) return []

    // 2. Filter by policy eligibility
    const eligible: typeof candidates = []
    for (const c of candidates) {
      const decision = await deps.policyEvaluator.isEligible(request, c)
      if (decision.allowed) {
        eligible.push(c)
      }
    }
    if (eligible.length === 0) return []

    // 3. Score via policy evaluator
    const scored = await deps.policyEvaluator.scoreCandidates(request, eligible)

    // 4. Apply routing strategy (default: explicit → priority → local-only fallback)
    const strategyName = this.pickStrategy(request)
    const strategy = this.strategies.get(strategyName)
    if (strategy) {
      const reScored = await strategy.score(request, scored, deps)
      return reScored
    }

    // Fallback: sort by score descending
    return [...scored].sort((a, b) => b.score - a.score)
  }

  private pickStrategy(request: AIRequest): RoutingStrategyName {
    // If request pins providerId+modelId, use explicit
    if (request.model?.providerId && request.model?.modelId) {
      return 'explicit'
    }
    // If policy is local-only or local-preferred, use local-only strategy
    const locality = request.policy?.locality
    if (locality === 'local-only' || locality === 'local-preferred') {
      return 'local-only'
    }
    // If policy is lowest-cost, use lowest-cost strategy
    if (request.policy?.priority === 'cost') {
      return 'lowest-cost'
    }
    // If we have a learned strategy (OutcomeTracker available), use it for general requests
    if (this.strategies.has('best-fit')) {
      return 'best-fit'
    }
    // Default
    return 'priority'
  }

  private async discoverCandidates(
    request: AIRequest,
    deps: RoutingDependencies,
  ): Promise<{ provider: ProviderManifest; model: ModelDescriptor }[]> {
    const out: { provider: ProviderManifest; model: ModelDescriptor }[] = []

    const providers = await deps.providerRegistry.listAvailable()
    const excluded = new Set(request.policy?.excludedProviderIds ?? [])
    const preferred = request.policy?.preferredProviderIds

    for (const provider of providers) {
      if (excluded.has(provider.id)) continue
      if (preferred && !preferred.includes(provider.id)) continue

      const models = await deps.modelRegistry.listByProvider(provider.id)
      for (const model of models) {
        // If request pins a model, skip non-matching
        if (request.model?.modelId && model.id !== request.model.modelId) continue
        // If request pins a provider, skip non-matching
        if (request.model?.providerId && provider.id !== request.model.providerId) continue
        // If request requires capabilities, skip models that lack them
        if (request.policy?.requiredCapabilities) {
          const hasAll = request.policy.requiredCapabilities.every(
            (cap) => model.capabilities[cap]?.supported === true,
          )
          if (!hasAll) continue
        }
        if (request.model?.capabilities) {
          const hasAll = request.model.capabilities.every(
            (cap) => model.capabilities[cap]?.supported === true,
          )
          if (!hasAll) continue
        }
        out.push({ provider, model })
      }
    }

    return out
  }
}
