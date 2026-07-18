// bench/runner.ts
// Framework-agnostic benchmark core (Unit 37.3). Measures p50/p95 per scenario
// and reports regressions vs a stored baseline. No DOM / DB required.

export interface BenchScenario {
  name: string
  run: () => void | Promise<void>
  iterations?: number
}

export interface BenchResult {
  name: string
  iterations: number
  p50Ms: number
  p95Ms: number
  minMs: number
  maxMs: number
}

export interface BenchReport {
  results: BenchResult[]
  regressions: string[]
  baseline: Record<string, number>
}

export function computePercentile(sortedSamples: number[], p: number): number {
  if (sortedSamples.length === 0) return 0
  const idx = Math.min(
    sortedSamples.length - 1,
    Math.max(0, Math.ceil((p / 100) * sortedSamples.length) - 1),
  )
  return sortedSamples[idx] as number
}

export async function runScenario(scenario: BenchScenario): Promise<BenchResult> {
  const iterations = scenario.iterations ?? 50
  const samples: number[] = []
  for (let i = 0; i < iterations; i++) {
    const start = performance.now()
    await scenario.run()
    samples.push(performance.now() - start)
  }
  const sorted = [...samples].sort((a, b) => a - b)
  return {
    name: scenario.name,
    iterations,
    p50Ms: computePercentile(sorted, 50),
    p95Ms: computePercentile(sorted, 95),
    minMs: sorted[0] as number,
    maxMs: sorted[sorted.length - 1] as number,
  }
}

export interface RunBenchmarksOptions {
  // regression threshold multiplier on p95 (default 1.5 = 50% slower fails)
  regressionFactor?: number
  baseline?: Record<string, number>
}

export async function runBenchmarks(
  scenarios: BenchScenario[],
  opts: RunBenchmarksOptions = {},
): Promise<BenchReport> {
  const factor = opts.regressionFactor ?? 1.5
  const baseline = opts.baseline ?? {}
  const results = await Promise.all(scenarios.map(runScenario))
  const regressions: string[] = []
  for (const r of results) {
    const prev = baseline[r.name]
    if (prev != null && r.p95Ms > prev * factor) {
      regressions.push(`${r.name}: p95 ${r.p95Ms.toFixed(2)}ms > baseline ${prev.toFixed(2)}ms x${factor}`)
    }
  }
  return { results, regressions, baseline }
}
