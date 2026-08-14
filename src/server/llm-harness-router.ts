// src/server/llm-harness-router.ts
// Phase 7 of ROADMAP-REPROGRAMMABLE-CANVAS.md — LLM Harness Escalation.
//
// HTTP routes for the LLM harness agent.
//
// Routes:
//   POST /api/llm-harness/plan  — produce a plan (no apply)
//   POST /api/llm-harness/apply — apply a previously-confirmed plan
//   POST /api/llm-harness/escalate — convenience: produce + auto-apply (with
//                                     a confirmation token in the response;
//                                     the client must echo it back via /apply)
//
// The /plan route mints a confirmation token via the existing
// confirmation-store. The client must echo the token in the /apply request.
// The MutationExecutor then applies the plan with provenance: 'llm-harness'.
//
// CONTRACT_VERSION: 1

import { z } from 'zod'
import {
  type ConfirmationStore,
  InMemoryConfirmationStore,
} from '../engines/nlcl/confirmation-store.js'
import { getLogger } from '../lib/logger.js'
import { mutationExecutor } from '../reprogrammability/dsl/executor.js'
import { SurfaceMutationPlanSchema } from '../reprogrammability/mutation-schema.js'
import { appErrorResponse, errorResponse, json } from './response.js'

const log = getLogger('llm-harness-router')

// ── Singleton confirmation store (shared with NLCL via service-container
// in the full bootstrap; here we use the in-memory impl as a fallback) ─────────

let confirmationStore: ConfirmationStore | null = null
function getConfirmationStore(): ConfirmationStore {
  if (!confirmationStore) {
    confirmationStore = new InMemoryConfirmationStore()
  }
  return confirmationStore
}

/** Test helper: inject a custom confirmation store. */
export function __setConfirmationStoreForTest(store: ConfirmationStore | null): void {
  confirmationStore = store
}

// ── LLM harness agent (lazy singleton; tests can inject via __setAgentForTest) ──

import type { LlmHarnessAgent } from '../engines/reprogrammability/llm-harness-agent.js'

let agent: LlmHarnessAgent | null = null
let agentFactory: (() => LlmHarnessAgent) | null = null

/** Wire the agent factory (called during server bootstrap if an LLM provider is available). */
export function setLlmHarnessAgentFactory(factory: (() => LlmHarnessAgent) | null): void {
  agentFactory = factory
  agent = null
}

function getAgent(): LlmHarnessAgent | null {
  if (agent) return agent
  if (agentFactory) {
    agent = agentFactory()
    return agent
  }
  return null
}

/** Test helper: inject a custom agent. */
export function __setAgentForTest(a: LlmHarnessAgent | null): void {
  agent = a
}

// ── Schemas ──────────────────────────────────────────────────────────────────

const PlanInputSchema = z.object({
  userRequest: z.string().min(1).max(2000),
  surfaceFilter: z
    .object({
      kind: z.string().optional(),
      tags: z.array(z.string()).optional(),
      ids: z.array(z.string()).optional(),
    })
    .optional(),
  recentMutations: z
    .array(
      z.object({
        op: z.string(),
        target: z.string(),
        reason: z.string().optional(),
        appliedAt: z.number(),
      }),
    )
    .optional(),
})

const ApplyInputSchema = z.object({
  plan: SurfaceMutationPlanSchema,
  confirmationToken: z.string().min(1),
})

// ── Router ───────────────────────────────────────────────────────────────────

