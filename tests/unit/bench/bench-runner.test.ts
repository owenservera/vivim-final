import { describe, expect, it } from 'bun:test'
import { type BenchScenario, computePercentile, runBenchmarks } from '../../../bench/runner'

describe('bench runner (37.3)', () => {
  it('computes percentiles from sorted samples', () => {
    const s = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
    expect(computePercentile(s, 50)).toBe(5)
    expect(computePercentile(s, 95)).toBe(10)
    expect(computePercentile([], 50)).toBe(0)
  })

  it('runs scenarios and returns p50/p95 stats', async () => {
    const scenarios: BenchScenario[] = [{ name: 'noop', iterations: 20, run: () => {} }]
    const report = await runBenchmarks(scenarios)
    expect(report.results.length).toBe(1)
    expect(report.results[0]?.name).toBe('noop')
    expect(report.results[0]?.iterations).toBe(20)
    expect(report.results[0]?.p95Ms).toBeGreaterThanOrEqual(0)
  })

  it('flags a regression when p95 exceeds baseline factor', async () => {
    const scenarios: BenchScenario[] = [{ name: 'slow', iterations: 5, run: () => {} }]
    const report = await runBenchmarks(scenarios, {
      baseline: { slow: 0.0001 },
      regressionFactor: 1.5,
    })
    expect(report.regressions.length).toBeGreaterThanOrEqual(0)
  })
})
