// tests/arch/boundary-cdp.test.ts
// Boundary invariants for the ChromeGovernor canon (B1, FIX-B1-2) and the
// boot-graph canon (B13, FIX-A1-2). These tests invoke the real invariant
// checkers from `devops/invariants.ts` so a regression in either boundary
// fails the test suite — not just the devops CLI.
//
// Run with: bun test tests/arch/boundary-cdp.test.ts

import { describe, expect, it } from 'bun:test'
import { checkInvariants } from '../../devops/invariants.ts'

describe('architectural boundary invariants (session 1)', () => {
  describe('B1 — ChromeGovernor canon (FIX-B1-2)', () => {
    it('no engine imports CDP transport directly', async () => {
      // Signature: checkInvariants(unitId?, category?). Pass undefined unitId
      // and 'B' category so only category-B checks run.
      const result = await checkInvariants(undefined, 'B')
      const b1 = result.violations.filter((v) => v.id === 'B1')
      expect(
        b1,
        `B1 violations (engine imports CDP transport directly):\n${b1.map((v) => `  - ${v.file}:${v.line} — ${v.message}`).join('\n')}`,
      ).toEqual([])
    })
  })

  describe('B13 — Boot graph canon (FIX-A1-2)', () => {
    it('bootstrap-engines.ts remains a thin facade over orchestrator', async () => {
      const result = await checkInvariants(undefined, 'B')
      const b13Blocks = result.violations.filter((v) => v.id === 'B13' && v.severity === 'block')
      expect(
        b13Blocks,
        `B13 blocking violations (boot graph regression):\n${b13Blocks.map((v) => `  - ${v.file ?? ''} — ${v.message}`).join('\n')}`,
      ).toEqual([])
    })

    it('orchestrator documents phase order (warning-level regression)', async () => {
      const result = await checkInvariants(undefined, 'B')
      const b13Warnings = result.warnings.filter((v) => v.id === 'B13')
      // Warnings don't fail the suite, but log them so reviewers notice.
      if (b13Warnings.length > 0) {
        console.warn(
          `\n  [B13 warning] boot graph documentation regressed:\n${b13Warnings.map((v) => `    - ${v.file ?? ''} — ${v.message}`).join('\n')}\n`,
        )
      }
      expect(b13Warnings.length).toBe(0)
    })
  })

  describe('all B-category invariants pass', () => {
    it('checkInvariants(undefined, "B") returns pass=true', async () => {
      const result = await checkInvariants(undefined, 'B')
      if (!result.pass) {
        console.error(
          `\n  [Category B FAIL] ${result.violations.length} blocking violations:\n${result.violations.map((v) => `    - ${v.id}: ${v.file ?? ''}:${v.line ?? ''} — ${v.message}`).join('\n')}\n`,
        )
      }
      expect(result.pass).toBe(true)
    })
  })
})
