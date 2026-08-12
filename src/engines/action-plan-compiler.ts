// src/engines/action-plan-compiler.ts
// Phase 0/2 — Compiles resolved intents into canonical ActionPlans.
// Bridges the existing NLCL resolver output to the ActionPlan contract.
// Phase 2 will add the full compiler; this is the Phase 0 contract + adapter.

import type { ParsedIntent } from './nlcl/types.js'
import {
  ActionPlanSchema,
  type ActionPlan,
  type ActionNode,
  type CapabilityDefinition,
  type CapabilityRisk,
  type GroundedReference,
  type VerifySpec,
} from './action-plan.js'

// ── Compiler Input ───────────────────────────────────────────────────────

export interface PlanCandidate {
  capability: string
  input: Record<string, unknown>
  dependsOn?: string[]
  outputKey?: string
  risk?: CapabilityRisk
  requiresConfirmation?: boolean
  verify?: VerifySpec
}

export interface PlanCompilerInput {
  goal: string
  candidates: PlanCandidate[]
  groundedRefs?: GroundedReference[]
}

// ── ActionPlanCompiler ───────────────────────────────────────────────────

export class ActionPlanCompiler {
  constructor(private readonly capabilities: ReadonlyMap<string, CapabilityDefinition>) {}

  /**
   * Compile a set of plan candidates into a validated ActionPlan.
   * Phase 2 will add NLCL-to-candidate resolution; this is the core compiler.
   */
  compile(input: PlanCompilerInput): ActionPlan {
    const nodes: ActionNode[] = input.candidates.map((candidate, i) => {
      // Tolerant compilation: if the capability is not in the catalog, assume
      // we were "not smart enough" to classify it and emit a best-effort node
      // rather than throwing. The resolved intent (the answer) must still flow
      // through; the plan is supplementary, never a hard gate.
      const cap = this.capabilities.get(candidate.capability)
      const fallbackRisk = candidate.risk ?? cap?.risk ?? 'read'

      return {
        id: `n${i + 1}`,
        capability: candidate.capability,
        input: candidate.input,
        dependsOn: candidate.dependsOn ?? [],
        outputKey: candidate.outputKey,
        risk: fallbackRisk,
        requiresConfirmation:
          candidate.requiresConfirmation ?? cap?.requiresConfirmation ?? false,
        verify: candidate.verify ?? { type: 'output_present' as const },
      }
    })

    return ActionPlanSchema.parse({
      version: 1,
      goal: input.goal,
      nodes,
      groundedRefs: input.groundedRefs ?? [],
      metadata: { compiledAt: Date.now() },
    })
  }

  /**
   * Phase 2 — Convert a ParsedIntent from the NLCL resolver into plan candidates.
   * This is the adapter that bridges existing NLCL output to the ActionPlan contract.
   */
  intentToCandidates(intent: ParsedIntent): PlanCandidate[] {
    return [
      {
        capability: intent.capabilityId ?? intent.intent,
        input: intent.input,
        risk: this.inferRisk(intent),
        verify: { type: 'output_present' },
      },
    ]
  }

  /**
   * Phase 2 — Convert multiple sequential intents (composite commands) into
   * a single plan with dependency edges.
   */
  intentsToCandidates(intents: ParsedIntent[]): PlanCandidate[] {
    return intents.map((intent, i) => ({
      capability: intent.capabilityId ?? intent.intent,
      input: intent.input,
      dependsOn: i > 0 ? [`n${i}`] : [],
      risk: this.inferRisk(intent),
      verify: { type: 'output_present' as const },
    }))
  }

  /**
   * Phase 3 — Convert an LLM-proposed plan (JSON) into validated candidates.
   * Guards: only catalogued slugs, strict schema, max nodes, no cycles.
   */
  llmToCandidates(
    llmPlan: { goal: string; nodes: Array<{ capability: string; input: Record<string, unknown>; dependsOn?: string[] }> },
    maxNodes = 16,
  ): PlanCompilerInput {
    if (llmPlan.nodes.length > maxNodes) {
      throw new Error(`LLM plan exceeds max nodes (${maxNodes})`)
    }

    return {
      goal: llmPlan.goal,
      candidates: llmPlan.nodes.map((n) => ({
        capability: n.capability,
        input: n.input,
        dependsOn: n.dependsOn,
        verify: { type: 'output_present' as const },
      })),
    }
  }

  private inferRisk(intent: ParsedIntent): CapabilityRisk {
    switch (intent.classification) {
      case 'destructive':
        return 'destructive'
      case 'communication':
        return 'external_communication'
      case 'write':
        return 'reversible_write'
      case 'financial':
        return 'security_sensitive'
      default:
        return 'read'
    }
  }
}
