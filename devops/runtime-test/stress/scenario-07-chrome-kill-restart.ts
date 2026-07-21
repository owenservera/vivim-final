// Scenario 7: Kill Chrome mid-message, verify Governor auto-restart
import type { ScenarioModule, ScenarioResult, StressContext } from './harness.js'
import { adoptSlave, createConversation, sendMessage, killChromeProcesses, listProviders, getFleetStatus, skipResult } from './harness.js'

export const meta = { id: 7, name: 'Chrome kill + Governor auto-restart', criticality: 'P0' as const, estimatedDuration: '90s' }

export async function run(ctx: StressContext): Promise<ScenarioResult> {
  ctx.markScenario(7, 'Chrome kill + restart')
  const start = Date.now()
  const detail: string[] = []
  const providers = await listProviders()
  const target = providers.find((p) => p.slug === 'claude')
  if (!target) return skipResult(7, 'Chrome kill + restart', 'claude provider not found')

  const slave = await adoptSlave('claude', 'claude_owservera@gmail.com')
  if (!slave.ok) return skipResult(7, 'Chrome kill + restart', `could not adopt slave: ${slave.error}`)
  detail.push('Slave adopted')

  const convId = await createConversation('claude', 'stress-chrome-kill')
  if (!convId) return skipResult(7, 'Chrome kill + restart', 'could not create conversation')

  const before = await sendMessage(convId, 'Say "hello"')
  detail.push(`Before kill: ${before.ok ? 'OK' : 'FAIL'}`)
  if (!before.ok) { return { scenarioId: 7, name: 'Chrome kill + restart', passed: false, criticality: 'P0', durationMs: Date.now() - start, detail, error: 'baseline send failed' } }

  await killChromeProcesses()
  detail.push('Chrome killed — waiting 5s for Governor to detect...')
  await Bun.sleep(5000)

  const after = await sendMessage(convId, 'Are you still there?')
  if (after.ok) {
    detail.push('After kill+restart: send_message OK (Governor auto-restarted)')
  } else {
    detail.push(`After kill+restart: send FAIL — ${after.error}`)
  }

  return { scenarioId: 7, name: 'Chrome kill + Governor auto-restart', passed: after.ok, criticality: 'P0', durationMs: Date.now() - start, detail }
}