export function createLlmHarnessRouter() {
  return async function llmHarnessRouter(req: Request, url: URL): Promise<Response | null> {
    const path = url.pathname

    // ── POST /api/llm-harness/plan ──────────────────────────────────────────
    if (path === '/api/llm-harness/plan' && req.method === 'POST') {
      let body: unknown
      try {
        body = await req.json()
      } catch {
        return errorResponse('Invalid JSON body', 'ValidationError', 400)
      }

      const parsed = PlanInputSchema.safeParse(body)
      if (!parsed.success) {
        return errorResponse(
          `Invalid input: ${parsed.error.issues.map((i) => i.message).join('; ')}`,
          'ValidationError',
          400,
        )
      }

      const a = getAgent()
      if (!a) {
        return errorResponse(
          'LLM harness agent is not configured (no LLM provider available)',
          'NotAvailable',
          503,
        )
      }

      const result = await a.producePlan(parsed.data.userRequest, {
        recentMutations: parsed.data.recentMutations,
      })

      if (!result.ok || !result.plan) {
        return json(
          {
            ok: false,
            error: result.error,
            retries: result.retries,
            rawOutput: result.rawOutput,
          },
          500,
        )
      }

      // Mint a confirmation token. The user must echo it back via /apply.
      const store = getConfirmationStore()
      const confirmation = store.create({
        capabilityId: 'llm-harness:apply-plan',
        input: { planId: result.plan.id } as Record<string, unknown>,
        contextJson: JSON.stringify({ surface: 'ui' }),
        classification: 'llm-harness',
      })

      log.info(
        { planId: result.plan.id, mutationCount: result.plan.mutations.length },
        '[llm-harness-router] plan produced + confirmation minted',
      )

      return json({
        ok: true,
        plan: result.plan,
        confirmationToken: confirmation.token,
        expiresAt: confirmation.expiresAt,
        retries: result.retries,
        rawOutput: result.rawOutput,
      })
    }

    // ── POST /api/llm-harness/apply ─────────────────────────────────────────
    if (path === '/api/llm-harness/apply' && req.method === 'POST') {
      let body: unknown
      try {
        body = await req.json()
      } catch {
        return errorResponse('Invalid JSON body', 'ValidationError', 400)
      }

      const parsed = ApplyInputSchema.safeParse(body)
      if (!parsed.success) {
        return errorResponse(
          `Invalid input: ${parsed.error.issues.map((i) => i.message).join('; ')}`,
          'ValidationError',
          400,
        )
      }

      // Consume the confirmation token (one-shot).
      const store = getConfirmationStore()
      const confirmed = store.consume(parsed.data.confirmationToken)
      if (!confirmed) {
        return errorResponse('Invalid or expired confirmation token', 'ValidationError', 403)
      }

      // Verify the plan id matches.
      const confirmedPlanId = (confirmed.input as { planId?: string }).planId
      if (confirmedPlanId !== parsed.data.plan.id) {
        return errorResponse('Confirmation token does not match plan id', 'ValidationError', 403)
      }

      // Apply the plan via the executor.
      try {
        const result = await mutationExecutor.applyPlan(parsed.data.plan)
        log.info(
          { planId: parsed.data.plan.id, ok: result.ok, applied: result.records.length },
          '[llm-harness-router] plan applied',
        )
        return json({ ok: result.ok, result })
      } catch (err) {
        return appErrorResponse(err)
      }
    }

    // ── POST /api/llm-harness/escalate (convenience: plan + auto-apply) ─────
    // This is the same as /plan but immediately applies (still requiring the
    // confirmation token from the response). Useful for programmatic clients
    // that pre-confirm.
    if (path === '/api/llm-harness/escalate' && req.method === 'POST') {
      let body: unknown
      try {
        body = await req.json()
      } catch {
        return errorResponse('Invalid JSON body', 'ValidationError', 400)
      }

      const parsed = z
        .object({
          userRequest: z.string().min(1).max(2000),
          autoApply: z.boolean().default(false),
        })
        .safeParse(body)
      if (!parsed.success) {
        return errorResponse(
          `Invalid input: ${parsed.error.issues.map((i) => i.message).join('; ')}`,
          'ValidationError',
          400,
        )
      }

      const a = getAgent()
      if (!a) {
        return errorResponse('LLM harness agent is not configured', 'NotAvailable', 503)
      }

      const result = await a.producePlan(parsed.data.userRequest)
      if (!result.ok || !result.plan) {
        return errorResponse(result.error ?? 'Plan generation failed', 'ExecutionError', 500, {
          retries: result.retries,
        })
      }

      // Mint confirmation.
      const store = getConfirmationStore()
      const confirmation = store.create({
        capabilityId: 'llm-harness:apply-plan',
        input: { planId: result.plan.id } as Record<string, unknown>,
        contextJson: JSON.stringify({ surface: 'ui' }),
        classification: 'llm-harness',
      })

      if (!parsed.data.autoApply) {
        return json({
          ok: true,
          plan: result.plan,
          confirmationToken: confirmation.token,
          expiresAt: confirmation.expiresAt,
          retries: result.retries,
        })
      }

      // Auto-apply: consume the token immediately + apply.
      const consumed = store.consume(confirmation.token)
      if (!consumed) {
        return errorResponse(
          'Failed to consume freshly-minted confirmation token',
          'ValidationError',
          500,
        )
      }
      const applyResult = await mutationExecutor.applyPlan(result.plan)
      return json({
        ok: applyResult.ok,
        plan: result.plan,
        result: applyResult,
        retries: result.retries,
      })
    }

    return null
  }
}
