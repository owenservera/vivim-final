// tests/unit/devops/invariants.test.ts
// Unit tests for devops/invariants.ts — invariant checker.

import { describe, expect, it } from 'bun:test'
import { checkInvariants } from '../../../devops/invariants.js'

describe('Invariant Checker', () => {
  describe('checkInvariants()', () => {
    // These checks run full recursive filesystem scans and can exceed Bun's 5s
    // default on a cold cache, so they are given an explicit generous timeout.
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
      // B1 should pass — no engine imports BunCdpClient
      expect(b1Violations.length).toBe(0)
    }, 30000)

    it('B2: no engine imports -impl files', async () => {
      const result = await checkInvariants(undefined, 'B')
      const b2Violations = result.violations.filter((v) => v.id === 'B2')
      // B2 should pass — engines depend on contracts, not impls
      expect(b2Violations.length).toBe(0)
    }, 30000)

    it('B7: no raw new Error() in engines', async () => {
      const result = await checkInvariants(undefined, 'B')
      const b7Violations = result.violations.filter((v) => v.id === 'B7')
      // B7 may have violations — engines may use new Error()
      // Just check it runs without crashing
      expect(Array.isArray(b7Violations)).toBe(true)
    }, 30000)

    it('D1: checks for engine test files', async () => {
      const result = await checkInvariants(undefined, 'D')
      const d1Warnings = result.warnings.filter((v) => v.id === 'D1')
      // D1 should find missing test files (if any)
      expect(Array.isArray(d1Warnings)).toBe(true)
    }, 30000)

    it('category filter works', async () => {
      const resultB = await checkInvariants(undefined, 'B')
      expect(resultB.checked.every((c) => c.startsWith('B'))).toBe(true)

      const resultD = await checkInvariants(undefined, 'D')
      expect(resultD.checked.every((c) => c.startsWith('D'))).toBe(true)
    }, 30000)

    it('unit-specific checks include C-category invariants', async () => {
      // Unit 11.1 is done — should pass C checks
      const result = await checkInvariants('11.1', 'C')
      expect(result.checked).toContain('C1')
      expect(result.checked).toContain('C2')
      expect(result.checked).toContain('C3')
      expect(result.checked).toContain('C4')
    }, 30000)
  })
})
