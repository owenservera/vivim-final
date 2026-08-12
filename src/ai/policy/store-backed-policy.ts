// src/ai/policy/store-backed-policy.ts
// C2 convergence: IPolicyEvaluator + IPolicyEnforcer backed by the EXISTING
// PolicyRule store (shared with ExecutionPolicyEngine). One rule edit takes
// effect in BOTH paths (verified). Rules carry a `scope` column:
//   'both' (default) = legacy + gateway
//   'legacy' = ExecutionPolicyEngine only
//   'gateway' = IPolicyEnforcer only
//
// Per [AUDIT R-1]: IPolicyEnforcer egress scope is LLM provider-execution ONLY.
// Per [AUDIT R-12]: all refactors scope by type, never by method-name grep.

import type { PrismaClient } from '@prisma/client'
import type { AIRequest, ExecutionPolicy, RoutingCandidate, ToolDefinition } from '../core/types.js'
import type { CandidateInput, IPolicyEnforcer, IPolicyEvaluator, PolicyDecision } from './policy.js'

interface PolicyRuleRow {
  id: string
  name: string
  condition: string
  classification: string
  requiresApproval: number
  isActive: number
  scope: string // 'both' | 'legacy' | 'gateway'
}

/**
 * PolicyEvaluator that reads from the shared PolicyRule store.
 * Returns candidates with adjusted scores based on matching rules.
 */
export class StoreBackedPolicyEvaluator implements IPolicyEvaluator {
  constructor(private readonly prisma: PrismaClient) {}

  async scoreCandidates(
    _request: AIRequest,
    candidates: readonly CandidateInput[],
  ): Promise<readonly RoutingCandidate[]> {
    // Read rules scoped to 'gateway' or 'both'
    const rules = await this.readRules()
    return candidates.map(({ provider, model }) => {
      let score = 0.5
      const reasons: { factor: 'capability' | 'policy'; score: number; explanation?: string }[] = [
        { factor: 'capability', score, explanation: 'Base neutral score' },
      ]
      // Apply rules (simple: rules that match the provider kind adjust score)
      for (const rule of rules) {
        if (rule.classification === 'deny' && this.ruleMatches(rule, provider.id, model.id)) {
          score = 0
          reasons.push({ factor: 'policy', score: 0, explanation: `Rule ${rule.name} denies` })
          break
        }
        if (rule.classification === 'prefer' && this.ruleMatches(rule, provider.id, model.id)) {
          score += 0.2
          reasons.push({ factor: 'policy', score: 0.2, explanation: `Rule ${rule.name} prefers` })
        }
      }
      return { providerId: provider.id, modelId: model.id, score, reasons }
    })
  }

  async isEligible(request: AIRequest, candidate: CandidateInput): Promise<PolicyDecision> {
    const rules = await this.readRules()
    for (const rule of rules) {
      if (
        rule.classification === 'deny' &&
        this.ruleMatches(rule, candidate.provider.id, candidate.model.id)
      ) {
        return {
          allowed: false,
          reason: `Policy rule "${rule.name}" denies provider ${candidate.provider.id}`,
          code: 'POLICY_DENIED',
        }
      }
    }
    // Also check request-level policy
    if (request.policy?.excludedProviderIds?.includes(candidate.provider.id)) {
      return {
        allowed: false,
        reason: `Provider ${candidate.provider.id} excluded by request policy`,
        code: 'POLICY_DENIED',
      }
    }
    return { allowed: true }
  }

  private async readRules(): Promise<PolicyRuleRow[]> {
    const rows = await this.prisma.policyRule.findMany({
      where: {
        isActive: 1,
        scope: { in: ['both', 'gateway'] },
      },
    })
    return rows as unknown as PolicyRuleRow[]
  }

  private ruleMatches(rule: PolicyRuleRow, providerId: string, modelId: string): boolean {
    // Simple condition matching: condition is a substring match on providerId or modelId
    // (full rule engine is the existing ExecutionPolicyEngine's job; this is the gateway's view)
    const cond = rule.condition
    if (cond === '*') return true
    return providerId.includes(cond) || modelId.includes(cond)
  }
}

/**
 * PolicyEnforcer backed by the shared store. Hard-deny at egress for rules
 * scoped to 'gateway' or 'both'. Per [AUDIT R-1]: LLM provider-execution egress ONLY.
 */
export class StoreBackedPolicyEnforcer implements IPolicyEnforcer {
  constructor(private readonly prisma: PrismaClient) {}

  async enforceNetworkPolicy(policy: ExecutionPolicy, targetHost: string): Promise<PolicyDecision> {
    const network = policy.network ?? 'deny'
    if (network === 'deny') {
      return { allowed: false, reason: `Network deny for ${targetHost}`, code: 'POLICY_DENIED' }
    }
    if (network === 'localhost') {
      // Parse the host from the URL (targetHost may be a full URL like http://127.0.0.1:11434)
      let host = targetHost
      try {
        const url = new URL(targetHost)
        host = url.hostname
      } catch {
  // [audit] log the error with context here
        // Not a URL — use as-is
      }
      const isLocal =
        host === '127.0.0.1' ||
        host === 'localhost' ||
        host === '0.0.0.0' ||
        host === '[::1]' ||
        host === '::1'
      if (!isLocal)
        return { allowed: false, reason: `Non-localhost ${targetHost}`, code: 'POLICY_DENIED' }
      return { allowed: true }
    }
    if (network === 'allow-listed') {
      const allowed = policy.allowedNetworkHosts ?? []
      if (!allowed.some((h) => targetHost.includes(h))) {
        return { allowed: false, reason: `${targetHost} not in allow-list`, code: 'POLICY_DENIED' }
      }
      return { allowed: true }
    }
    return { allowed: true }
  }

  async enforceToolPolicy(policy: ExecutionPolicy, _tool: ToolDefinition): Promise<PolicyDecision> {
    if (policy.allowToolExecution === false) {
      return { allowed: false, reason: 'Tool execution disabled', code: 'POLICY_DENIED' }
    }
    return { allowed: true }
  }

  async enforcePersistencePolicy(
    policy: ExecutionPolicy,
    operation: 'read' | 'write' | 'delete',
  ): Promise<PolicyDecision> {
    if (policy.persistence === 'deny' && operation !== 'read') {
      return { allowed: false, reason: `Persistence deny for ${operation}`, code: 'POLICY_DENIED' }
    }
    return { allowed: true }
  }

  async enforceTelemetryPolicy(
    policy: ExecutionPolicy,
    payloadKind: 'metadata' | 'prompt' | 'output',
  ): Promise<PolicyDecision> {
    if (payloadKind === 'metadata' && policy.allowTelemetry === false) {
      return { allowed: false, reason: 'Telemetry disabled', code: 'POLICY_DENIED' }
    }
    if (
      (payloadKind === 'prompt' || payloadKind === 'output') &&
      policy.allowPromptLogging !== true
    ) {
      return { allowed: false, reason: `${payloadKind} logging not allowed`, code: 'POLICY_DENIED' }
    }
    return { allowed: true }
  }
}
