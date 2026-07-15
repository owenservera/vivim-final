// devops/audit-code/checks/architecture.ts
// Architecture dimension: reuses the invariant checker (category B) as the
// authoritative source of boundary violations.

import { checkInvariants, type Violation } from '../../invariants.ts'
import { buildFinding, type Finding } from '../findings.ts'
import type { Priority } from '../priority.ts'

// Map invariant ids to audit priorities. Governor Canon (B1) and Store
// Contract (B2) are release-blockers (P0); the rest of B are P1.
const P0_IDS = new Set(['B1', 'B2'])

function priorityForViolation(v: Violation): Priority {
  if (v.severity === 'warning') return 'P2'
  return P0_IDS.has(v.id) ? 'P0' : 'P1'
}

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
  B6: {
    summary: 'Do not inject scripts in the harness runtime.',
    steps: ['Remove addScriptToEvaluateOnNewDocument from harness-runtime.ts.', 'Resolve the behaviour through the Governor instead.'],
  },
  B7: {
    summary: 'Use custom error classes from src/errors.ts.',
    steps: ['Import the domain error class.', 'Throw it instead of `new Error(...)`.'],
  },
  B8: {
    summary: 'Expose agent-addressable UI wiring.',
    steps: ['Register the action in web/ui/src/actions/registry.ts.', 'Wire agent-bridge.ts and agent:command/agent:discover in websocket.ts.'],
  },
}

export async function checkArchitecture(): Promise<Finding[]> {
  const result = await checkInvariants(undefined, 'B')
  const out: Finding[] = []
  for (const v of result.violations) {
    const hint = FIX_HINTS[v.id] ?? {
      summary: 'Restore the architectural boundary described by this invariant.',
      steps: ['Review the invariant definition in devops/invariants.ts.', 'Refactor to satisfy the boundary.', 'Re-run `bun run devops invariants check --category B`.'],
    }
    out.push(
      buildFinding({
        priority: priorityForViolation(v),
        dimension: 'architecture',
        invariant: v.id,
        title: `Architecture violation: ${v.id}`,
        description: v.message,
        file: v.file ?? 'src/engines',
        line: v.line ?? 0,
        evidence: v.file ? `${v.file}:${v.line ?? '?'} — ${v.message}` : v.message,
        impact: 'Breaks an enforced system boundary; can desynchronise the CDP/store layers.',
        fixSummary: hint.summary,
        fixSteps: hint.steps,
        effort: 'M',
        autoFixable: false,
      }),
    )
  }
  return out
}
