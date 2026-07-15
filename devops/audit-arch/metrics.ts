// devops/audit-arch/metrics.ts
// Per-module coupling + cohesion metrics over the module graph.
//
//   fanIn  = number of distinct modules that import this module
//   fanOut = number of distinct modules this module imports
//   instability (I) = fanOut / (fanIn + fanOut)   (0 = stable, 1 = unstable)
//   cohesion = self-deps / total-deps   (how much the module references itself)

import type { ModuleGraph } from './graph.ts'

export interface ModuleMetrics {
  module: string
  fanIn: number
  fanOut: number
  instability: number
  selfDeps: number
  totalDeps: number
  cohesion: number
  files: number
}

export function computeMetrics(graph: ModuleGraph): ModuleMetrics[] {
  const out: ModuleMetrics[] = []
  for (const mod of graph.modules) {
    const deps = graph.moduleDeps.get(mod) ?? new Set<string>()
    const rdeps = graph.moduleRdeps.get(mod) ?? new Set<string>()
    const fanIn = rdeps.size
    const fanOut = deps.size
    const selfDeps = deps.has(mod) ? 1 : 0
    const totalDeps = deps.size
    const instability = fanIn + fanOut === 0 ? 0 : fanOut / (fanIn + fanOut)
    const cohesion = totalDeps === 0 ? 1 : selfDeps / totalDeps
    out.push({
      module: mod,
      fanIn,
      fanOut,
      instability,
      selfDeps,
      totalDeps,
      cohesion,
      files: graph.moduleFiles.get(mod)?.length ?? 0,
    })
  }
  return out
}

// Threshold-tunable selectors used by the coupling/cohesion passes.
export const HUB_FAN_THRESHOLD = 25 // fanIn + fanOut above this is a hub candidate
export const LOW_COHESION_RATIO = 0.15 // below this is low cohesion
