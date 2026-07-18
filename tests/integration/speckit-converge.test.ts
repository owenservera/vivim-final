// tests/integration/speckit-converge.test.ts
// Integration tests for the consolidated converge pipeline.

import { describe, expect, it } from 'bun:test'

// unifiedConverge reads tasks/spec/code across the feature dir and is slow
// enough to exceed the default 5s budget under load.
const SLOW = 60_000

describe('speckit-converge-bridge (integration)', () => {
  it(
    'should run converge on a feature dir and return a report',
    async () => {
      const { unifiedConverge } = await import('../../devops/speckit-converge-bridge.ts')
      const report = await unifiedConverge('specs/006-provider-account-dashboard')
      expect(report).toHaveProperty('featureDir')
      expect(report).toHaveProperty('specGaps')
      expect(report).toHaveProperty('codeFindings')
      expect(report).toHaveProperty('archFindings')
      expect(report).toHaveProperty('tasksAppended')
      expect(Array.isArray(report.specGaps)).toBe(true)
    },
    SLOW,
  )

  it(
    'should not throw on a missing feature dir (records errors, read-only)',
    async () => {
      const { unifiedConverge } = await import('../../devops/speckit-converge-bridge.ts')
      const report = await unifiedConverge('specs/999-does-not-exist')
      expect(report).toHaveProperty('errors')
      expect(Array.isArray(report.errors)).toBe(true)
    },
    SLOW,
  )

  it(
    'should produce a well-formed ConvergeReport',
    async () => {
      const { unifiedConverge } = await import('../../devops/speckit-converge-bridge.ts')
      const report = await unifiedConverge('specs/006-provider-account-dashboard')
      expect(typeof report.timestamp).toBe('string')
      expect(typeof report.tasksAppended).toBe('number')
    },
    SLOW,
  )
})
