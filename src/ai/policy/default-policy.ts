/**
 * VIVIM AI Gateway — Default Policy Evaluator + Enforcer
 * @module ai/policy/default-policy
 *
 * The evaluator returns every candidate as eligible with a neutral score
 * (no rules yet). The enforcer defaults every policy to local-only /
 * network: deny unless a request explicitly overrides it.
 *
 * The split is enforced by type: IPolicyEvaluator.scoreCandidates() returns
 * RoutingCandidate[], IPolicyEnforcer.enforceNetworkPolicy() returns
 * PolicyDecision — they cannot be accidentally swapped.
 */

import type { AIRequest, ExecutionPolicy, RoutingCandidate, ToolDefinition } from '../core/types.js'
import type { CandidateInput, IPolicyEnforcer, IPolicyEvaluator, PolicyDecision } from './policy.js'

const NEUTRAL_SCORE = 0.5

export class DefaultPolicyEvaluator implements IPolicyEvaluator {
  async scoreCandidates(
    _request: AIRequest,
    candidates: readonly CandidateInput[],
  ): Promise<readonly RoutingCandidate[]> {
    return candidates.map(({ provider, model }) => ({
      providerId: provider.id,
      modelId: model.id,
      score: NEUTRAL_SCORE,
      reasons: [
        { factor: 'capability', score: NEUTRAL_SCORE, explanation: 'Default neutral score' },
      ],
    }))
  }

  async isEligible(request: AIRequest, candidate: CandidateInput): Promise<PolicyDecision> {
    // Deny if policy excludes this provider
    if (request.policy?.excludedProviderIds?.includes(candidate.provider.id)) {
      return {
        allowed: false,
        reason: `Provider ${candidate.provider.id} excluded by policy`,
        code: 'POLICY_DENIED',
      }
    }
    // Deny if policy requires capabilities the model lacks
    if (request.policy?.requiredCapabilities) {
      for (const cap of request.policy.requiredCapabilities) {
        if (candidate.model.capabilities[cap]?.supported !== true) {
          return {
            allowed: false,
            reason: `Model ${candidate.model.id} lacks required capability: ${cap}`,
            code: 'CAPABILITY_UNSUPPORTED',
          }
        }
      }
    }
    // Deny if policy denies capabilities
    if (request.policy?.deniedCapabilities) {
      for (const cap of request.policy.deniedCapabilities) {
        if (candidate.model.capabilities[cap]?.supported === true) {
          return {
            allowed: false,
            reason: `Model ${candidate.model.id} has denied capability: ${cap}`,
            code: 'POLICY_DENIED',
          }
        }
      }
    }
    // Locality check
    if (request.policy?.locality === 'local-only' && candidate.provider.kind === 'remote') {
      return {
        allowed: false,
        reason: `Provider ${candidate.provider.id} is remote but policy is local-only`,
        code: 'POLICY_DENIED',
      }
    }
    if (request.policy?.locality === 'remote-only' && candidate.provider.kind === 'local') {
      return {
        allowed: false,
        reason: `Provider ${candidate.provider.id} is local but policy is remote-only`,
        code: 'POLICY_DENIED',
      }
    }
    return { allowed: true }
  }
}

export class DefaultPolicyEnforcer implements IPolicyEnforcer {
  async enforceNetworkPolicy(policy: ExecutionPolicy, targetHost: string): Promise<PolicyDecision> {
    const network = policy.network ?? 'deny'
    if (network === 'deny') {
      return {
        allowed: false,
        reason: `Network policy denies egress to ${targetHost}`,
        code: 'POLICY_DENIED',
      }
    }
    if (network === 'localhost') {
      const isLocal =
        targetHost.startsWith('127.0.0.1') ||
        targetHost.startsWith('localhost') ||
        targetHost.startsWith('0.0.0.0') ||
        targetHost.startsWith('[::1]')
      if (!isLocal) {
        return {
          allowed: false,
          reason: `Network policy is localhost-only; ${targetHost} is not local`,
          code: 'POLICY_DENIED',
        }
      }
      return { allowed: true }
    }
    if (network === 'allow-listed') {
      const allowed = policy.allowedNetworkHosts ?? []
      const isAllowed = allowed.some((h) => targetHost.includes(h))
      if (!isAllowed) {
        return {
          allowed: false,
          reason: `Host ${targetHost} not in allow-list`,
          code: 'POLICY_DENIED',
        }
      }
      return { allowed: true }
    }
    // network === 'allow'
    return { allowed: true }
  }

  async enforceToolPolicy(policy: ExecutionPolicy, tool: ToolDefinition): Promise<PolicyDecision> {
    if (policy.allowToolExecution === false) {
      return {
        allowed: false,
        reason: 'Tool execution disabled by policy',
        code: 'POLICY_DENIED',
      }
    }
    if (policy.requireToolApproval && !tool.requiresApproval) {
      // Tool doesn't require approval but policy says all tools need approval
      // This is advisory — the orchestrator will still ask
    }
    return { allowed: true }
  }

  async enforcePersistencePolicy(
    policy: ExecutionPolicy,
    operation: 'read' | 'write' | 'delete',
  ): Promise<PolicyDecision> {
    const persistence = policy.persistence ?? 'session'
    if (persistence === 'deny' && operation !== 'read') {
      return {
        allowed: false,
        reason: `Persistence policy denies ${operation}`,
        code: 'POLICY_DENIED',
      }
    }
    return { allowed: true }
  }

  async enforceTelemetryPolicy(
    policy: ExecutionPolicy,
    payloadKind: 'metadata' | 'prompt' | 'output',
  ): Promise<PolicyDecision> {
    // Default deny for prompt/output; metadata is allowed if allowTelemetry is true
    if (payloadKind === 'metadata') {
      if (policy.allowTelemetry === false) {
        return {
          allowed: false,
          reason: 'Telemetry disabled by policy',
          code: 'POLICY_DENIED',
        }
      }
      return { allowed: true }
    }
    // prompt or output
    if (payloadKind === 'prompt' && policy.allowPromptLogging !== true) {
      return {
        allowed: false,
        reason: 'Prompt logging not explicitly allowed',
        code: 'POLICY_DENIED',
      }
    }
    if (payloadKind === 'output' && policy.allowPromptLogging !== true) {
      return {
        allowed: false,
        reason: 'Output logging not explicitly allowed',
        code: 'POLICY_DENIED',
      }
    }
    return { allowed: true }
  }
}
