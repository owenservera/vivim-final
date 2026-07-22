// devops/llm-testing/pattern-analyzer.ts
// Extracts patterns from test results, updates confidence scores, records failures.

import { getLogger } from '../../src/lib/logger.js'
import { KnowledgeStore } from './knowledge-store.js'
import type {
  ErrorEntry,
  KnowledgeDelta,
  Pattern,
  PatternFailure,
  TestResult,
  TestSurface,
} from './types.js'

const log = getLogger('llm-testing:pattern-analyzer')

export class PatternAnalyzer {
  private knowledge: KnowledgeStore

  constructor(knowledge: KnowledgeStore) {
    this.knowledge = knowledge
  }

  analyze(results: TestResult[]): KnowledgeDelta {
    const newPatterns: Pattern[] = []
    const updatedPatterns: Pattern[] = []
    const newErrors: ErrorEntry[] = []
    const updatedErrors: ErrorEntry[] = []

    for (const result of results) {
      if (result.status === 'skip') continue

      const existing = this.knowledge.getPatternsByCapability(result.surface, result.capability)

      if (existing.length === 0) {
        const pattern = this.createPattern(result)
        newPatterns.push(pattern)
      } else {
        const updated = this.updatePattern(existing[0]!, result)
        if (updated) updatedPatterns.push(updated)
      }

      if (result.status === 'fail' || result.status === 'error') {
        const error = this.createOrUpdateError(result)
        if (error.id.startsWith('E') && this.knowledge.getErrors().find((e) => e.id === error.id)) {
          updatedErrors.push(error)
        } else {
          newErrors.push(error)
        }
      }
    }

    return { newPatterns, updatedPatterns, newErrors, updatedErrors }
  }

  private createPattern(result: TestResult): Pattern {
    const confidence = result.status === 'pass' ? 0.8 : 0.3
    return {
      id: '',
      surface: result.surface,
      capability: result.capability,
      pattern: this.inferPattern(result),
      confidence,
      lastVerified: result.status === 'pass' ? result.timestamp : '',
      failures: result.status === 'fail' || result.status === 'error'
        ? [this.createFailure(result)]
        : [],
      tags: [result.surface, result.capability],
    }
  }

  private updatePattern(pattern: Pattern, result: TestResult): Pattern | null {
    if (result.status === 'pass') {
      pattern.confidence = Math.min(1, pattern.confidence + 0.05)
      pattern.lastVerified = result.timestamp
      return pattern
    }

    if (result.status === 'fail' || result.status === 'error') {
      pattern.confidence = Math.max(0, pattern.confidence - 0.2)
      pattern.failures.push(this.createFailure(result))
      return pattern
    }

    return null
  }

  private createFailure(result: TestResult): PatternFailure {
    return {
      timestamp: result.timestamp,
      symptom: result.error ?? result.actual,
      rootCause: result.error ?? 'Unknown',
      fix: result.fix ?? 'Investigate',
    }
  }

  private createOrUpdateError(result: TestResult): ErrorEntry {
    const existing = this.knowledge
      .getErrorsBySurface(result.surface)
      .find((e) => e.capability === result.capability && e.error === result.error)

    if (existing) {
      existing.occurrences++
      existing.lastSeen = result.timestamp
      existing.fix = result.fix ?? existing.fix
      return existing
    }

    return {
      id: '',
      surface: result.surface,
      capability: result.capability,
      error: result.error ?? result.actual,
      rootCause: result.error ?? 'Unknown',
      fix: result.fix ?? 'Investigate',
      occurrences: 1,
      lastSeen: result.timestamp,
      resolved: false,
    }
  }

  private inferPattern(result: TestResult): string {
    if (result.status === 'pass') {
      return `${result.surface}/${result.capability}: ${result.action} → success`
    }
    return `${result.surface}/${result.capability}: ${result.action} → ${result.error ?? 'failure'}`
  }

  updateCoverage(results: TestResult[]) {
    const surfaces = new Set(results.map((r) => r.surface))

    for (const surface of surfaces) {
      const surfaceResults = results.filter((r) => r.surface === surface)
      const passed = surfaceResults.filter((r) => r.status === 'pass').length
      const total = surfaceResults.length

      const existing = this.knowledge.getSurfaceCoverage(surface)
      const before = existing?.coverage ?? 0

      this.knowledge.updateCoverage(surface, {
        totalCapabilities: Math.max(existing?.totalCapabilities ?? 0, total),
        testedCapabilities: Math.max(existing?.testedCapabilities ?? 0, passed),
        coverage: total > 0 ? passed / total : 0,
        lastFullRun: new Date().toISOString(),
      })
    }
  }
}
