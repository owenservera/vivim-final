// src/engines/policy-engine.ts
// P0PolicyEngine — deterministic policy for the execution kernel.
// Evaluates ActionPlans against risk classification and confirmation state.
// This is NOT the same as ExecutionPolicyEngine (which is rule-based for autonomous execution).
//
// Hard constraints:
//  - Policy is deterministic — never calls an LLM.
//  - Destructive actions cannot be model-authorized by prose alone.
//  - Financial operations have explicit policy.
//  - Communication sends are confirmed.
//  - No silent destructive retries.

import type { ActionPlan, CapabilityRisk } from './action-plan.js'
import type { PolicyDecision } from './execution-kernel.js'

// ── Options ──────────────────────────────────────────────────────────────

export interface P0PolicyEngineOptions {
  /** Allow destructive operations (delete, purge, format, etc.). Default: false. */
  allowDestructive?: boolean
  /** Allow financial operations (purchase, pay, transfer, etc.). Default: false. */
  allowFinancial?: boolean
  /** Allow communication sends (email, message, post, etc.). Default: false. */
  allowCommunication?: boolean
  /** Allow security-sensitive operations. Default: false. */
  allowSecuritySensitive?: boolean
  /** Risk tier threshold (0-4). Operations above this tier are blocked. Default: 3 (blocks security_sensitive). */
  maxRiskTier?: number
}

// ── Risk Tier Mapping ────────────────────────────────────────────────────

const RISK_TIER: Record<CapabilityRisk, number> = {
  read: 0,
  reversible_write: 1,
  external_communication: 2,
  destructive: 3,
  security_sensitive: 4,
}

// ── P0PolicyEngine ───────────────────────────────────────────────────────

export class P0PolicyEngine {
  private readonly opts: Required<P0PolicyEngineOptions>

  constructor(opts: P0PolicyEngineOptions = {}) {
    this.opts = {
      allowDestructive: opts.allowDestructive ?? false,
      allowFinancial: opts.allowFinancial ?? false,
      allowCommunication: opts.allowCommunication ?? false,
      allowSecuritySensitive: opts.allowSecuritySensitive ?? false,
      maxRiskTier: opts.maxRiskTier ?? 3,
    }
  }

  /**
   * Evaluate an ActionPlan against policy.
   * Returns PolicyDecision — allowed or denied with reason.
   */
  evaluate(plan: ActionPlan): PolicyDecision {
    // Check each node's risk against policy
    for (const node of plan.nodes) {
      const decision = this.evaluateNodeRisk(node.risk)
      if (!decision.allowed) {
        return decision
      }
    }

    // Determine if confirmation is required based on risk tier
    const requiresConfirmation = plan.nodes.some(
      (n) => RISK_TIER[n.risk] >= 2 || n.requiresConfirmation,
    )

    return { allowed: true, requiresConfirmation }
  }

  private evaluateNodeRisk(risk: CapabilityRisk): PolicyDecision {
    const tier = (RISK_TIER as Record<string, number | undefined>)[risk]

    // Fail closed: an unrecognized risk classification must be denied, not
    // silently allowed via a permissive default.
    if (tier === undefined) {
      return {
        allowed: false,
        reason: `Refusing to authorize unrecognized risk classification: ${String(risk)}`,
      }
    }

    // Check specific risk categories. An explicit category allow makes the flag
    // functional (previously `allowFinancial` was dead — financial ops are mapped
    // to `security_sensitive`, so `allowFinancial` is honored as an alternative
    // gate for them — and `allowSecuritySensitive` was vetoed by the threshold
    // below; now an explicit allow overrides the threshold for that category).
    switch (risk) {
      case 'destructive':
        if (!this.opts.allowDestructive) {
          return { allowed: false, reason: 'Destructive action is disabled by policy' }
        }
        break
      case 'external_communication':
        if (!this.opts.allowCommunication) {
          return { allowed: false, reason: 'Communication action is disabled by policy' }
        }
        break
      case 'security_sensitive':
        // Financial operations are classified here too; either flag permits them.
        if (!this.opts.allowSecuritySensitive && !this.opts.allowFinancial) {
          return { allowed: false, reason: 'Security-sensitive/financial action is disabled by policy' }
        }
        // Explicit allow overrides the numeric threshold for this category.
        return { allowed: true, requiresConfirmation: true }
    }

    // Threshold as the default cap for the remaining (non-explicitly-allowed)
    // categories. `maxRiskTier` still bounds destructive/read/write/communication.
    if (tier > this.opts.maxRiskTier) {
      return {
        allowed: false,
        reason: `Risk tier ${tier} exceeds maximum allowed (${this.opts.maxRiskTier})`,
      }
    }

    return { allowed: true, requiresConfirmation: false }
  }
}
