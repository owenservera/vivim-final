// devops/audit-arch/passes/cohesion.ts
// `cohesion` pass: flag modules whose imports mostly leave the module.

import { buildFinding, type Finding } from '../findings.ts'
import { computeMetrics, LOW_COHESION_RATIO, type ModuleMetrics } from '../metrics.ts'
import { modulePathLabel, type ModuleGraph } from '../graph.ts'

export async function checkCohesion(graph: ModuleGraph, _scope: Scope = `standard`): Promise<Finding[]> {
  const out: Finding[] = []
  const metrics: ModuleMetrics[] = computeMetrics(graph)
  for (const m of metrics) {
    // Only judge modules with enough outbound edges to be meaningful.
    if (m.totalDeps < 3) continue
    if (m.cohesion < LOW_COHESION_RATIO) {
      out.push(
        buildFinding({
          priority: 'P2',
          dimension: 'cohesion',
          title: `Low cohesion: ${m.module} (internal ${m.selfDeps}/${m.totalDeps})`,
          description: `\`${m.module}\` rarely references its own files (cohesion ${m.cohesion.toFixed(2)}) and mostly depends on other modules. It may be a grab-bag or mis-layered.`,
          file: modulePathLabel(m.module),
          line: 0,
          evidence: `selfDeps=${m.selfDeps} totalDeps=${m.totalDeps} cohesion=${m.cohesion.toFixed(2)}`,
          impact: 'Low cohesion couples the module to the wider graph and weakens its single-responsibility boundary.',
          fixSummary: 'Re-group related files, or move cross-cutting responsibilities to a shared module the rest depend on.',
          fixSteps: ['Map the external dependencies to subject areas.', 'Split the module along those areas.', 'Re-run to confirm cohesion rises above the threshold.'],
          effort: 'M',
          autoFixable: false,
        }),
      )
    }
  }
  return out
}
