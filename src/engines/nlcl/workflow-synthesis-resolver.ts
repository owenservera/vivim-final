// src/engines/nlcl/workflow-synthesis-resolver.ts
// Tier 4 unit 16.7 — WorkflowSynthesisResolver.
//
// Closes audit finding ❌-13: the upgrade design doc proposed an LLM-driven
// workflow synthesizer but didn't constrain the LLM output to the actual
// capability registry's input schemas. This caused silent failures when the
// LLM produced a workflow with:
//   • A capabilityId that doesn't exist in the registry.
//   • An input that doesn't match the capability's inputSchema.
//   • A destructive capability (e.g. conversation.delete) WITHOUT going
//     through the ConfirmationStore — the audit explicitly requires workflows
//     to ALWAYS route through confirmation.
//
// Architecture:
//   • Takes a high-level user goal ("summarize my last 3 conversations and
//     email the summary to john@example.com").
//   • Asks the LLM to produce a WorkflowSpec — a list of (capabilityId, input)
//     steps.
//   • Validates EACH step against the live UnifiedCapabilityRegistry:
//     - capabilityId must exist
//     - input must safeParse against the capability's inputSchema
//   • Rejects any workflow containing an unregistered capability or invalid input.
//   • ALWAYS returns a ParsedIntent that requiresConfirmation=true, even if no
//     individual step is destructive — composing capabilities can have
//     emergent side effects the user didn't anticipate.
//   • Stores the synthesized workflow in the ConfirmationStore so the user's
//     "yes" can rehydrate and execute it.
//
// This resolver is OPT-IN — the engine only invokes it when the user's input
// matches a workflow-synthesis pattern (e.g. starts with "automate", "build
// a workflow", "do these things in sequence") OR when the layered resolver
// fails to find a single-capability match for a multi-action input.

import { z } from 'zod'
import type { ConfirmationStore } from './confirmation-store.js'
import type { NLCContext, ParsedIntent } from './types.js'

// ── Workflow Schema ───────────────────────────────────────────────────────

export const WorkflowStepSchema = z.object({
  capabilityId: z.string().min(1),
  input: z.record(z.string(), z.unknown()),
  /** Optional human-readable label for the step. */
  label: z.string().optional(),
})

export const WorkflowSpecSchema = z.object({
  steps: z.array(WorkflowStepSchema).min(1).max(10),
  /** Join strategy: sequential = wait for each step; parallel = all at once. */
  joinStrategy: z.enum(['sequential', 'parallel']).default('sequential'),
  /** Optional human-readable summary of the workflow. */
  summary: z.string().optional(),
})

export type WorkflowSpec = z.infer<typeof WorkflowSpecSchema>
export type WorkflowStep = z.infer<typeof WorkflowStepSchema>

// ── Resolver ──────────────────────────────────────────────────────────────

export interface WorkflowSynthesisResolverDeps {
  /** LLM adapter — receives the synthesis prompt, returns JSON. */
  llm: {
    query(prompt: string): Promise<string>
  }
  /** The capability registry — used to validate LLM output. */
  registry: {
    list(): Array<{
      id: string
      description: string | null
      inputSchema: { safeParse: (v: unknown) => { success: boolean; data?: unknown } }
      requiresConfirmation: boolean
    }>
    get(id: string):
      | {
          id: string
          description: string | null
          inputSchema: { safeParse: (v: unknown) => { success: boolean; data?: unknown } }
          requiresConfirmation: boolean
        }
      | undefined
  }
  /** ConfirmationStore — synthesized workflows ALWAYS route through confirmation. */
  confirmationStore: ConfirmationStore
  /** Optional harness-repair engine for LLM JSON output (audit 🚀-26). */
  repairEngine?: {
    repair(input: {
      content: string
      schema: { parse: (v: unknown) => { success: boolean; data?: unknown } }
    }): Promise<{ ok: boolean; data?: unknown; repairs: string[]; errors: string[] }>
  }
  /** Optional budget guard (audit 🚀-22). */
  budgetGuard?: {
    checkBeforeRequest(): void
    accrue(costCents: number, tokens: number): Promise<void>
  }
}

/** Patterns that trigger workflow synthesis. */
const WORKFLOW_TRIGGER_PATTERNS = [
  /^(?:automate|build\s+a\s+workflow|create\s+a\s+workflow|make\s+a\s+workflow)\b/i,
  /^(?:do\s+these\s+things|do\s+the\s+following)\b/i,
  /^(?:workflow|chain|sequence)\s*:/i,
  /\bthen\s+send\b.*\bthen\s+/i, // multi-step with explicit send
]

export class WorkflowSynthesisResolver {
  readonly name = 'workflow-synthesis'
  private deps: WorkflowSynthesisResolverDeps

