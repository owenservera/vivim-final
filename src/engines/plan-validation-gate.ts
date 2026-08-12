// src/engines/plan-validation-gate.ts
// Phase 2 — Plan Validation Gate.
// Pre-execution validation that enforces the ActionPlan contract.
// Runs BEFORE any side effect touches the system.

import type { ActionPlan, RISK_TIER } from './action-plan.js'

// ── Validation result ────────────────────────────────────────────────────

export interface PlanValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
}

// ── Gate configuration ───────────────────────────────────────────────────

export interface PlanValidationConfig {
  /** Maximum allowed risk tier. Default: 'B' (no D in deterministic plans). */
  maxRiskTier: RISK_TIER
  /** Require confirmation for destructive actions. Default: true. */
  requireConfirmationForDestructive: boolean
  /** Require all dependsOn to reference existing nodes. Default: true. */
  validateDependencyRefs: boolean
  /** Require at least one evidence type per node. Default: false (lenient). */
  requireEvidence: boolean
}

const DEFAULT_CONFIG: PlanValidationConfig = {
  maxRiskTier: 'B',
  requireConfirmationForDestructive: true,
  validateDependencyRefs: true,
  requireEvidence: false,
}

// ── PlanValidationGate ───────────────────────────────────────────────────

export class PlanValidationGate {
  private config: PlanValidationConfig

  constructor(config?: Partial<PlanValidationConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  /**
   * Validate an ActionPlan against the gate rules.
   * Returns structured validation result with errors and warnings.
   */
  validate(plan: ActionPlan): PlanValidationResult {
    const errors: string[] = []
    const warnings: string[] = []

    // 1. Required fields
    if (!plan.id) errors.push('Plan must have an id')
    if (!plan.goal) errors.push('Plan must have a goal')
    if (!plan.version) warnings.push('Plan should have a version')

    // 2. Nodes
    if (!plan.nodes || plan.nodes.length === 0) {
      errors.push('Plan must have at least one node')
      return { valid: false, errors, warnings }
    }

    const nodeIds = new Set(plan.nodes.map((n) => n.id))

    // 3. Cycle detection (topological sort)
    const inDegree = new Map<string, number>()
    const adjacency = new Map<string, string[]>()
    for (const node of plan.nodes) {
      inDegree.set(node.id, 0)
      adjacency.set(node.id, [])
    }
    for (const node of plan.nodes) {
      for (const dep of node.dependsOn ?? []) {
        if (!nodeIds.has(dep)) {
          if (this.config.validateDependencyRefs) {
            errors.push(`Node "${node.id}" depends on unknown node "${dep}"`)
          }
          continue
        }
        adjacency.get(dep)?.push(node.id)
        inDegree.set(node.id, (inDegree.get(node.id) ?? 0) + 1)
      }
    }

    const queue: string[] = []
    for (const [id, deg] of inDegree) {
      if (deg === 0) queue.push(id)
    }
    let visited = 0
    while (queue.length > 0) {
      const current = queue.shift()!
      visited++
      for (const next of adjacency.get(current) ?? []) {
        const newDeg = (inDegree.get(next) ?? 1) - 1
        inDegree.set(next, newDeg)
        if (newDeg === 0) queue.push(next)
      }
    }
    if (visited !== plan.nodes.length) {
      errors.push('Plan contains a dependency cycle')
    }

    // 4. Risk tier check
    if (plan.risk) {
      const tierOrder: RISK_TIER[] = ['A', 'B', 'C', 'D']
      const maxIdx = tierOrder.indexOf(this.config.maxRiskTier)
      const riskIdx = tierOrder.indexOf(plan.risk.tier)
      if (riskIdx > maxIdx) {
        errors.push(
          `Risk tier "${plan.risk.tier}" exceeds maximum allowed "${this.config.maxRiskTier}"`,
        )
      }
    }

    // 5. Per-node validation
    for (const node of plan.nodes) {
      if (!node.capability) {
        errors.push(`Node "${node.id}" must have a capability`)
      }
      if (!node.input || Object.keys(node.input).length === 0) {
        warnings.push(`Node "${node.id}" has no input parameters`)
      }
      // Confirmation required for destructive capabilities
      if (
        this.config.requireConfirmationForDestructive &&
        node.risk === 'destructive' &&
        !node.requiresConfirmation
      ) {
        warnings.push(
          `Node "${node.id}" has destructive risk but lacks requiresConfirmation`,
        )
      }
    }

    // 6. Evidence check
    if (this.config.requireEvidence) {
      for (const node of plan.nodes) {
        if (!node.evidence || node.evidence.length === 0) {
          warnings.push(`Node "${node.id}" has no evidence types`)
        }
      }
    }

    // 7. Confirmation check
    if (plan.requiresConfirmation && !plan.confirmationPrompt) {
      warnings.push('Plan requires confirmation but has no confirmationPrompt')
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    }
  }

  /**
   * Quick boolean check — is this plan safe to execute?
   */
  isSafe(plan: ActionPlan): boolean {
    return this.validate(plan).valid
  }
}
