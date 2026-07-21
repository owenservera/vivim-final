// Scenario 10: Agentic coding — ask opencode to write a file, verify it exists
import type { ScenarioModule, ScenarioResult, StressContext } from './harness.js'
import { runOpencodeDirect, skipResult } from './harness.js'
import { join } from 'node:path'
import { existsSync, unlinkSync } from 'node:fs'

export const meta = { id: 10, name: 'OpenCode agentic coding (file write)', criticality: 'P0' as const, estimatedDuration: '180s' }

export async function run(ctx: StressContext): Promise<ScenarioResult> {
  ctx.markScenario(10, 'OpenCode agentic coding')
  const start = Date.now()
  const detail: string[] = []

  const testFile = join(process.cwd(), '.stress-test-output.ts')
  if (existsSync(testFile)) { try { unlinkSync(testFile) } catch {} }

  const result = await runOpencodeDirect(
    `Write a TypeScript function to ${testFile.replace(/\\/g, '/')} that calculates Fibonacci numbers using memoization. Only write the file, do not run it.`,
    'opencode/deepseek-v4-flash-free',
  )

  detail.push(`Exit code: ${result.exitCode}`)
  detail.push(`Blocks: ${result.blocks.length}`)

  const fileExists = existsSync(testFile)
  detail.push(`File created: ${fileExists}`)

  let content = ''
  if (fileExists) {
    content = await Bun.file(testFile).text()
    detail.push(`File size: ${content.length} chars`)
    if (content.includes('fib') || content.includes('Fibonacci') || content.includes('memo')) {
      detail.push('  Content includes expected function (fib/Fibonacci/memo)')
    } else {
      detail.push('  WARN: file exists but may not contain Fibonacci function')
    }
    try { unlinkSync(testFile) } catch {}
  }

  const passed = result.ok && fileExists

  return { scenarioId: 10, name: 'OpenCode agentic coding (file write)', passed, criticality: 'P0', durationMs: Date.now() - start, detail, error: passed ? undefined : `exit ${result.exitCode}, file exists: ${fileExists}` }
}
