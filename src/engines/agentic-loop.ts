// src/engines/agentic-loop.ts
// AgenticLoopEngine — observation-action loop: SENSE→PLAN→ACT→OBSERVE→REFLECT→ADAPT

import type { MirrorEngine } from './mirror-engine.js'
import type { ObservationTap } from './observation-tap.js'

export interface AgenticGoal {
  description: string
  maxIterations?: number
  maxDurationMs?: number
}

export interface AgenticLoopResult {
  success: boolean
  iterations: number
  durationMs: number
  actions: string[]
  error?: string
}

export interface PlanningStrategy {
  name: string
  priority: number
  plan(goal: AgenticGoal, context: Record<string, unknown>): Promise<string[]>
}

export class AgenticLoopEngine {
  private maxIterations = 20
  private maxDurationMs = 120_000
  private llmBudget = 5
  private llmCalls = 0

  constructor(
    private mirror: MirrorEngine,
    private observation: ObservationTap,
    private planningStrategies: PlanningStrategy[] = [],
  ) {}

  async executeAgenticLoop(slaveId: string, goal: AgenticGoal): Promise<AgenticLoopResult> {
    const start = Date.now()
    const iterations = goal.maxIterations ?? this.maxIterations
    const maxDuration = goal.maxDurationMs ?? this.maxDurationMs
    const actions: string[] = []

    await this.observation.start(slaveId, { domMutations: true, networkEvents: true })

    try {
      for (let i = 0; i < iterations; i++) {
        if (Date.now() - start > maxDuration) break

        // SENSE
        const state = await this.mirror.projectState(slaveId)

        // PLAN
        const plan = await this.plan(goal, state as unknown as Record<string, unknown>)

        // ACT
        for (const action of plan) {
          actions.push(action)
        }

        // OBSERVE + REFLECT + ADAPT
        // Stub for v1 — would observe results and adapt
      }

      return {
        success: true,
        iterations: actions.length,
        durationMs: Date.now() - start,
        actions,
      }
    } catch (error) {
      return {
        success: false,
        iterations: actions.length,
        durationMs: Date.now() - start,
        actions,
        error: String(error),
      }
    } finally {
      await this.observation.stop(slaveId)
    }
  }

  private async plan(goal: AgenticGoal, context: Record<string, unknown>): Promise<string[]> {
    // Try planning strategies in priority order
    for (const strategy of this.planningStrategies.sort((a, b) => a.priority - b.priority)) {
      try {
        return await strategy.plan(goal, context)
      } catch {
        // try next strategy
      }
    }

    // Default: return goal description as single action
    return [goal.description]
  }
}
