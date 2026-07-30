// src/engines/scheduler/policy.ts
// Scheduler policy for priority, fairness, and backpressure.
// Phase 5: Weighted round-robin across non-empty queues with aging.

import type { QueueName } from './queues.js'
import { QUEUE_CONFIGS } from './queues.js'

export interface PolicyConfig {
  maxInFlight: number
  agingThresholdMs: number
  backpressureTimeoutMs: number
}

const DEFAULT_POLICY: PolicyConfig = {
  maxInFlight: 8,
  agingThresholdMs: 500,
  backpressureTimeoutMs: 30_000,
}

export class SchedulerPolicy {
  private config: PolicyConfig

  constructor(config?: Partial<PolicyConfig>) {
    this.config = { ...DEFAULT_POLICY, ...config }
  }

  /**
   * Determine which queue to schedule next using weighted round-robin.
   * Returns null if no queue has pending tasks.
   */
  nextQueue(
    queues: Map<QueueName, { depth: number; inFlight: number; oldestWaitMs: number }>,
  ): QueueName | null {
    // Sort by effective priority (base priority + aging boost)
    const candidates: Array<{ name: QueueName; effectivePriority: number }> = []

    for (const [name, state] of queues) {
      if (state.depth === 0) continue
      if (state.inFlight >= QUEUE_CONFIGS[name].concurrency) continue

      const config = QUEUE_CONFIGS[name]
      let effectivePriority = config.priority

      // Aging: boost priority if waiting too long
      if (state.oldestWaitMs > this.config.agingThresholdMs) {
        effectivePriority += Math.min(50, Math.floor(state.oldestWaitMs / 100))
      }

      candidates.push({ name, effectivePriority })
    }

    if (candidates.length === 0) return null

    // Sort by effective priority (highest first)
    candidates.sort((a, b) => b.effectivePriority - a.effectivePriority)

    return candidates[0]!.name
  }

  /**
   * Check if we're at backpressure limit.
   */
  isBackpressured(totalInFlight: number): boolean {
    return totalInFlight >= this.config.maxInFlight
  }

  /**
   * Get backpressure timeout.
   */
  getBackpressureTimeout(): number {
    return this.config.backpressureTimeoutMs
  }

  /**
   * Get max in-flight limit.
   */
  getMaxInFlight(): number {
    return this.config.maxInFlight
  }
}
