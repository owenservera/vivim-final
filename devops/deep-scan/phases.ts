// devops/deep-scan/phases.ts
// Phase registry: maps the 10 phases to runners. Reuses the existing audit
// mechanics (audit-code checks + audit-arch passes + invariants) — nothing is
// duplicated; findings are re-numbered to DS-* and tagged with their phase.

import { checkArchitecture } from '../audit-code/checks/architecture.ts'
import { checkCorrectness } from '../audit-code/checks/correctness.ts'
import { checkDependencies } from '../audit-code/checks/dependencies.ts'
import { checkDrift } from '../audit-code/checks/drift.ts'
import { checkPerformance } from '../audit-code/checks/performance.ts'
import { checkQuality } from '../audit-code/checks/quality.ts'
import { checkTesting } from '../audit-code/checks/testing.ts'
import { buildGraph, type ModuleGraph } from '../audit-arch/graph.ts'
import { checkCohesion } from '../audit-arch/passes/cohesion.ts'
import { checkCommands } from '../audit-arch/passes/commands.ts'
import { checkCoupling } from '../audit-arch/passes/coupling.ts'
import { checkCycles } from '../audit-arch/passes/cycles.ts'
import { checkLayering } from '../audit-arch/passes/layering.ts'
import type { Finding } from '../audit-code/findings.ts'
import { scanRoot } from '../truth/scanner.ts'
import { checkCrossSurfaceStatic } from './passes/cross-surface.ts'
import { checkAsyncCorrectness } from './passes/async-correctness.ts'
import { checkHotPathPerf } from './passes/hot-path.ts'
import type { DeepScanFinding, PhaseId, Scope } from './types.ts'
import { scopeRank } from '../audit-code/priority.ts'
import { tagFinding } from './findings.ts'

export interface PhaseContext {
  graph: ModuleGraph
  scope: Scope
  filesScanned: number
}

type RawFindings = (Finding | import('../audit-arch/findings.ts').Finding)[]

export interface PhaseDef {
  id: PhaseId
  name: string
  dimension: string
  minScope: Scope
  run: (ctx: PhaseContext) => Promise<RawFindings>
}

async function runWith<T>(fn: () => Promise<T>): Promise<T> {
  return fn()
}

// ── Phase registry ──────────────────────────────────────────────────────────
export const PHASES: PhaseDef[] = [
  // P03 Structural: cycles + layering + coupling + cohesion (audit-arch).
  {
    id: 'P03',
    name: 'Structural (module graph)',
    dimension: 'architecture',
    minScope: 'standard',
    run: async (ctx) => {
      const [cycles, layering, coupling, cohesion] = await Promise.all([
        checkCycles(ctx.graph, ctx.scope),
        checkLayering(ctx.graph, ctx.scope),
        checkCoupling(ctx.graph, ctx.scope),
        checkCohesion(ctx.graph, ctx.scope),
      ])
      return [...cycles, ...layering, ...coupling, ...cohesion]
    },
  },
  // P04 Boundaries: hard invariants (category B) via audit-code architecture.
  {
    id: 'P04',
    name: 'Boundaries (invariants)',
    dimension: 'architecture',
    minScope: 'standard',
    run: () => runWith(checkArchitecture),
  },
  // P05 Correctness: audit-code correctness + async/race extras.
  {
    id: 'P05',
    name: 'Correctness',
    dimension: 'correctness',
    minScope: 'surface',
    run: async () => {
      const [base, asyncExtra] = await Promise.all([
        checkCorrectness(),
        checkAsyncCorrectness(),
      ])
      return [...base, ...asyncExtra]
    },
  },
  // P06 Performance: audit-code performance + hot-path extras.
  {
    id: 'P06',
    name: 'Performance',
    dimension: 'performance',
    minScope: 'deep',
    run: async () => {
      const [base, hot] = await Promise.all([checkPerformance(), checkHotPathPerf()])
      return [...base, ...hot]
    },
  },
  // P07 Quality: quality + dependencies + drift (truth scanner).
  {
    id: 'P07',
    name: 'Quality & Maintainability',
    dimension: 'quality',
    minScope: 'surface',
    run: async () => {
      const [quality, deps, drift] = await Promise.all([
        checkQuality(),
        checkDependencies(),
        checkDrift(),
      ])
      return [...quality, ...deps, ...drift]
    },
  },
  // P08 Cross-surface: the single-command-layer pass (audit-arch commands) +
  // a static parity check on capabilities vs CLI/UI bindings.
  {
    id: 'P08',
    name: 'Cross-surface parity',
    dimension: 'commands',
    minScope: 'deep',
    run: async (ctx) => {
      const [commands, staticParity] = await Promise.all([
        checkCommands(ctx.graph, ctx.scope),
        checkCrossSurfaceStatic(),
      ])
      return [...commands, ...staticParity]
    },
  },
  // P09 Test health: engines without unit tests (audit-code testing).
  {
    id: 'P09',
    name: 'Test health',
    dimension: 'testing',
    minScope: 'standard',
    run: () => runWith(checkTesting),
  },
]

// P01/P02 are infra phases (no findings): they inventory files and build the
// shared module graph. P10 is synthesis. These are handled by the orchestrator.
export const INFRA_PHASES: PhaseId[] = ['P01', 'P02', 'P10']

export async function buildPhaseContext(scope: Scope): Promise<PhaseContext> {
  const graph = await buildGraph()
  const filesScanned = graph.files.size
  // Reuse the truth scanner for stub classification lazily in P07; the graph
  // file set is the authoritative inventory for the scan.
  void scanRoot
  return { graph, scope, filesScanned }
}

export function phaseRuns(def: PhaseDef, scope: Scope): boolean {
  return scopeRank(scope) >= scopeRank(def.minScope)
}

export function collectPhasedFindings(
  ctx: PhaseContext,
  scope: Scope,
): { def: PhaseDef; findings: DeepScanFinding[] }[] {
  return PHASES.filter((p) => phaseRuns(p, scope)).map((def) => ({
    def,
    findings: [],
  }))
}
