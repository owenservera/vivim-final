// Scenario 1: Multi-turn conversation with Claude via Chrome slave
import type { ScenarioModule, ScenarioResult, StressContext } from './harness.js'
import { adoptSlave, createConversation, sendMessage, getMessages, listProviders, skipResult } from './harness.js'

export const meta = { id: 1, name: 'Claude multi-turn conversation', criticality: 'P0' as const, estimatedDuration: '120s' }
const ACCOUNT = 'claude_owservera@gmail.com'

export async function run(ctx: StressContext): Promise<ScenarioResult> {
  ctx.markScenario(1, 'Claude multi-turn')
  const start = Date.now()
  const detail: string[] = []
  const providers = await listProviders()
  const claude = providers.find((p) => p.slug === 'claude' || p.id === 'claude')
  if (!claude) return skipResult(1, 'Claude multi-turn', 'claude provider not found in DB')

  const slave = await adoptSlave('claude', ACCOUNT)
  if (!slave.ok) return skipResult(1, 'Claude multi-turn', `could not adopt Claude slave: ${slave.error}`)
  detail.push(`Slave adopted: ${JSON.stringify(slave.slave?.slaveId ?? 'ok')}`)

  const convId = await createConversation('claude', 'stress-claude-multiturn')
  if (!convId) return skipResult(1, 'Claude multi-turn', 'could not create conversation')
  detail.push('Conversation created')

  let passed = true
  const turns = ['What is 2+2?', 'Now multiply that result by 5', 'What was my first question?']
  let lastText = ''

  for (let i = 0; i < turns.length; i++) {
    const result = await sendMessage(convId, turns[i])
    if (result.ok) {
      detail.push(`Turn ${i + 1}: OK — got ${result.text?.length ?? 0} chars`)
      lastText = result.text ?? ''
    } else {
      detail.push(`Turn ${i + 1}: FAIL — ${result.error}`)
      passed = false
    }
  }

  const msgs = await getMessages(convId)
  detail.push(`Messages stored: ${msgs.length} (expected ${turns.length * 2})`)
  if (msgs.length < turns.length) { detail.push('  WARN: fewer messages than turns sent'); passed = false }

  return { scenarioId: 1, name: 'Claude multi-turn conversation', passed, criticality: 'P0', durationMs: Date.now() - start, detail }
}
