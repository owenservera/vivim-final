// Scenario 3: Multi-turn conversation with Gemini via Chrome slave
import type { ScenarioModule, ScenarioResult, StressContext } from './harness.js'
import { adoptSlave, createConversation, sendMessage, getMessages, listProviders, skipResult } from './harness.js'

export const meta = { id: 3, name: 'Gemini multi-turn conversation', criticality: 'P0' as const, estimatedDuration: '120s' }
const ACCOUNT = 'gemini_owservera@gmail.com'

export async function run(ctx: StressContext): Promise<ScenarioResult> {
  ctx.markScenario(3, 'Gemini multi-turn')
  const start = Date.now()
  const detail: string[] = []
  const providers = await listProviders()
  const gemini = providers.find((p) => p.slug === 'gemini' || p.id === 'gemini')
  if (!gemini) return skipResult(3, 'Gemini multi-turn', 'gemini provider not found in DB')

  const slave = await adoptSlave('gemini', ACCOUNT)
  if (!slave.ok) return skipResult(3, 'Gemini multi-turn', `could not adopt Gemini slave: ${slave.error}`)
  detail.push(`Slave adopted: ${JSON.stringify(slave.slave?.slaveId ?? 'ok')}`)

  const convId = await createConversation('gemini', 'stress-gemini-multiturn')
  if (!convId) return skipResult(3, 'Gemini multi-turn', 'could not create conversation')
  detail.push('Conversation created')

  let passed = true
  const turns = ['List 3 colors', 'Pick the best one and explain why', 'Which color did I pick?']
  for (let i = 0; i < turns.length; i++) {
    const result = await sendMessage(convId, turns[i])
    if (result.ok) {
      detail.push(`Turn ${i + 1}: OK — got ${result.text?.length ?? 0} chars`)
    } else {
      detail.push(`Turn ${i + 1}: FAIL — ${result.error}`)
      passed = false
    }
  }

  const msgs = await getMessages(convId)
  detail.push(`Messages stored: ${msgs.length} (expected ${turns.length * 2})`)

  return { scenarioId: 3, name: 'Gemini multi-turn conversation', passed, criticality: 'P0', durationMs: Date.now() - start, detail }
}
