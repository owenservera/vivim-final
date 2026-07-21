// Scenario 9: Multi-model agentic — run same task across 2 free models, compare
import type { ScenarioModule, ScenarioResult, StressContext } from './harness.js'
import { runOpencodeDirect, skipResult } from './harness.js'

export const meta = { id: 9, name: 'OpenCode multi-model comparison', criticality: 'P1' as const, estimatedDuration: '240s' }
const MODELS = ['opencode/deepseek-v4-flash-free', 'opencode/mimo-v2.5-free']

export async function run(ctx: StressContext): Promise<ScenarioResult> {
  ctx.markScenario(9, 'OpenCode multi-model')
  const start = Date.now()
  const detail: string[] = []

  let passed = true
  for (const model of MODELS) {
    detail.push(`Running with model: ${model}`)
    const result = await runOpencodeDirect('Write "hello world" in TypeScript', model)
    if (result.ok && result.blocks.length > 0) {
      detail.push(`  ${model}: OK — ${result.blocks.length} blocks, exit ${result.exitCode}`)
    } else {
      detail.push(`  ${model}: FAIL — exit ${result.exitCode}`)
      passed = false
    }
  }

  return { scenarioId: 9, name: 'OpenCode multi-model comparison', passed, criticality: 'P1', durationMs: Date.now() - start, detail }
}
