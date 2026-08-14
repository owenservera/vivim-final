// src/engines/action-plan.ts
// Phase 0 — Canonical ActionPlan contract.
// Single typed plan that every NLCL intent, browser automation, and LLM proposal
// compiles into. No separate schemas for NL commands, automation, or recipes.
//
// Rules:
//  - Every capability slug must exist in the UnifiedCapabilityRegistry.
//  - Every input must pass the capability's Zod/JSON-Schema validation.
//  - Dependencies must form an acyclic graph.
//  - Policy must approve risk level.
//  - Unknown fields are rejected.
//  - The executor owns actual side effects.

import { z } from 'zod'

// ── Risk Levels ──────────────────────────────────────────────────────────

export const CapabilityRiskSchema = z.enum([
  'read',
  'reversible_write',
  'external_communication',
  'destructive',
  'security_sensitive',
])

export type CapabilityRisk = z.infer<typeof CapabilityRiskSchema>

/** Numeric risk tier used by the policy gate (0 = safe, 4 = security-sensitive). */
export const RISK_TIER: Record<CapabilityRisk, number> = {
  read: 0,
  reversible_write: 1,
  external_communication: 2,
  destructive: 3,
  security_sensitive: 4,
}

// ── Verification ─────────────────────────────────────────────────────────

export const VerifyTypeSchema = z.enum([
  'none',
  'output_present',
  'state_changed',
  'file_exists',
  'file_absent',
  'url_matches',
  'text_present',
  'element_visible',
  'element_absent',
  'custom',
])

export type VerifyType = z.infer<typeof VerifyTypeSchema>

export const VerifySpecSchema = z.object({
  type: VerifyTypeSchema.default('none'),
  value: z.string().optional(),
  timeout: z.number().int().nonnegative().optional(),
})

export type VerifySpec = z.infer<typeof VerifySpecSchema>

// ── Execution Evidence ───────────────────────────────────────────────────

export const ExecutionEvidenceSchema = z.object({
  nodeId: z.string(),
  capability: z.string(),
  startedAt: z.number(),
  completedAt: z.number().optional(),
  ok: z.boolean().optional(),
  output: z.unknown().optional(),
  error: z.string().optional(),
  verificationPassed: z.boolean().optional(),
})

export type ExecutionEvidence = z.infer<typeof ExecutionEvidenceSchema>

// ── Grounded Reference ───────────────────────────────────────────────────

/** A reference resolved from natural language against the live context fabric. */
export const GroundedReferenceSchema = z.object({
  raw: z.string(),
  resolvedType: z.enum([
    'entity',
    'file',
    'url',
    'conversation',
    'email',
    'browser_element',
    'memory',
    'project',
    'workspace',
    'unknown',
  ]),
  resolvedId: z.string().optional(),
  resolvedValue: z.string().optional(),
  confidence: z.number().min(0).max(1).default(1),
  source: z.enum(['context', 'dialogue', 'semantic_search', 'llm', 'explicit']).default('explicit'),
})

export type GroundedReference = z.infer<typeof GroundedReferenceSchema>

// ── Action Node ──────────────────────────────────────────────────────────

export const ActionNodeSchema = z.object({
  id: z.string().min(1),
  capability: z.string().min(1),
  input: z.record(z.string(), z.unknown()).default({}),
  dependsOn: z.array(z.string()).default([]),
  outputKey: z.string().optional(),
  risk: CapabilityRiskSchema.default('read'),
  requiresConfirmation: z.boolean().default(false),
  verify: VerifySpecSchema.default({ type: 'none' }),
})

export type ActionNode = z.infer<typeof ActionNodeSchema>

// ── Action Plan ──────────────────────────────────────────────────────────

export const ActionPlanSchema = z.object({
  version: z.literal(1),
  goal: z.string().min(1),
  nodes: z.array(ActionNodeSchema).min(1).max(32),
  groundedRefs: z.array(GroundedReferenceSchema).default([]),
  metadata: z.record(z.string(), z.unknown()).default({}),
})

export type ActionPlan = z.infer<typeof ActionPlanSchema>

// ── Capability Definition (for validation) ───────────────────────────────

export interface CapabilityDefinition {
  slug: string
  /** Optional display name — used by the bridge for human-readable plan goals. */
  name?: string
  description: string
  risk: CapabilityRisk
  inputSchema: z.ZodType
  requiresConfirmation?: boolean
}

// ── Validation ───────────────────────────────────────────────────────────

export class ActionPlanValidationError extends Error {
  constructor(
    message: string,
    public readonly details: { nodeId?: string; field?: string; cause?: string } = {},
  ) {
    super(message)
    this.name = 'ActionPlanValidationError'
  }
}