  constructor(deps: WorkflowSynthesisResolverDeps) {
    this.deps = deps
  }

  /** Check if raw input looks like a workflow synthesis request. */
  isWorkflowRequest(rawInput: string): boolean {
    return WORKFLOW_TRIGGER_PATTERNS.some((re) => re.test(rawInput))
  }

  async resolve(rawInput: string, ctx: NLCContext): Promise<ParsedIntent | null> {
    // ── Tier 5 🚀-22: budget guard ──────────────────────────────────────────
    if (this.deps.budgetGuard) {
      try {
        this.deps.budgetGuard.checkBeforeRequest()
      } catch {
        // Budget exceeded — bail out, let the regular resolver handle it.
        return null
      }
    }

    const prompt = this.buildPrompt(rawInput)
    let response: string
    try {
      response = await this.deps.llm.query(prompt)
    } catch {
      return null
    }

    // ── Tier 3 unit 15.7 🚀-26: harness-repair ──────────────────────────────
    const spec = await this.parseAndValidate(response, rawInput)
    if (!spec) return null

    // Accrue cost estimate.
    if (this.deps.budgetGuard) {
      try {
        await this.deps.budgetGuard.accrue(2, 1000) // workflow synthesis is ~2x a single resolve
      } catch {
        // Best-effort.
      }
    }

    // ── Audit ❌-13 fix: ALWAYS route through ConfirmationStore ────────────
    // Even if no individual step is destructive, the COMPOSITION may have
    // emergent side effects. Mandatory confirmation.
    const pending = this.deps.confirmationStore.create({
      capabilityId: 'workflow.synthesize',
      input: { spec } as Record<string, unknown>,
      contextJson: JSON.stringify(ctx),
      classification: 'destructive', // always destructive-by-default for workflows
    })

    return {
      patternId: 'workflow-synthesis',
      intent: 'workflow.synthesize',
      input: { spec, confirmationToken: pending.token } as Record<string, unknown>,
      confidence: 0.9,
      rawInput,
      matchedPattern: 'workflow-synthesis',
      alternatives: [],
      resolvedAt: Date.now(),
      capabilityId: 'workflow.synthesize',
      classification: 'destructive',
    }
  }

  private buildPrompt(rawInput: string): string {
    const catalog = this.deps.registry.list()
    const catalogStr = catalog
      .map((c) => {
        const desc = c.description ?? c.id
        return `  - "${c.id}": ${desc}`
      })
      .join('\n')

    return `You are a workflow synthesizer. Given a user's high-level goal, decompose it into a sequence of capabilities from the catalog.

Respond ONLY as JSON matching this schema:
{
  "steps": [{ "capabilityId": "<id>", "input": {<params>}, "label": "<optional>" }],
  "joinStrategy": "sequential" | "parallel",
  "summary": "<optional human-readable summary>"
}

Rules:
- Each capabilityId MUST exist in the catalog below.
- Each step's input MUST match the capability's inputSchema.
- Use 1-10 steps. Prefer fewer.
- Use "sequential" unless steps are independent.
- If the goal can be achieved with a single capability, use a 1-step workflow.

Catalog:
${catalogStr}

User goal: "${rawInput}"

JSON:`
  }

  /**
   * Parse and validate the LLM response against the ACTUAL registry.
   * Returns null if any step references an unregistered capability or has
   * invalid input (audit ❌-13 fix).
   */
  private async parseAndValidate(response: string, rawInput: string): Promise<WorkflowSpec | null> {
    const jsonMatch = response.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return null
    const rawJson = jsonMatch[0]

    let parsed: unknown
    if (this.deps.repairEngine) {
      try {
        const result = await this.deps.repairEngine.repair({
          content: rawJson,
          schema: WorkflowSpecSchema as unknown as {
            parse: (v: unknown) => { success: boolean; data?: unknown }
          },
        })
        if (!result.ok || !result.data) return null
        parsed = result.data
      } catch {
        // Fall back to direct parse.
        try {
          parsed = JSON.parse(rawJson)
        } catch {
          return null
        }
      }
    } else {
      try {
        parsed = JSON.parse(rawJson)
      } catch {
        return null
      }
    }

    // Validate against the workflow schema first.
    const workflowResult = WorkflowSpecSchema.safeParse(parsed)
    if (!workflowResult.success) {
      return null
    }
    const spec = workflowResult.data

    // ── Audit ❌-13 fix: validate EACH step against the live registry ──────
    for (const step of spec.steps) {
      const cap = this.deps.registry.get(step.capabilityId)
      if (!cap) {
        // Unregistered capability — reject the entire workflow.
        return null
      }
      const inputResult = cap.inputSchema.safeParse(step.input)
      if (!inputResult.success) {
        // Invalid input for this capability — reject.
        return null
      }
    }

    return spec
  }
}
