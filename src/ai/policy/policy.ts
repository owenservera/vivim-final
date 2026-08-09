/**
 * VIVIM AI Gateway — Policy Contracts
 * @module ai/policy/policy
 *
 * doc2 collapsed "evaluate candidates" and "enforce network policy" into
 * one IPolicyEngine. That reads fine until you notice they're different
 * kinds of authority:
 *
 *   Evaluation — advisory. Scores/filters candidates during ROUTING.
 *                A bad score just means a worse RoutingCandidate.
 *   Enforcement — a security boundary. Called at the moment of actual
 *                 network egress or tool execution. A denial here MUST
 *                 abort the operation — it is not advisory.
 *
 * Keeping these as one interface makes it easy for an implementer to
 * accidentally treat enforcement as "just another scoring input" and let
 * a request through on a good-enough aggregate score. Splitting them makes
 * that mistake a type error: nothing about IPolicyEnforcer returns a score.
 */

import type {
  AIErrorCode,
  AIRequest,
  ExecutionPolicy,
  ModelDescriptor,
  ProviderManifest,
  RoutingCandidate,
  ToolDefinition,
} from '../core/types.js'

export type PolicyDecision =
  | { readonly allowed: true }
  | { readonly allowed: false; readonly reason: string; readonly code: AIErrorCode }

export interface CandidateInput {
  readonly provider: ProviderManifest
  readonly model: ModelDescriptor
}

export interface IPolicyEvaluator {
  /** Advisory scoring, consumed by the Router. Never throws for a policy mismatch — returns an empty/low-score candidate instead. */
  scoreCandidates(
    request: AIRequest,
    candidates: readonly CandidateInput[],
  ): Promise<readonly RoutingCandidate[]>

  /** Advisory yes/no used during routing to decide whether a candidate is even eligible to be scored. */
  isEligible(request: AIRequest, candidate: CandidateInput): Promise<PolicyDecision>
}

export interface IPolicyEnforcer {
  /** Hard gate. Called immediately before any network egress. A denial MUST prevent the request from being sent. */
  enforceNetworkPolicy(policy: ExecutionPolicy, targetHost: string): Promise<PolicyDecision>

  /** Hard gate. Called by the Tool Orchestrator before a tool call executes — see tools/orchestrator.ts. */
  enforceToolPolicy(policy: ExecutionPolicy, tool: ToolDefinition): Promise<PolicyDecision>

  /** Hard gate for reads/writes/deletes against session or persistent storage. */
  enforcePersistencePolicy(
    policy: ExecutionPolicy,
    operation: 'read' | 'write' | 'delete',
  ): Promise<PolicyDecision>

  /** Hard gate for telemetry/prompt-logging export — must default deny per the privacy-preserving-telemetry principle. */
  enforceTelemetryPolicy(
    policy: ExecutionPolicy,
    payloadKind: 'metadata' | 'prompt' | 'output',
  ): Promise<PolicyDecision>
}
