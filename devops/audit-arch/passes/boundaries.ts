// devops/audit-arch/passes/boundaries.ts
// `boundaries` pass: reuses the authoritative invariant checker (category B)
// so the architecture report also surfaces the hard, enforced boundaries
// (Governor Canon B1, Store Contract B2, etc.) without duplicating logic.

import { buildFinding, type Finding } from '../findings.ts'
import type { Scope } from '../priority.ts'
import { checkInvariants, type Violation } from '../../invariants.ts'

const P0_IDS = new Set(['B1', 'B2'])
const FIX_HINTS: Record<string, { summary: string; steps: string[] }> = {
  B1: {
    summary: 'Route CDP access exclusively through ChromeGovernor.',
    steps: ['Remove the direct CDP/engine import.', 'Depend on a Governor contract exposed by ChromeGovernor.', 'Move the CDP call into chrome-governor.ts.'],
  },
  B2: {
    summary: 'Depend on the storage contract, not the implementation.',
    steps: ['Replace `storage/impl` imports with `storage/contracts`.', 'Implement against the Store Contract interface.', 'Add the impl binding at the composition root.'],
  },
  B5: {
    summary: 'Read configuration via ConfigManager.',
    steps: ['Inject ConfigManager instead of reading process.env directly.', 'Move raw config reads behind ConfigManager.get().'],
  },
  B7: {
    summary: 'Use custom error classes from src/errors.ts.',
    steps: ['Import the domain error class.', 'Throw it instead of `new Error(...)`.'],
  },
}

export async function checkBoundaries(_scope: Scope = `deep`): Promise<Finding[]> {
  const result = await checkInvariants(undefined, 'B')
  const out: Finding[] = []
  for (const v of result.violations) {
    const hint = FIX_HINTS[v.id] ?? {
      summary: 'Restore the architectural boundary described by this invariant.',
      steps: ['Review the invariant in devops/invariants.ts.', 'Refactor to satisfy the boundary.', 'Re-run `bun run devops invariants check --category B`.'],
    }
    out.push(
      buildFinding({
        priority: P0_IDS.has(v.id) ? 'P0' : v.severity === 'warning' ? 'P2' : 'P1',
        dimension: 'boundaries',
        invariant: v.id,
        title: `Boundary violation: ${v.id}`,
        description: v.message,
        file: v.file ?? 'src/engines',
        line: v.line ?? 0,
        evidence: v.file ? `${v.file}:${v.line ?? '?'} — ${v.message}` : v.message,
        impact: 'Breaks an enforced system boundary.',
        fixSummary: hint.summary,
        fixSteps: hint.steps,
        effort: 'M',
        autoFixable: false,
      }),
    )
  }
  return out
}

// Keep the imported type referenced for strict-mode type-checking parity.
export type _BoundaryViolation = Violation
