// devops/audit-arch/passes/cycles.ts
// `cycles` pass: report cyclic dependencies between modules.

import { buildFinding, type Finding } from '../findings.ts'
import { detectCycles } from '../cycles.ts'
import { modulePathLabel, type ModuleGraph } from '../graph.ts'

export async function checkCycles(graph: ModuleGraph, _scope: Scope = `surface`): Promise<Finding[]> {
  const out: Finding[] = []
  const groups = detectCycles(graph)
  for (const g of groups) {
    const chain = g.modules.map((m) => modulePathLabel(m)).join(' -> ')
    out.push(
      buildFinding({
        priority: 'P1',
        dimension: 'cycles',
        title: `Cyclic module dependency (${g.modules.length} modules)`,
        description: `Modules form a compile/load-time cycle: ${chain}.`,
        file: modulePathLabel(g.modules[0] as string),
        line: 0,
        evidence: `cycle: ${g.modules.join(' -> ')} -> ${g.modules[0]}`,
        impact: 'Cycles complicate reasoning, break lazy init, and make refactoring risky.',
        fixSummary: 'Introduce an interface/contract module that the cycle participants depend on, or invert one of the dependency directions.',
        fixSteps: [
          'Pick the edge whose direction is most easily inverted.',
          'Extract the shared abstraction into a new foundation module.',
          'Depend on the abstraction instead of the concrete module.',
          'Re-run `audit-arch` to confirm the cycle is gone.',
        ],
        effort: 'L',
        autoFixable: false,
      }),
    )
  }
  return out
}
