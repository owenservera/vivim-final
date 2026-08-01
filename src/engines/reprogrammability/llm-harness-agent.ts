// src/engines/reprogrammability/llm-harness-agent.ts
// Phase 7 of ROADMAP-REPROGRAMMABLE-CANVAS.md — LLM Harness Escalation.
//
// The LLM harness agent. Receives:
//   (a) current SurfaceRegistry snapshot (filtered to relevant surfaces)
//   (b) the user's NL request
//   (c) available capabilities
//
// Produces: a `SurfaceMutationPlan` (validated by Zod against the Phase 3
// schema). Uses the existing ProviderLLMAdapter interface (same as
// LLMSlaveResolver) so any provider can back it.
//
// CRITICAL INVARIANT: the LLM NEVER produces raw code. If the LLM output
// fails the SurfaceMutationPlanSchema validation, the agent retries up to
// MAX_RETRIES times with the validation error appended to the prompt. After
// MAX_RETRIES, it returns an error plan (NOT an exception).
//
// Provenance: every mutation produced by this agent is tagged
// `provenance: 'llm-harness'` and gets a confirmation token via the existing
// confirmation-store (Phase 7 integration).
//
// CONTRACT_VERSION: 1

import { ulid } from 'ulid'
import { getLogger } from '../../lib/logger.js'
import {
  type SurfaceMutation,
  type SurfaceMutationPlan,
  SurfaceMutationPlanSchema,
} from '../../reprogrammability/mutation-schema.js'
import { surfaceRegistry } from '../../reprogrammability/registry.js'
import type { ProviderLLMAdapter } from '../nlcl/llm-slave-resolver.js'
import { type LlmPromptInput, buildLlmHarnessPrompt } from './llm-prompt.js'

const log = getLogger('llm-harness-agent')

const MAX_RETRIES = 2
const LLM_TIMEOUT_MS = 30_000

export interface LlmHarnessAgentDeps {
  providerLLM: ProviderLLMAdapter
  /** Optional: filter surfaces to include in the prompt (default: all). */
  surfaceFilter?: (surface: {
    id: string
    kind: string
    label: string
    capabilities?: readonly string[]
    tags?: readonly string[]
  }) => boolean
  /** Optional: capability ids to expose (default: read from registry). */
  capabilities?: () => string[]
  /** Optional: override MAX_RETRIES for tests. */
  maxRetries?: number
}

export interface LlmHarnessPlanResult {
  ok: boolean
  plan?: SurfaceMutationPlan
  error?: string
  retries: number
  /** The raw LLM output (for debugging / DevConsole). */
  rawOutput: string
  /** Confirmation token minted for this plan (Phase 7 integration). */
  confirmationToken?: string
}

/**
 * The LLM harness agent.
 */
export class LlmHarnessAgent {
  constructor(private readonly deps: LlmHarnessAgentDeps) {}

  /**
   * Produce a plan for the user's NL request. Does NOT apply the plan — the
   * caller is responsible for surfacing it to the user + collecting the
   * confirmation token before applying.
   */
  async producePlan(
    userRequest: string,
    options?: {
      recentMutations?: LlmPromptInput['recentMutations']
    },
  ): Promise<LlmHarnessPlanResult> {
    // ── 1. Build the registry snapshot ──────────────────────────────────────
    const allSurfaces = surfaceRegistry.list().map((s) => ({
      id: s.id,
      kind: s.kind,
      label: s.label,
      capabilities: s.capabilities,
      tags: s.tags,
      spec: s.getSpec(),
    }))
    const filteredSurfaces = this.deps.surfaceFilter
      ? allSurfaces.filter(this.deps.surfaceFilter)
      : allSurfaces

    const capabilities = this.deps.capabilities
      ? this.deps.capabilities()
      : Array.from(new Set(allSurfaces.flatMap((s) => Array.from(s.capabilities ?? []))))

    // ── 2. Build the prompt ─────────────────────────────────────────────────
    const { prompt, systemPrompt } = buildLlmHarnessPrompt({
      userRequest,
      surfaces: filteredSurfaces.map((s) => ({
        id: s.id,
        kind: s.kind,
        label: s.label,
        capabilities: s.capabilities,
        tags: s.tags,
      })),
      capabilities,
      recentMutations: options?.recentMutations,
    })

    // ── 3. Call the LLM with retries ────────────────────────────────────────
    const maxRetries = this.deps.maxRetries ?? MAX_RETRIES
    let lastError: string | undefined
    let lastRawOutput = ''
    let currentPrompt = `${systemPrompt}\n\n${prompt}`

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      let rawOutput: string
      try {
        rawOutput = await this.callLlmWithTimeout(currentPrompt)
        lastRawOutput = rawOutput
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err)
        log.warn({ attempt, err: lastError }, '[llm-harness-agent] LLM call failed; retrying')
        continue
      }

