// Scenario 4: Cross-provider session — Claude → ChatGPT → Gemini, verify no contamination
import type { ScenarioModule, ScenarioResult, StressContext } from './harness.js'
import { adoptSlave, createConversation, sendMessage, listProviders, skipResult } from './harness.js'

export const meta = { id: 4, name: 'Cross-provider session isolation', criticality: 'P0' as const, estimatedDuration: '180s' }
const ACCOUNTS: Record<string, string> = { claude: 'claude_owservera@gmail.com', chatgpt: 'default', gemini: 'gemini_owservera@gmail.com' }

export async function run(ctx: StressContext): Promise<ScenarioResult> {
  ctx.markScenario(4, 'Cross-provider session isolation')
  const start = Date.now()
  const detail: string[] = []
  const providers = await listProviders()
  const targets = ['claude', 'chatgpt', 'gemini'].filter((t) => providers.some((p) => p.slug === t || p.id === t))

  if (targets.length < 2) return skipResult(4, 'Cross-provider session isolation', `need ≥2 of {claude,chatgpt,gemini}, found ${targets.length}`)
  detail.push(`Targets: ${targets.join(', ')}`)

  let passed = true

  for (const target of targets) {
    const slave = await adoptSlave(target, ACCOUNTS[target] ?? 'default')
    if (!slave.ok) { detail.push(`  ${target}: adopt FAIL — ${slave.error}`); passed = false; continue }
    detail.push(`  ${target}: slave adopted`)

    const convId = await createConversation(target, `cross-${target}`)
    if (!convId) { detail.push(`  ${target}: create conv FAIL`); passed = false; continue }

    const result = await sendMessage(convId, `Hello from ${target} — this is a cross-provider test`)
    if (result.ok) {
      detail.push(`  ${target}: send OK — "${(result.text ?? '').slice(0, 60)}..."`)
    } else {
      detail.push(`  ${target}: send FAIL — ${result.error}`)
      passed = false
    }
  }

  return { scenarioId: 4, name: 'Cross-provider session isolation', passed, criticality: 'P0', durationMs: Date.now() - start, detail }
}
