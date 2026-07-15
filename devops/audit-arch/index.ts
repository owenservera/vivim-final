// devops/audit-arch/index.ts
// CLI barrel for the architecture-audit subsystem.
//
//   bun run devops audit-arch [scope] [flags]
//     scope: surface | standard | deep | full   (default: standard)
//     --module <path>   targeted audit of one module + 1-hop neighborhood
//     --pass <name>     run a single pass only (cycles|layering|coupling|cohesion|boundaries|commands)
//     --report          (default) write + print report
//     --export          write arch-findings.json only (no report)
//     --json            include arch-graph.json artifact
//     --baseline        save findings as a trend baseline
//     --compare         (full) diff vs last baseline
//
// Passes run SEQUENTIALLY and are MODULAR: each is an independent function in
// devops/audit-arch/passes/ that consumes the shared module graph and emits
// findings. Deeper scopes run every shallower scope's passes plus more.

import { execSync } from 'node:child_process'
import { existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { writeFile } from 'node:fs/promises'
import {
  compareBaseline,
  computeMetrics,
  computeSummary,
  loadFindings,
  loadLatestBaseline,
  saveBaseline,
  saveFindings,
  type Finding,
  type FindingsFile,
  type TrendResult,
} from './findings.ts'
import { buildGraph, modulePathLabel, subgraphAround, type ModuleGraph } from './graph.ts'
import { layerOf } from './policy.ts'
import { detectCycles } from './cycles.ts'
import { computeMetrics } from './metrics.ts'
import { scopeRank, type Dimension, type Scope } from './priority.ts'
import { renderReport, type ArchContext } from './report.ts'
import { checkCycles } from './passes/cycles.ts'
import { checkLayering } from './passes/layering.ts'
import { checkCoupling } from './passes/coupling.ts'
import { checkCohesion } from './passes/cohesion.ts'
import { checkBoundaries } from './passes/boundaries.ts'
import { checkCommands } from './passes/commands.ts'

const AUDITS_DIR = join(import.meta.dir, '..', '..', 'docs', 'audits', 'arch')
const FINDINGS_PATH = join(AUDITS_DIR, 'arch-findings.json')

function sha(): string {
  try {
    return execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim()
  } catch {
    return 'unknown'
  }
}

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

interface PassDef {
  dimension: Dimension
  minScope: Scope
  run: (g: ModuleGraph, scope: Scope) => Promise<Finding[]>
}

// ── Pass registry (modular + sequential) ───────────────────────────────────
const PASSES: PassDef[] = [
  { dimension: 'cycles', minScope: 'surface', run: checkCycles },
  { dimension: 'layering', minScope: 'surface', run: checkLayering },
  { dimension: 'coupling', minScope: 'standard', run: checkCoupling },
  { dimension: 'cohesion', minScope: 'standard', run: checkCohesion },
  // boundaries reuses invariants.ts (no graph argument).
  { dimension: 'boundaries', minScope: 'deep', run: async (_g, scope) => checkBoundaries(scope) },
  // commands audits the single command layer (capability ↔ NL catalog ↔ frontend).
  { dimension: 'commands', minScope: 'standard', run: checkCommands },
]

async function collectFindings(scope: Scope, graph: ModuleGraph, onlyPass?: Dimension): Promise<Finding[]> {
  const out: Finding[] = []
  for (const p of PASSES) {
    if (onlyPass && p.dimension !== onlyPass) continue
    if (scopeRank(p.minScope) <= scopeRank(scope)) {
      out.push(...(await p.run(graph, scope)))
    }
  }
  return out
}

function buildContext(graph: ModuleGraph, scope: Scope, target?: string, findings: Finding[]): ArchContext {
  const cycles = detectCycles(graph).length
  const hist = new Map<number, number>()
  for (const mod of graph.modules) {
    const l = layerOf(mod)
    hist.set(l, (hist.get(l) ?? 0) + 1)
  }
  const layerHistogram = [...hist.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([layer, count]) => ({ layer, count }))
  const metrics = computeMetrics(graph)
  const topHubs = metrics
    .map((m) => ({ module: m.module, fan: m.fanIn + m.fanOut }))
    .sort((a, b) => b.fan - a.fan)
    .filter((h) => h.fan > 0)
  return {
    scope,
    target,
    modules: graph.modules.size,
    edges: graph.edges.length,
    cycles,
    layerHistogram,
    topHubs,
  }
}

export async function runAuditArch(args: string[]): Promise<void> {
  const positional = args.filter((a) => !a.startsWith('--'))
  const scopeArg = positional[0] as Scope | undefined
  const scope: Scope =
    scopeArg && ['surface', 'standard', 'deep', 'full'].includes(scopeArg) ? scopeArg : 'standard'

  const moduleIdx = args.indexOf('--module')
  const target = moduleIdx >= 0 && moduleIdx + 1 < args.length ? args[moduleIdx + 1] : undefined
  const passArg = args.includes('--pass') ? (args[args.indexOf('--pass') + 1] as Dimension) : undefined
  const doExport = args.includes('--export')
  const doBaseline = args.includes('--baseline')
  const doCompare = args.includes('--compare')
  const doJson = args.includes('--json')

  // ── Build graph (optionally restricted to a targeted module) ─────────────
  const full = await buildGraph()
  const graph = target ? subgraphAround(full, target) : full

  if (target && graph.modules.size <= 1) {
    console.error(`[audit-arch] --module "${target}" matched no in-repo modules. Try e.g. "engines/stealth" or "storage/contracts".`)
    process.exit(1)
  }

  // ── Run passes sequentially ──────────────────────────────────────────────
  const raw = await collectFindings(scope, graph, passArg)
  const summary = computeSummary(raw)
  const date = today()

  const data: FindingsFile = {
    run: { scope, commit: sha(), date, filesScanned: graph.files.size, root: import.meta.dir },
    summary,
    findings: raw,
  }

  if (!existsSync(AUDITS_DIR)) mkdirSync(AUDITS_DIR, { recursive: true })

  let trend: TrendResult | undefined
  if (doCompare || scope === 'full') {
    const baseline = await loadLatestBaseline(AUDITS_DIR)
    if (baseline) trend = compareBaseline(raw, baseline)
  }

  await saveFindings(FINDINGS_PATH, data)

  if (doJson) {
    const artifact = {
      modules: [...graph.modules],
      edges: graph.edges.map((e) => ({ from: e.from, to: e.to })),
      layers: [...graph.modules].map((m) => ({ module: m, layer: layerOf(m) })),
      metrics: computeMetrics(graph),
    }
    await writeFile(join(AUDITS_DIR, 'arch-graph.json'), JSON.stringify(artifact, null, 2), 'utf8')
  }

  if (!doExport) {
    const ctx = buildContext(graph, scope, target, raw)
    const report = renderReport(data, ctx, trend)
    const reportPath = join(AUDITS_DIR, `ARCH-AUDIT-${target ? 'module' : 'system'}-${scope}-${date}.md`)
    await writeFile(reportPath, report, 'utf8')
    console.log(report)
  } else {
    console.log(`Wrote ${FINDINGS_PATH} (${raw.length} findings).`)
  }

  if (doBaseline) {
    const p = await saveBaseline(AUDITS_DIR, data)
    console.log(`Saved baseline: ${p}`)
  }

  console.log(
    `\n[audit-arch] scope=${scope} mode=${target ? `module:${target}` : 'system'} risk=${summary.risk} P0=${summary.P0} P1=${summary.P1} P2=${summary.P2} P3=${summary.P3} modules=${graph.modules.size} edges=${graph.edges.length} cycles=${detectCycles(graph).length}`,
  )
}

// Allow direct invocation: `bun run devops/audit-arch/index.ts [args]`
if (import.meta.main) {
  const [, , ...rest] = process.argv
  runAuditArch(rest).catch((e) => {
    console.error(e)
    process.exit(1)
  })
}
