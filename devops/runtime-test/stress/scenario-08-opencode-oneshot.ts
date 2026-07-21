// Scenario 8: One-shot agentic task via opencode CLI (deepseek-v4-flash-free)
import type { ScenarioModule, ScenarioResult, StressContext } from './harness.js'
import { runOpencodeDirect, skipResult } from './harness.js'

export const meta = { id: 8, name: 'OpenCode one-shot agentic task (deepseek free)', criticality: 'P0' as const, estimatedDuration: '120s' }

export async function run(ctx: StressContext): Promise<ScenarioResult> {
  ctx.markScenario(8, 'OpenCode one-shot')
  const start = Date.now()
  const detail: string[] = []

  try {
    const which = Bun.spawnSync(['which', 'opencode'], {});
    const where = Bun.spawnSync(['where', 'opencode'], {});
    if (which.exitCode !== 0 && where.exitCode !== 0) {
      return skipResult(8, 'OpenCode one-shot agentic task', 'opencode CLI not found on PATH')
    }
  } catch {
    return skipResult(8, 'OpenCode one-shot agentic task', 'opencode CLI not found on PATH')
  }
  detail.push('opencode CLI found')

  const result = await runOpencodeDirect(
    'List the files in the current directory and count how many TypeScript files exist',
    'opencode/deepseek-v4-flash-free',
  )

  detail.push(`Exit code: ${result.exitCode}`)
  detail.push(`Stdout blocks: ${result.blocks.length}`)
  if (result.blocks.length > 0) {
    detail.push(`First output: "${result.blocks[0]?.text?.slice(0, 80) ?? 'n/a'}..."`)
  }

  const passed = result.ok && result.blocks.length > 0

  return { scenarioId: 8, name: 'OpenCode one-shot agentic task (deepseek free)', passed, criticality: 'P0', durationMs: Date.now() - start, detail, error: passed ? undefined : `exit ${result.exitCode}, ${result.blocks.length} blocks` }
}
