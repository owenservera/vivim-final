// Scenario 2: Multi-turn conversation with ChatGPT via Chrome slave
import type { ScenarioModule, ScenarioResult, StressContext } from './harness.js'
import { adoptSlave, createConversation, sendMessage, getMessages, listProviders, skipResult } from './harness.js'

export const meta = { id: 2, name: 'ChatGPT multi-turn conversation', criticality: 'P0' as const, estimatedDuration: '120s' }
const ACCOUNT = 'default'

export async function run(ctx: StressContext): Promise<ScenarioResult> {
  ctx.markScenario(2, 'ChatGPT multi-turn')
  const start = Date.now()
  const detail: string[] = []
  const providers = await listProviders()
  const chatgpt = providers.find((p) => p.slug === 'chatgpt' || p.id === 'chatgpt')
  if (!chatgpt) return skipResult(2, 'ChatGPT multi-turn', 'chatgpt provider not found in DB')

  const slave = await adoptSlave('chatgpt', ACCOUNT)
  if (!slave.ok) return skipResult(2, 'ChatGPT multi-turn', `could not adopt ChatGPT slave: ${slave.error}`)
  detail.push(`Slave adopted: ${JSON.stringify(slave.slave?.slaveId ?? 'ok')}`)

  const convId = await createConversation('chatgpt', 'stress-chatgpt-multiturn')
  if (!convId) return skipResult(2, 'ChatGPT multi-turn', 'could not create conversation')
  detail.push('Conversation created')

  let passed = true
  const turns = ['Write a haiku about programming', 'Make it about Rust', 'Now combine both haikus']
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

  return { scenarioId: 2, name: 'ChatGPT multi-turn conversation', passed, criticality: 'P0', durationMs: Date.now() - start, detail }
}
