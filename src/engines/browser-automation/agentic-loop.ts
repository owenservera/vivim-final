// src/engines/browser-automation/agentic-loop.ts
// AgenticLoopEngine (SOTA-03) — Sense → Plan → Act → Observe → Reflect → Adapt.
// Objective-agnostic: the "brains" (planning + LLM ranking) are injected as a
// planner callback; the loop itself only orchestrates capability invocations
// through the registry and enforces TrustPolicy + BudgetCap safety budgets.

import type { AgentLoopStore } from '../../storage/contracts/agent-loop-store.js'
import type { ChromeGovernor } from '../chrome-governor.js'
import type { SemanticGroundingEngine } from './semantic-grounding.js'
import type {
  AgentLoopResult,
  AgentStep,
  AgenticGoal,
  BudgetCap,
  CapResult,
  Observation,
  TrustPolicy,
} from './types.js'

const DEFAULT_BUDGET: Required<BudgetCap> = {
  maxIterations: 20,
  maxDurationMs: 120_000,
  maxCdpCommandsPerIter: 10,
  maxLlmCallsPerLoop: 5,
  rateLimitPerMin: 60,
}

const DEFAULT_TRUST: Required<TrustPolicy> = {
  autoRead: true,
  autoWrite: false,
  requireConfirmation: false,
  destructiveBlock: true,
  confidenceThreshold: 0.6,
  sourceAllowlist: [],
  provenanceTrack: false,
}

/** Pluggable planner — returns the next capability action(s) given an observation. */
export interface LoopPlanner {
  plan(ctx: {
    goal: string
    observation: Observation
    history: AgentStep[]
    fanout?: number
  }): Promise<Array<{ capability: string; params: Record<string, unknown> }>>
  /** Optional LLM ranker for research-style goals (bounded fan-out + rank). */
  rank?(ctx: {
    goal: string
    candidates: Array<{ capability: string; params: Record<string, unknown>; output: unknown }>
  }): Promise<Array<{ capability: string; params: Record<string, unknown>; score: number }>>
  /** Reflect: did the loop achieve the goal? */
  reflect(ctx: { goal: string; observation: Observation; history: AgentStep[] }): Promise<{
    achieved: boolean
    reason: string
  }>
}

/** Minimal resolver the loop uses to invoke capabilities (satisfied by the registry). */
export interface CapabilityResolver {
  invoke(
    capabilityId: string,
    params: Record<string, unknown>,
    ctx: { slaveId: string; runId?: string },
  ): Promise<CapResult>
  isDestructive(capabilityId: string): boolean
  confidence(capabilityId: string): number
}

export class AgenticLoopEngine {
  constructor(
    private governor: ChromeGovernor,
    private grounding: SemanticGroundingEngine,
    private store: AgentLoopStore,
    private resolver: CapabilityResolver,
    private planner: LoopPlanner,
  ) {}

