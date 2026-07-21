// Scenario 5: Concurrent queue pressure — fire 2 sends simultaneously to same provider
import type { ScenarioModule, ScenarioResult, StressContext } from './harness.js'
import { adoptSlave, createConversation, sendMessage, listProviders, skipResult } from './harness.js'

export const meta = { id: 5, name: 'Concurrent send queue pressure', criticality: 'P0' as const, estimatedDuration: '120s' }

export async function run(ctx: StressContext): Promise<ScenarioResult> {
  ctx.markScenario(5, 'Concurrent send')
  const start = Date.now()
  const detail: string[] = []
  const providers = await listProviders()
  const target = providers.find((p) => p.slug === 'claude')
  if (!target) return skipResult(5, 'Concurrent send', 'claude provider not found')

  const slave = await adoptSlave('claude', 'claude_owservera@gmail.com')
  if (!slave.ok) return skipResult(5, 'Concurrent send', `could not adopt slave: ${slave.error}`)
  detail.push('Slave adopted')

  const convId = await createConversation('claude', 'stress-concurrent')
  if (!convId) return skipResult(5, 'Concurrent send', 'could not create conversation')
  detail.push('Conversation created')

  const promises = [
    sendMessage(convId, 'Write a short poem about the ocean'),
    sendMessage(convId, 'Write a short poem about mountains'),
  ]

  const results = await Promise.allSettled(promises)
  const ok = results.filter((r) => r.status === 'fulfilled' && r.value.ok).length
  const fail = results.filter((r) => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.ok)).length
  detail.push(`Concurrent sends: ${ok} OK, ${fail} FAIL`)
  const passed = ok > 0

  return { scenarioId: 5, name: 'Concurrent send queue pressure', passed, criticality: 'P0', durationMs: Date.now() - start, detail }
}
