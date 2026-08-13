// src/engines/action-plan-bridge.ts
// Phase 2 — ActionPlan Bridge.
// Converts ParsedIntent → ActionPlan via the compiler,
// then attaches the plan + grounded refs to CommandResult.
// This is the thin layer between NLCL resolution and execution.

import type { ActionPlan, CapabilityDefinition, GroundedReference } from './action-plan.js'
import { ActionPlanCompiler } from './action-plan-compiler.js'
import type { NLCContext, ParsedIntent } from './nlcl/types.js'
import { ReferenceGroundingEngine } from './reference-grounding.js'

// ── Result wrapper ───────────────────────────────────────────────────────

export interface PlanResult {
  plan: ActionPlan | null
  groundedRefs: GroundedReference[]
  validationError?: string
}

// ── Default capability definitions ───────────────────────────────────────
// Minimal catalog for deterministic intent → plan compilation.
// When the full UnifiedCapabilityRegistry is available, it should be
// passed in as the `capabilities` map instead.

const DEFAULT_CAPABILITIES = new Map<string, CapabilityDefinition>()

function registerDefaultCaps() {
  const caps: Array<[string, CapabilityDefinition]> = [
    ['cap:browser:open_url', { name: 'Open URL', risk: 'read', requiresConfirmation: false }],
    ['cap:browser:navigate', { name: 'Navigate', risk: 'read', requiresConfirmation: false }],
    ['cap:browser:click', { name: 'Click', risk: 'read', requiresConfirmation: false }],
    ['cap:browser:type', { name: 'Type', risk: 'read', requiresConfirmation: false }],
    ['cap:browser:scroll', { name: 'Scroll', risk: 'read', requiresConfirmation: false }],
    ['cap:browser:screenshot', { name: 'Screenshot', risk: 'read', requiresConfirmation: false }],
    [
      'cap:browser:close_tab',
      { name: 'Close Tab', risk: 'reversible_write', requiresConfirmation: true },
    ],
    ['cap:browser:summarize', { name: 'Summarize', risk: 'read', requiresConfirmation: false }],
    [
      'cap:conversation:send_message',
      { name: 'Send Message', risk: 'external_communication', requiresConfirmation: false },
    ],
    [
      'cap:conversation:create',
      { name: 'Create Conversation', risk: 'reversible_write', requiresConfirmation: false },
    ],
    ['cap:system:help', { name: 'Help', risk: 'read', requiresConfirmation: false }],
  ]
  for (const [id, def] of caps) {
    DEFAULT_CAPABILITIES.set(id, def)
  }
}
registerDefaultCaps()

// ── ActionPlanBridge ─────────────────────────────────────────────────────

export class ActionPlanBridge {
  private compiler: ActionPlanCompiler
  private grounder: ReferenceGroundingEngine

  constructor(compiler?: ActionPlanCompiler, grounder?: ReferenceGroundingEngine) {
    this.compiler = compiler ?? new ActionPlanCompiler(DEFAULT_CAPABILITIES)
    this.grounder = grounder ?? new ReferenceGroundingEngine()
  }

  /**
   * Produce an ActionPlan from a resolved ParsedIntent.
   * Returns null if the intent cannot be represented as a plan
   * (e.g. unresolved or composite).
   */
  intentToPlan(intent: ParsedIntent, ctx: NLCContext): PlanResult {
    // Ground entity references from the raw input
    const groundedRefs = this.grounder.ground(intent.rawInput, ctx)

    // Skip unresolved intents — no plan to compile
    if (intent.intent === 'unresolved' || intent.patternId === 'unresolved') {
      return { plan: null, groundedRefs }
    }

    // Convert intent → candidates → compile. Defensive: plan production is
    // supplementary — if it fails for any reason, return no plan rather than
    // breaking the command's actual execution.
    try {
      const candidates = this.compiler.intentToCandidates(intent)
      const plan = this.compiler.compile({
        goal: intent.rawInput,
        candidates,
        groundedRefs,
      })
      return { plan, groundedRefs }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return { plan: null, groundedRefs, validationError: message }
    }
  }

  /**
   * Produce a multi-step ActionPlan from multiple resolved intents.
   * Used for composite/multi-step commands.
   */
  intentsToPlan(intents: ParsedIntent[], ctx: NLCContext): PlanResult {
    const groundedRefs = this.grounder.ground(intents.map((i) => i.rawInput).join(' '), ctx)

    // Defensive: plan production is supplementary for composite commands too.
    try {
      const candidates = this.compiler.intentsToCandidates(intents)
      const plan = this.compiler.compile({
        goal: intents.map((i) => i.rawInput).join(' + '),
        candidates,
        groundedRefs,
      })
      return { plan, groundedRefs }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return { plan: null, groundedRefs, validationError: message }
    }
  }

  /**
   * Resolve a specific reference in a plan's dependency chain.
   */
  resolveDependency(
    ref: string,
    ctx: NLCContext,
    existingRefs: GroundedReference[],
  ): GroundedReference | null {
    return this.grounder.resolveReference(ref, ctx, existingRefs)
  }
}
