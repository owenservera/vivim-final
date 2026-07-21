// devops/llm-testing/priority-engine.ts
// Computes test priorities: what to test next, weighted by risk.

import { getLogger } from '../../src/lib/logger.js'
import { KnowledgeStore } from './knowledge-store.js'
import type { PriorityEntry, TestSurface } from './types.js'

const log = getLogger('llm-testing:priority-engine')

const ERROR_WEIGHT = 0.4
const COVERAGE_WEIGHT = 0.3
const COMPLEXITY_WEIGHT = 0.3

export class PriorityEngine {
  private knowledge: KnowledgeStore

  constructor(knowledge: KnowledgeStore) {
    this.knowledge = knowledge
  }

  computePriorities(): PriorityEntry[] {
    const queue: PriorityEntry[] = []
    const surfaces: TestSurface[] = ['cli', 'ui', 'api', 'mcp', 'workflow', 'provider']

    for (const surface of surfaces) {
      const coverage = this.knowledge.getSurfaceCoverage(surface)
      const errors = this.knowledge.getErrorsBySurface(surface)
      const patterns = this.knowledge.getPatternsBySurface(surface)

      const testedCapabilities = new Set(patterns.map((p) => p.capability))

      for (const capability of testedCapabilities) {
        const capErrors = errors.filter((e) => e.capability === capability)
        const errorRate = this.computeErrorRate(capErrors)
        const coverageGap = 1 - (coverage?.coverage ?? 0)
        const complexity = this.estimateComplexity(capability)
        const riskScore = errorRate * ERROR_WEIGHT + coverageGap * COVERAGE_WEIGHT + complexity * COMPLEXITY_WEIGHT

        if (riskScore > 0.3) {
          queue.push({
            surface,
            capability,
            reason: this.inferReason(errorRate, coverageGap, capErrors),
            riskScore,
            coverageGap,
          })
        }
      }

      const untested = (coverage?.gaps ?? []).filter((g) => !testedCapabilities.has(g))
      for (const capability of untested) {
        queue.push({
          surface,
          capability,
          reason: 'never tested on this surface',
          riskScore: 1.0,
          coverageGap: 1.0,
        })
      }
    }

    queue.sort((a, b) => b.riskScore - a.riskScore)

    this.knowledge.setPriorities(queue)

    return queue
  }

  getNextTest(): PriorityEntry | null {
    const queue = this.knowledge.getPriorities()
    return queue.length > 0 ? queue[0] : null
  }

  private computeErrorRate(errors: Array<{ occurrences: number }>): number {
    if (errors.length === 0) return 0
    const total = errors.reduce((acc, e) => acc + e.occurrences, 0)
    return Math.min(1, total / 20)
  }

  private estimateComplexity(capability: string): number {
    const complex = ['workflow_execute', 'stream_response', 'chrome_navigate', 'memory_record']
    if (complex.some((c) => capability.includes(c))) return 0.8
    if (capability.includes('list') || capability.includes('get')) return 0.2
    return 0.5
  }

  private inferReason(errorRate: number, coverageGap: number, errors: Array<{ error: string }>): string {
    if (errors.length > 0) return `has ${errors.length} known errors`
    if (coverageGap > 0.5) return `low coverage (${(coverageGap * 100).toFixed(0)}% gap)`
    if (errorRate > 0.3) return `high error rate (${(errorRate * 100).toFixed(0)}%)`
    return 'moderate risk'
  }
}
