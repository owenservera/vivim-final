// tests/unit/engines/send-resilience.test.ts
// SendResilienceEngine — preflight gate, auto-reconnect, error classification.
import { beforeEach, describe, expect, it, mock } from 'bun:test'
import { SendResilienceEngine } from '../../../src/engines/send-resilience.js'

function makeDeps() {
  const healthMap = new Map([['s1', { status: 'running' as const }]])
  return {
    governor: {
      getAllHealth: mock(() => Promise.resolve(healthMap)),
      launch: mock(() => Promise.resolve()),
    } as any,
    health: {
      getHealth: mock(() => ({ signals: [] })),
    } as any,
    send: mock(() => Promise.resolve({ ok: true, messageId: 'msg-1' })),
    reconnectBudgetMs: 5000,
  }
}

describe('SendResilienceEngine', () => {
  let deps: ReturnType<typeof makeDeps>
  let engine: SendResilienceEngine

  beforeEach(() => {
    deps = makeDeps()
    engine = new SendResilienceEngine(deps)
  })

  it('sendResilient calls underlying send on success', async () => {
    const result = await engine.sendResilient({
      providerId: 'chatgpt',
      slaveId: 's1',
      text: 'hello',
      conversationId: 'c1',
    })
    expect(result.ok).toBe(true)
    expect(result.messageId).toBe('msg-1')
    expect(deps.send).toHaveBeenCalled()
  })

  it('preflight returns ok when healthy', async () => {
    const result = await engine.preflight('chatgpt', 's1')
    expect(result.ok).toBe(true)
  })

  it('preflight detects chrome crash when slave not found', async () => {
    const emptyMap = new Map()
    deps.governor.getAllHealth.mockResolvedValue(emptyMap)
    const result = await engine.preflight('chatgpt', 'missing')
    expect(result.ok).toBe(false)
    expect(result.recoveryKind).toBe('chrome_crash')
  })
})
