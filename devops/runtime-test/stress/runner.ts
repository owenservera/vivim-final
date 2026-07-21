// devops/runtime-test/stress/runner.ts
// Stress test runner — orchestrate all scenarios, print scorecard

import type { ScenarioResult, ScenarioModule, StressContext } from './harness.js'
import { ensureBackendReady } from './harness.js'

const SCENARIOS: Array<() => Promise<ScenarioModule>> = [
  () => import('./scenario-01-claude-multiturn.js').then((m) => ({ meta: m.meta, run: m.run })),
  () => import('./scenario-02-chatgpt-multiturn.js').then((m) => ({ meta: m.meta, run: m.run })),
  () => import('./scenario-03-gemini-multiturn.js').then((m) => ({ meta: m.meta, run: m.run })),
  () => import('./scenario-04-cross-provider.js').then((m) => ({ meta: m.meta, run: m.run })),
  () => import('./scenario-05-concurrent-send.js').then((m) => ({ meta: m.meta, run: m.run })),
  () => import('./scenario-06-large-response.js').then((m) => ({ meta: m.meta, run: m.run })),
  () => import('./scenario-07-chrome-kill-restart.js').then((m) => ({ meta: m.meta, run: m.run })),
  () => import('./scenario-08-opencode-oneshot.js').then((m) => ({ meta: m.meta, run: m.run })),
  () => import('./scenario-09-opencode-multi-model.js').then((m) => ({ meta: m.meta, run: m.run })),
  () => import('./scenario-10-opencode-agentic-coding.js').then((m) => ({ meta: m.meta, run: m.run })),
]

const SCENARIO_IDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

export interface StressRunResult {
  ok: boolean
  total: number
  passed: number
  failed: number
  skipped: number
  scenarios: ScenarioResult[]
  durationMs: number
}

export async function runStressTests(singleScenarioId?: number): Promise<StressRunResult> {
  const overallStart = Date.now()
  console.log('')
  console.log('═══════════════════════════════════════════════════════════════')
  console.log('  VIVIM STRESS TEST SUITE')
  console.log('═══════════════════════════════════════════════════════════════')
  console.log('')

  // 1. Ensure backend is ready
  console.log('  [harness] Checking backend...')
  const ready = await ensureBackendReady()
  if (!ready) {
    console.log('  [harness] BACKEND NOT REACHABLE — aborting')
    console.log('')
    return {
      ok: false, total: 0, passed: 0, failed: 0, skipped: 0,
      scenarios: [], durationMs: Date.now() - overallStart,
    }
  }
  console.log('  [harness] Backend reachable')
  console.log('')

  // 2. Determine which scenarios to run
  const loaders = singleScenarioId
    ? SCENARIOS.filter((_, i) => SCENARIO_IDS[i] === singleScenarioId)
    : SCENARIOS

  if (loaders.length === 0) {
    console.log(`  No matching scenario for ID ${singleScenarioId}`)
    return {
      ok: false, total: 0, passed: 0, failed: 0, skipped: 0,
      scenarios: [], durationMs: Date.now() - overallStart,
    }
  }

  const results: ScenarioResult[] = []
  let currentScenarioName = ''
  let currentScenarioId = 0

  const ctx: StressContext = {
    baseUrl: '',
    markScenario: (id: number, name: string) => {
      currentScenarioId = id
      currentScenarioName = name
    },
  }

  for (const loader of loaders) {
    const mod = await loader()
    console.log(`  ── [S${mod.meta.id}] ${mod.meta.name} (${mod.meta.criticality}) ──`)

    try {
      const result = await mod.run(ctx)
      results.push(result)

      const icon = result.skipped ? '⊘' : (result.passed ? '✓' : '✗')
      const label = result.skipped ? 'SKIP' : (result.passed ? 'PASS' : 'FAIL')
      console.log(`  ${icon} ${label} (${result.durationMs}ms)`)
      for (const line of result.detail) {
        console.log(`    ${line}`)
      }
      if (result.error) {
        console.log(`    ERROR: ${result.error}`)
      }
    } catch (err) {
      console.log(`  ✗ THREW: ${err instanceof Error ? err.message : String(err)}`)
      results.push({
        scenarioId: mod.meta.id,
        name: mod.meta.name,
        passed: false,
        criticality: mod.meta.criticality,
        durationMs: Date.now() - overallStart,
        detail: [],
        error: err instanceof Error ? err.message : String(err),
      })
    }
    console.log('')
  }

  const passed = results.filter((r) => r.passed && !r.skipped)
  const skipped = results.filter((r) => r.skipped)
  const failed = results.filter((r) => !r.passed && !r.skipped)
  const totalDuration = Date.now() - overallStart

  // 3. Scorecard
  console.log('═══════════════════════════════════════════════════════════════')
  console.log('  SCORECARD')
  console.log('═══════════════════════════════════════════════════════════════')
  console.log(`  Total:   ${results.length}`)
  console.log(`  Passed:  ${passed.length}`)
  console.log(`  Skipped: ${skipped.length}`)
  console.log(`  Failed:  ${failed.length}`)
  console.log(`  Time:    ${totalDuration}ms`)
  console.log('')
  if (skipped.length > 0) {
    console.log('  SKIPPED:')
    for (const s of skipped) {
      console.log(`    [S${s.scenarioId}] ${s.name} — ${s.detail[0] ?? 'no reason'}`)
    }
    console.log('')
  }
  if (failed.length > 0) {
    console.log('  FAILURES:')
    for (const f of failed) {
      console.log(`    [S${f.scenarioId}] ${f.name} — ${f.error ?? 'assertion failed'}`)
    }
    console.log('')
  }
  console.log('═══════════════════════════════════════════════════════════════')
  console.log(`  RESULT: ${failed.length === 0 ? 'ALL PASSED' : `${failed.length} FAILURE(S)`}`)
  console.log('═══════════════════════════════════════════════════════════════')

  return {
    ok: failed.length === 0,
    total: results.length,
    passed: passed.length,
    failed: failed.length,
    skipped: skipped.length,
    scenarios: results,
    durationMs: totalDuration,
  }
}
