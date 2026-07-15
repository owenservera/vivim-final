// devops/audit-arch/passes/coupling.ts
// `coupling` pass: flag hub/god modules and orphans.

import { buildFinding, type Finding } from '../findings.ts'
import { computeMetrics, HUB_FAN_THRESHOLD, type ModuleMetrics } from '../metrics.ts'
import { modulePathLabel, type ModuleGraph } from '../graph.ts'

export async function checkCoupling(graph: ModuleGraph, _scope: Scope = `standard`): Promise<Finding[]> {
  const out: Finding[] = []
  const metrics: ModuleMetrics[] = computeMetrics(graph)
  for (const m of metrics) {
    const fan = m.fanIn + m.fanOut
    if (fan >= HUB_FAN_THRESHOLD) {
      out.push(
        buildFinding({
          priority: 'P2',
          dimension: 'coupling',
          title: `Hub module: ${m.module} (fan-in ${m.fanIn}, fan-out ${m.fanOut})`,
          description: `\`${m.module}\` is a high-degree node (instability ${m.instability.toFixed(2)}). Changes ripple widely; it is a refactoring risk.`,
          file: modulePathLabel(m.module),
          line: 0,
          evidence: `fan-in=${m.fanIn} fan-out=${m.fanOut} I=${m.instability.toFixed(2)}`,
          impact: 'Excessive fan-in makes the module a single point of coupling; a change touches many dependents.',
          fixSummary: 'Decompose the module or route dependents through narrower interfaces to lower its degree.',
          fixSteps: ['List the top dependents.', 'Identify a cohesion group to extract into a sub-module.', 'Introduce a focused contract for the extracted responsibility.'],
          effort: 'L',
          autoFixable: false,
        }),
      )
    } else if (fan === 0 && m.files > 0) {
      // Orphan: no inbound or outbound in-repo edges. Entry points (index, cli)
      // are expected to be orphans on the inbound side; only flag true isolates.
      out.push(
        buildFinding({
          priority: 'P3',
          dimension: 'coupling',
          title: `Orphan module: ${m.module}`,
          description: `\`${m.module}\` has no in-repo import relationships (${m.files} file(s)). It may be dead, an entry point, or only reached via dynamic import.`,
          file: modulePathLabel(m.module),
          line: 0,
          evidence: `fan-in=0 fan-out=0 files=${m.files}`,
          impact: 'Isolated modules inflate the surface and may be unreachable dead code.',
          fixSummary: 'Confirm the module is reached (entry point / dynamic import) or remove it if unused.',
          fixSteps: ['Grep the codebase for dynamic/string-based references.', 'If truly unused, delete it; otherwise document the entry path.'],
          effort: 'S',
          autoFixable: false,
        }),
      )
    }
  }
  return out
}