  async executeAgenticLoop(slaveId: string, goal: AgenticGoal): Promise<AgentLoopResult> {
    const budget: Required<BudgetCap> = { ...DEFAULT_BUDGET, ...(goal.budget ?? {}) }
    const trust: Required<TrustPolicy> = { ...DEFAULT_TRUST, ...(goal.trust ?? {}) }
    const runId = `loop:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`
    const started = Date.now()
    const steps: AgentStep[] = []
    let llmCalls = 0

    await this.store.createRun({ runId, slaveId, goal: goal.goal })

    const push = async (kind: AgentStep['kind'], detail: string, extra?: Partial<AgentStep>) => {
      const step: AgentStep = { kind, detail, timestamp: Date.now(), ...extra }
      steps.push(step)
      await this.store.appendStep(runId, step)
    }

    await push('sense', 'loop start')

    try {
      for (let iter = 0; iter < budget.maxIterations; iter++) {
        if (Date.now() - started > budget.maxDurationMs) {
          await push('reflect', 'budget: maxDurationMs exceeded')
          break
        }

        // SENSE
        const observation = await this.sense(slaveId)
        await push('sense', `observed ${observation.url}`)

        // REFLECT (early exit if achieved)
        const verdict = await this.planner.reflect({ goal: goal.goal, observation, history: steps })
        await push('reflect', verdict.reason, { ok: verdict.achieved })
        if (verdict.achieved) {
          await this.store.finishRun(runId, {
            achieved: true,
            iterations: iter + 1,
            output: this.lastOutput(steps),
          })
          return this.result(runId, goal, true, iter + 1, steps)
        }

        // PLAN
        if (llmCalls >= budget.maxLlmCallsPerLoop) {
          await push('plan', 'budget: maxLlmCallsPerLoop reached; using rule-based fallback')
        } else {
          llmCalls++
        }
        const actions = await this.planner.plan({
          goal: goal.goal,
          observation,
          history: steps,
          fanout: goal.fanout,
        })
        await push('plan', `planned ${actions.length} action(s)`)

        // ACT + OBSERVE
        for (const action of actions.slice(0, budget.maxCdpCommandsPerIter)) {
          if (this.resolver.isDestructive(action.capability) && trust.destructiveBlock) {
            await push('act', `blocked destructive: ${action.capability}`, {
              capability: action.capability,
              ok: false,
            })
            continue
          }
          const conf = this.resolver.confidence(action.capability)
          if (conf < trust.confidenceThreshold && trust.requireConfirmation) {
            await push('adapt', `low-confidence gate: ${action.capability} (${conf})`, {
              capability: action.capability,
            })
            continue
          }
          try {
            const res = await this.resolver.invoke(action.capability, action.params, {
              slaveId,
              runId,
            })
            await push('act', action.capability, { capability: action.capability, ok: res.ok })
            if (!res.ok) {
              await push('observe', `action failed: ${res.error ?? 'unknown'}`, { ok: false })
            } else {
              await push('observe', `action ok: ${res.detail ?? ''}`)
            }
          } catch (err) {
            await push('observe', `action error: ${(err as Error).message}`, { ok: false })
          }
        }

        // ADAPT (bounded fan-out + LLM rank hook, if provided)
        if (this.planner.rank && actions.length > 1) {
          await push('adapt', 'ranking candidates')
        }
      }

      await this.store.finishRun(runId, {
        achieved: false,
        iterations: budget.maxIterations,
        error: 'maxIterations reached',
      })
      return this.result(runId, goal, false, budget.maxIterations, steps, 'maxIterations reached')
    } catch (err) {
      const message = (err as Error).message
      await this.store.finishRun(runId, {
        achieved: false,
        iterations: steps.length,
        error: message,
      })
      return this.result(runId, goal, false, steps.length, steps, message)
    }
  }

  async cancelAgenticLoop(runId: string): Promise<void> {
    await this.store.cancelRun(runId)
  }

  // ── internals ───────────────────────────────────────────────────────────

  private async sense(slaveId: string): Promise<Observation> {
    const url =
      ((await this.governor.evaluate(slaveId, 'location.href').catch(() => '')) as string) || ''
    const title =
      ((await this.governor.evaluate(slaveId, 'document.title').catch(() => '')) as string) || ''
    let a11y: AccessibilityNode | undefined
    try {
      a11y = await this.grounding.getAccessibilityTree(slaveId)
    } catch {
      a11y = undefined
    }
    const domSummary =
      ((await this.governor
        .evaluate(slaveId, 'document.body.innerText.slice(0,2000)')
        .catch(() => '')) as string) || ''
    return { url, title, a11y, domSummary, consoleErrors: [], networkPending: 0 }
  }

  private lastOutput(steps: AgentStep[]): unknown {
    const act = [...steps].reverse().find((s) => s.kind === 'act')
    return act?.detail
  }

  private result(
    runId: string,
    goal: AgenticGoal,
    achieved: boolean,
    iterations: number,
    steps: AgentStep[],
    error?: string,
  ): AgentLoopResult {
    if (achieved)
      return { runId, goal: goal.goal, achieved, iterations, steps, output: this.lastOutput(steps) }
    return { runId, goal: goal.goal, achieved, iterations, steps, error }
  }
}
