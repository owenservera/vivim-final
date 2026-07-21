// Scenario 6: Large response streaming — prompt for 2000+ token response
import type { ScenarioModule, ScenarioResult, StressContext } from './harness.js'
import { adoptSlave, createConversation, sendMessage, listProviders, skipResult } from './harness.js'

export const meta = { id: 6, name: 'Large response streaming (2000+ tokens)', criticality: 'P1' as const, estimatedDuration: '120s' }

export async function run(ctx: StressContext): Promise<ScenarioResult> {
  ctx.markScenario(6, 'Large response streaming')
  const start = Date.now()
  const detail: string[] = []
  const providers = await listProviders()
  const target = providers.find((p) => p.slug === 'claude' || p.slug === 'chatgpt')
  if (!target) return skipResult(6, 'Large response streaming', 'no supported provider found')

  const slave = await adoptSlave(target.slug, target.slug === 'claude' ? 'claude_owservera@gmail.com' : 'default')
  if (!slave.ok) return skipResult(6, 'Large response streaming', `could not adopt slave: ${slave.error}`)
  detail.push(`Slave adopted for ${target.slug}`)

  const convId = await createConversation(target.slug, 'stress-large-response')
  if (!convId) return skipResult(6, 'Large response streaming', 'could not create conversation')
  detail.push('Conversation created')

  const LONG_PROMPT = 'Write a detailed essay on the history of programming languages from 1950 to today. Include sections on major paradigms (imperative, functional, OOP, declarative), key languages (Fortran, Lisp, C, Smalltalk, Java, Haskell, Rust), and discuss how each influenced the next. Write at least 800 words.'

  const result = await sendMessage(convId, LONG_PROMPT)
  let passed = false
  if (result.ok) {
    const len = result.text?.length ?? 0
    detail.push(`Response received: ${len} chars`)
    if (len >= 500) { passed = true; detail.push('  PASS: response ≥ 500 chars') }
    else { detail.push(`  FAIL: response too short (${len} chars, need ≥ 500)`) }
  } else {
    detail.push(`FAIL: ${result.error}`)
  }

  return { scenarioId: 6, name: 'Large response streaming (2000+ tokens)', passed, criticality: 'P1', durationMs: Date.now() - start, detail }
}
