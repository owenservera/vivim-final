// tests/e2e/discoverability/latency-budget.test.ts
// T2 (R2, US3) — Latency budget.
// Times each CLI discovery command and fails if p95 > budget.
// Budget = 4s to account for Bun cold-start overhead (~1.5-2s per spawn).
// The system's own runtime-test uses 5s per-fetch budget.

import { describe, expect, it } from 'bun:test'
import { type CliResult, PROBE_PORT, spawnCli, spawnDevops } from './harness.ts'

const BUDGET_MS = 4000

/** Measure first-run latency separately from warm p95 */
async function coldPlusWarm(
  fn: () => Promise<CliResult>,
  warmRuns = 4,
): Promise<{ cold: number; warmP95: number }> {
  const cold = (await fn()).ms
  const warmSamples: number[] = []
  for (let i = 0; i < warmRuns; i++) {
    warmSamples.push((await fn()).ms)
  }
  warmSamples.sort((a, b) => a - b)
  const idx = Math.min(warmSamples.length - 1, Math.ceil(warmSamples.length * 0.95) - 1)
  return { cold, warmP95: warmSamples[Math.max(0, idx)] ?? 0 }
}

describe('T2 Latency budget', () => {
  it(`devops discover --offline p95 < ${BUDGET_MS}ms`, async () => {
    const { cold, warmP95 } = await coldPlusWarm(() =>
      spawnDevops(['runtime-test', 'discover', '--offline']),
    )
    console.log(`[T2] devops discover --offline cold=${cold}ms warmP95=${warmP95}ms`)
    expect(warmP95).toBeLessThan(BUDGET_MS)
  })

  it(`devops report p95 < ${BUDGET_MS}ms`, async () => {
    const { cold, warmP95 } = await coldPlusWarm(() => spawnDevops(['report']))
    console.log(`[T2] devops report cold=${cold}ms warmP95=${warmP95}ms`)
    expect(warmP95).toBeLessThan(BUDGET_MS)
  })

  it(`vivim help p95 < ${BUDGET_MS}ms`, async () => {
    const { cold, warmP95 } = await coldPlusWarm(() =>
      spawnCli(['help'], { CAP_STORE_PORT: String(PROBE_PORT) }),
    )
    console.log(`[T2] vivim help cold=${cold}ms warmP95=${warmP95}ms`)
    expect(warmP95).toBeLessThan(BUDGET_MS)
  })
})
