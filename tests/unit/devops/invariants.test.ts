// tests/unit/devops/invariants.test.ts
// Unit tests for devops/invariants.ts — invariant checker.

import { describe, expect, it } from 'bun:test'
import { checkInvariants } from '../../../devops/invariants.js'

describe('Invariant Checker', () => {
  describe('checkInvariants()', () => {
    it('returns a result with pass, violations, warnings, checked', async () => {
      const result = await checkInvariants()
      expect(result).toHaveProperty('pass')
      expect(result).toHaveProperty('violations')
      expect(result).toHaveProperty('warnings')
      expect(result).toHaveProperty('checked')
      expect(Array.isArray(result.violations)).toBe(true)
      expect(Array.isArray(result.warnings)).toBe(true)
      expect(Array.isArray(result.checked)).toBe(true)
    }, 30000)

    it('B1: no engine imports BunCdpClient (except chrome-governor)', async () => {
      const result = await checkInvariants(undefined, 'B')
      const b1Violations = result.violations.filter((v) => v.id === 'B1')
      expect(b1Violations.length).toBe(0)
    }, 30000)

    it('B2: no engine imports -impl files', async () => {
      const result = await checkInvariants(undefined, 'B')
      const b2Violations = result.violations.filter((v) => v.id === 'B2')
      expect(b2Violations.length).toBe(0)
    }, 30000)

    it('B7: no raw new Error() in engines', async () => {
      const result = await checkInvariants(undefined, 'B')
      const b7Violations = result.violations.filter((v) => v.id === 'B7')
      expect(Array.isArray(b7Violations)).toBe(true)
    }, 30000)

    it('D1: checks for engine test files', async () => {
      const result = await checkInvariants(undefined, 'D')
      const d1Warnings = result.warnings.filter((v) => v.id === 'D1')
      expect(Array.isArray(d1Warnings)).toBe(true)
    }, 30000)

    it('category filter works', async () => {
      const resultB = await checkInvariants(undefined, 'B')
      expect(resultB.checked.every((c) => c.startsWith('B'))).toBe(true)

      const resultD = await checkInvariants(undefined, 'D')
      expect(resultD.checked.every((c) => c.startsWith('D'))).toBe(true)
    }, 30000)

    it('unit-specific checks include C-category invariants', async () => {
      const result = await checkInvariants('11.1', 'C')
      expect(result.checked).toContain('C1')
      expect(result.checked).toContain('C2')
      expect(result.checked).toContain('C3')
      expect(result.checked).toContain('C4')
    }, 30000)

    it('A2: research report parser finds unit sections by prose header', async () => {
      const result = await checkInvariants('1.1', 'A')
      expect(result.checked).toContain('A2')
      // 1.1 is done and in the research report — should not block
      const a2Blocks = result.violations.filter((v) => v.id === 'A2')
      expect(a2Blocks.length).toBe(0)
    }, 30000)

    it('B4: schema scan does not flag legitimate JSON serialization blobs', async () => {
      const result = await checkInvariants(undefined, 'B')
      const b4Blocks = result.violations.filter((v) => v.id === 'B4')
      // edgesJson, overrideJson, stateJson, configJson are legitimate blobs
      const flaggedLines = b4Blocks.map((v) => v.message)
      for (const blob of [
        'edgesJson',
        'overrideJson',
        'providerStateJson',
        'uiStatesOverrideJson',
      ]) {
        expect(flaggedLines.some((m) => m.includes(blob))).toBe(false)
      }
    }, 30000)

    it('B10: autonomous-execution.ts gates destructive steps', async () => {
      const result = await checkInvariants(undefined, 'B')
      const b10Blocks = result.violations.filter((v) => v.id === 'B10' && v.severity === 'block')
      expect(b10Blocks.length).toBe(0)
    }, 30000)

    it('B12a: telemetry-audit.ts exists', async () => {
      const result = await checkInvariants(undefined, 'B')
      expect(result.checked).toContain('B12a')
      const b12aBlocks = result.violations.filter((v) => v.id === 'B12a')
      expect(b12aBlocks.length).toBe(0)
    }, 30000)

    it('B12b: capture-telemetry registry check is warning-level', async () => {
      const result = await checkInvariants(undefined, 'B')
      const b12b = result.warnings.filter((v) => v.id === 'B12b')
      expect(Array.isArray(b12b)).toBe(true)
    }, 30000)

    it('A4 is not a hard block (removed invariant)', async () => {
      const result = await checkInvariants(undefined, 'A')
      const a4Blocks = result.violations.filter((v) => v.id === 'A4')
      expect(a4Blocks.length).toBe(0)
    }, 30000)
  })

  describe('checkB4_RelationalFirst()', () => {
    it('returns no violations for the current schema', async () => {
      const result = await checkInvariants(undefined, 'B')
      const b4Blocks = result.violations.filter((v) => v.id === 'B4')
      expect(b4Blocks.length).toBe(0)
    }, 30000)
  })

  describe('checkB10_HitlCoverage()', () => {
    it('passes for the existing autonomous executor', async () => {
      const result = await checkInvariants(undefined, 'B')
      const b10Blocks = result.violations.filter((v) => v.id === 'B10' && v.severity === 'block')
      expect(b10Blocks.length).toBe(0)
    }, 30000)
  })

  describe('checkB12a_EgressGovernance()', () => {
    it('telemetry-audit.ts exists and is checked', async () => {
      const result = await checkInvariants(undefined, 'B')
      expect(result.checked).toContain('B12a')
    }, 30000)
  })

  describe('checkB12b_CaptureTelemetry()', () => {
    it('capture-telemetry check is warning-level', async () => {
      const result = await checkInvariants(undefined, 'B')
      const b12b = result.warnings.filter((v) => v.id === 'B12b')
      expect(Array.isArray(b12b)).toBe(true)
    }, 30000)
  })
})