/**
 * Validate an ActionPlan against a capability catalog.
 * Throws ActionPlanValidationError on any violation.
 */
export function validateActionPlan(
  plan: unknown,
  capabilities: ReadonlyMap<string, CapabilityDefinition>,
): ActionPlan {
  const parsed = ActionPlanSchema.parse(plan)
  const ids = new Set<string>()

  for (const node of parsed.nodes) {
    if (ids.has(node.id)) {
      throw new ActionPlanValidationError(`Duplicate action node id: ${node.id}`, {
        nodeId: node.id,
        field: 'id',
      })
    }
    ids.add(node.id)

    const cap = capabilities.get(node.capability)
    if (!cap) {
      throw new ActionPlanValidationError(`Unknown capability: ${node.capability}`, {
        nodeId: node.id,
        field: 'capability',
      })
    }

    // Validate input against the capability's Zod schema
    const inputResult = cap.inputSchema.safeParse(node.input)
    if (!inputResult.success) {
      throw new ActionPlanValidationError(
        `Input validation failed for ${node.capability}: ${inputResult.error.message}`,
        { nodeId: node.id, field: 'input', cause: inputResult.error.message },
      )
    }

    // Risk must match the capability definition
    if (node.risk !== cap.risk) {
      throw new ActionPlanValidationError(
        `Risk mismatch for ${node.capability}: plan says "${node.risk}", capability defines "${cap.risk}"`,
        { nodeId: node.id, field: 'risk' },
      )
    }

    // Confirmation must be requested if capability requires it
    if (cap.requiresConfirmation && !node.requiresConfirmation) {
      throw new ActionPlanValidationError(
        `Confirmation required for ${node.capability} but not requested in plan`,
        { nodeId: node.id, field: 'requiresConfirmation' },
      )
    }

    // Self-dependency check
    for (const dep of node.dependsOn) {
      if (dep === node.id) {
        throw new ActionPlanValidationError(`Self dependency: ${node.id}`, {
          nodeId: node.id,
          field: 'dependsOn',
        })
      }
    }
  }

  assertAcyclic(parsed.nodes)
  return parsed
}

/** Assert that the dependency graph has no cycles. */
function assertAcyclic(nodes: readonly ActionNode[]): void {
  const graph = new Map(nodes.map((n) => [n.id, n.dependsOn]))
  const visiting = new Set<string>()
  const visited = new Set<string>()

  const visit = (id: string): void => {
    if (visiting.has(id)) {
      throw new ActionPlanValidationError(`Action plan cycle detected at node: ${id}`, {
        nodeId: id,
        field: 'dependsOn',
      })
    }
    if (visited.has(id)) return

    visiting.add(id)
    for (const dep of graph.get(id) ?? []) {
      if (!graph.has(dep)) {
        throw new ActionPlanValidationError(`Unknown dependency: ${dep}`, {
          nodeId: id,
          field: 'dependsOn',
        })
      }
      visit(dep)
    }
    visiting.delete(id)
    visited.add(id)
  }

  for (const id of graph.keys()) visit(id)
}

/**
 * Compute the topological execution order of a validated plan.
 * Returns node ids in dependency-safe order.
 */
export function topologicalOrder(nodes: readonly ActionNode[]): string[] {
  const inDegree = new Map<string, number>()
  const adjacency = new Map<string, string[]>()

  for (const node of nodes) {
    inDegree.set(node.id, node.dependsOn.length)
    for (const dep of node.dependsOn) {
      if (!adjacency.has(dep)) adjacency.set(dep, [])
      adjacency.get(dep)?.push(node.id)
    }
  }

  const queue: string[] = []
  for (const [id, deg] of inDegree) {
    if (deg === 0) queue.push(id)
  }

  const order: string[] = []
  while (queue.length > 0) {
    const id = queue.shift()!
    order.push(id)
    for (const next of adjacency.get(id) ?? []) {
      const deg = (inDegree.get(next) ?? 1) - 1
      inDegree.set(next, deg)
      if (deg === 0) queue.push(next)
    }
  }

  return order
}

/**
 * Check if a plan has any nodes requiring confirmation.
 */
export function requiresConfirmation(plan: ActionPlan): boolean {
  return plan.nodes.some((n) => n.requiresConfirmation)
}

/**
 * Get the maximum risk tier across all nodes in a plan.
 */
export function maxRiskTier(plan: ActionPlan): number {
  return Math.max(...plan.nodes.map((n) => RISK_TIER[n.risk] ?? 0))
}
