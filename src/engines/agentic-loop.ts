// src/engines/agentic-loop.ts
// AgenticLoopEngine — observation-action loop: SENSE→PLAN→ACT→OBSERVE→REFLECT→ADAPT

import type { MirrorEngine } from './mirror-engine.js'
import type { ObservationTap } from './observation-tap.js'
import type { UnifiedCapabilityRegistry } from './unified-registry.js'
import { getLogger } from '../lib/logger.js'

import { LoopDetector } from './loop-detector.js'

const log = getLogger('agentic-loop')

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
  episodes: EpisodeRecord[]
  error?: string
}

export interface PlanningStrategy {
  name: string
  priority: number
  plan(goal: AgenticGoal, context: Record<string, unknown>): Promise<string[]>
}

export interface EpisodeRecord {
  iteration: number
  stateBefore: unknown
  action: string
  result: unknown
  observed: unknown
  adapted: boolean
  ts: number
}

export interface RuleUpdate {
  ruleId: string
  confidenceDelta: number
  reason: string
}

export class AgenticLoopEngine {
  private maxIterations = 20
  private maxDurationMs = 120_000
  private llmBudget = 5
  private llmCalls = 0
  private loopDetector = new LoopDetector({ maxRepeats: 3, windowSize: 10 })

  constructor(
    private mirror: MirrorEngine,
    private observation: ObservationTap,
    private planningStrategies: PlanningStrategy[] = [],
    private registry?: UnifiedCapabilityRegistry,
  ) {}

  async executeAgenticLoop(slaveId: string, goal: AgenticGoal): Promise<AgenticLoopResult> {
    const start = Date.now()
    const iterations = goal.maxIterations ?? this.maxIterations
    const maxDuration = goal.maxDurationMs ?? this.maxDurationMs
    const actions: string[] = []
    const episodes: EpisodeRecord[] = []
    this.llmCalls = 0

    await this.observation.start(slaveId, { domMutations: true, networkEvents: true })

    try {
      for (let i = 0; i < iterations; i++) {
        if (Date.now() - start > maxDuration) break

        // Check for agent loops before planning
        if (this.loopDetector.isLooping()) {
          log.warn(`[agentic] ${this.loopDetector.getSuggestion()}`)
          break
        }

        // SENSE — project current state
        const stateBefore = await this.mirror.projectState(slaveId)

        // PLAN — get action candidates
        const plan = await this.plan(goal, stateBefore as unknown as Record<string, unknown>)

        // ACT — execute each planned action
        for (const action of plan) {
          actions.push(action)
          let result: unknown = null

          // Try executing via registry if available
          if (this.registry && this.looksLikeCapability(action)) {
            try {
              const capId = this.extractCapId(action)
              if (capId) {
                result = await this.registry.execute(
                  capId,
                  { action },
                  { metadata: { iteration: i, slaveId } },
                )
              }
            } catch {
              // Action not a capability — record but continue
              result = { executed: action, via: 'passthrough' }
            }
          } else {
            result = { executed: action, via: 'passthrough' }
          }

          // OBSERVE — re-project state after action
          const observed = await this.mirror.projectState(slaveId)

          // REFLECT — compare expected vs actual
          const adapted = this.reflect(stateBefore, observed, action)

          // Record episode
          const episode: EpisodeRecord = {
            iteration: i,
            stateBefore,
            action,
            result,
            observed,
            adapted,
            ts: Date.now(),
          }
          episodes.push(episode)
        }

        // ADAPT — update rule confidence based on reflection
        const ruleUpdates = this.adapt(episodes)
        for (const update of ruleUpdates) {
          this.eventBus?.emit({
            type: 'agentic:rule_update',
            ...update,
          })
        }

        // Check LLM budget
        if (this.llmCalls >= this.llmBudget) break
      }

      return {
        success: true,
        iterations: actions.length,
        durationMs: Date.now() - start,
        actions,
        episodes,
      }
    } catch (error) {
      return {
        success: false,
        iterations: actions.length,
        durationMs: Date.now() - start,
        actions,
        episodes,
        error: String(error),
      }
    } finally {
      await this.observation.stop(slaveId)
    }
  }

  private async plan(goal: AgenticGoal, context: Record<string, unknown>): Promise<string[]> {
    for (const strategy of this.planningStrategies.sort((a, b) => a.priority - b.priority)) {
      try {
        return await strategy.plan(goal, context)
      } catch {
        // try next strategy
      }
    }
    return [goal.description]
  }

  private reflect(stateBefore: unknown, observed: unknown, _action: string): boolean {
    // Simple reflection: check if state changed after action
    const before = JSON.stringify(stateBefore)
    const after = JSON.stringify(observed)
    return before !== after
  }

  private adapt(episodes: EpisodeRecord[]): RuleUpdate[] {
    const updates: RuleUpdate[] = []
    const lastEpisode = episodes[episodes.length - 1]
    if (!lastEpisode) return updates

    // If action caused state change, boost confidence
    if (lastEpisode.adapted) {
      updates.push({
        ruleId: `action:${lastEpisode.action}`,
        confidenceDelta: 0.1,
        reason: 'Action produced observable state change',
      })
    } else {
      updates.push({
        ruleId: `action:${lastEpisode.action}`,
        confidenceDelta: -0.05,
        reason: 'Action produced no observable state change',
      })
    }
    return updates
  }

  private looksLikeCapability(action: string): boolean {
    return action.includes(':') || action.startsWith('cap:')
  }

  private extractCapId(action: string): string | null {
    if (action.startsWith('cap:')) return action.slice(4)
    if (action.includes(':')) return action.split(':')[1] ?? null
    return null
  }

  private eventBus?: { emit: (event: unknown) => void }

  setEventBus(bus: { emit: (event: unknown) => void }): void {
    this.eventBus = bus
  }
}
