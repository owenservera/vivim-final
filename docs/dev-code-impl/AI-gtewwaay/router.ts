/**
 * VIVIM AI Gateway — Router Contract
 * @module ai/routing/router
 *
 * doc2's IRouter.route(request, candidates) assumed something else had
 * already built the candidate list — but never said what. That ownership
 * gap is exactly how a system accretes an ad-hoc CandidateBuilder nobody
 * designed. The Router owns the full pipeline: discover candidates from
 * the registries, score them via policy, factor in live resource state,
 * and produce a decision. Dependencies are passed explicitly (not hidden
 * behind constructor DI) so routing stays a pure, testable function of
 * its inputs — feed it a fake registry and fake resource monitor and you
 * can unit-test every routing strategy without a real provider.
 */

import type { AIRequest, RoutingCandidate, RoutingDecision } from '../core/types';
import type { IModelRegistry, IProviderRegistry } from '../registry/registry';
import type { IPolicyEvaluator } from '../policy/policy';
import type { IResourceMonitor } from '../runtime/resources';

export interface RoutingDependencies {
  readonly providerRegistry: IProviderRegistry;
  readonly modelRegistry: IModelRegistry;
  readonly policyEvaluator: IPolicyEvaluator;
  readonly resourceMonitor: IResourceMonitor;
}

export type RoutingStrategyName =
  | 'explicit' | 'priority' | 'capability' | 'lowest-latency' | 'lowest-cost'
  | 'local-only' | 'best-fit' | 'round-robin' | 'weighted' | 'failover';

export interface IRouter {
  /** Full pipeline: discover → filter by policy eligibility → score → decide. Throws PROVIDER_UNAVAILABLE-coded VivimAIError if no candidate survives. */
  route(request: AIRequest, deps: RoutingDependencies): Promise<RoutingDecision>;

  /** Same pipeline, minus the final pick — returns the scored candidate set for UI preview ("which model will handle this?") without committing to one. */
  explain(request: AIRequest, deps: RoutingDependencies): Promise<readonly RoutingCandidate[]>;
}

/** Pluggable scoring strategies compose into the default IRouter implementation rather than being hardcoded into it. */
export interface IRoutingStrategy {
  readonly name: RoutingStrategyName;
  score(request: AIRequest, candidates: readonly RoutingCandidate[], deps: RoutingDependencies): Promise<readonly RoutingCandidate[]>;
}