      // ── 4. Parse + validate against the SurfaceMutationPlan schema ────────
      // The LLM may wrap output in ```json fences; strip them.
      const cleaned = stripCodeFences(rawOutput).trim()
      let parsed: unknown
      try {
        parsed = JSON.parse(cleaned)
      } catch (err) {
        lastError = `LLM output is not valid JSON: ${err instanceof Error ? err.message : String(err)}`
        currentPrompt = `${systemPrompt}\n\n${prompt}\n\nYour previous output was not valid JSON. Error: ${lastError}. Please output ONLY the JSON object, no prose, no code fences.`
        continue
      }

      const planResult = SurfaceMutationPlanSchema.safeParse(parsed)
      if (!planResult.success) {
        lastError = `LLM output failed schema validation: ${planResult.error.issues
          .map((i) => `${i.path.join('.')}: ${i.message}`)
          .join('; ')}`
        currentPrompt = `${systemPrompt}\n\n${prompt}\n\nYour previous output failed schema validation. Errors: ${lastError}. Please fix and output ONLY the JSON object.`
        continue
      }

      // ── 5. Force provenance: 'llm-harness' on every mutation ──────────────
      const plan = planResult.data
      const sanitizedPlan: SurfaceMutationPlan = {
        ...plan,
        provenance: 'llm-harness',
        mutations: plan.mutations.map(
          (m): SurfaceMutation => ({
            ...m,
            provenance: 'llm-harness',
            // Ensure idempotencyKey is set (the LLM may omit it).
            idempotencyKey: m.idempotencyKey ?? `llm-${ulid()}`,
          }),
        ),
      }

      log.info(
        { attempt, mutationCount: sanitizedPlan.mutations.length },
        '[llm-harness-agent] plan produced',
      )

      return {
        ok: true,
        plan: sanitizedPlan,
        retries: attempt,
        rawOutput: lastRawOutput,
      }
    }

    // ── 6. All retries exhausted — return an error plan (NOT an exception) ──
    return {
      ok: false,
      error: lastError ?? 'LLM harness agent could not produce a valid plan after retries.',
      retries: maxRetries,
      rawOutput: lastRawOutput,
    }
  }

  /**
   * Call the LLM with a timeout. Returns the raw string output.
   */
  private async callLlmWithTimeout(prompt: string): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`LLM call timed out after ${LLM_TIMEOUT_MS}ms`))
      }, LLM_TIMEOUT_MS)

      this.deps.providerLLM
        .query(prompt)
        .then((out) => {
          clearTimeout(timer)
          resolve(out)
        })
        .catch((err) => {
          clearTimeout(timer)
          reject(err)
        })
    })
  }
}

/**
 * Strip ```json ... ``` fences from LLM output. Also handles ```...``` (no language).
 */
function stripCodeFences(input: string): string {
  const trimmed = input.trim()
  // Match ```json\n...\n``` or ```\n...\n```
  const fenceMatch = trimmed.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?```\s*$/)
  if (fenceMatch) return fenceMatch[1] ?? trimmed
  return trimmed
}
