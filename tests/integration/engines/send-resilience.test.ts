// tests/integration/engines/send-resilience.test.ts
// Integration tests for SendResilienceEngine (spec 007-conversation-resilience).
// Mocks SendResilienceDeps (governor / health / wizard / send) — no real Chrome.

import { describe, expect, it, mock } from 'bun:test'
import type { SendInput, SendResilienceDeps } from '../../../src/engines/send-resilience.js'
import { SendResilienceEngine } from '../../../src/engines/send-resilience.js'
import { SendResilienceError } from '../../../src/errors.js'

const INPUT: SendInput = {
  providerId: 'chatgpt',
  slaveId: 'slave:chatgpt:acct1',
  text: 'hello',
  conversationId: 'conv_1',
  lastMessage: 'hello',
}

function makeDeps(overrides: Partial<SendResilienceDeps> = {}): SendResilienceDeps {
  return {
    governor: {
      getAllHealth: mock(async () => new Map()),
      getAllSlaves: mock(() => []),
      launch: mock(async () => ({ status: 'running' }) as never),
    } as unknown as SendResilienceDeps['governor'],
    health: {
      getHealth: mock(() => null),
    } as unknown as SendResilienceDeps['health'],
    wizard: {
      needsSetup: mock(async () => true),
    } as unknown as SendResilienceDeps['wizard'],
    send: mock(async () => ({ ok: true, messageId: 'm1' })),
    ...overrides,
  }
}

describe('SendResilienceEngine.preflight', () => {
  it('passes when slave is running, CDP connected, session valid', async () => {
    const deps = makeDeps({
      governor: {
        getAllHealth: mock(async () => new Map([['slave:chatgpt:acct1', { status: 'running' }]])),
        getAllSlaves: mock(() => []),
        launch: mock(async () => ({ status: 'running' }) as never),
        isConnected: mock(() => true),
      } as unknown as SendResilienceDeps['governor'],
      health: {
        getHealth: mock(() => ({
          signals: [{ signal: 'session_expiry', value: 100 }],
        })),
      } as unknown as SendResilienceDeps['health'],
    })
    const engine = new SendResilienceEngine(deps)
    const res = await engine.preflight('chatgpt', 'slave:chatgpt:acct1')
    expect(res.ok).toBe(true)
  })

  it('reports chrome_crash when slave is stopped', async () => {
    const deps = makeDeps({
      governor: {
        getAllHealth: mock(async () => new Map([['slave:chatgpt:acct1', { status: 'stopped' }]])),
        getAllSlaves: mock(() => []),
        launch: mock(async () => ({ status: 'running' }) as never),
      } as unknown as SendResilienceDeps['governor'],
    })
    const engine = new SendResilienceEngine(deps)
    const res = await engine.preflight('chatgpt', 'slave:chatgpt:acct1')
    expect(res.ok).toBe(false)
    expect(res.recoveryKind).toBe('chrome_crash')
  })

  it('reports session_expired when session signal is 0', async () => {
    const deps = makeDeps({
      governor: {
        getAllHealth: mock(async () => new Map([['slave:chatgpt:acct1', { status: 'running' }]])),
        getAllSlaves: mock(() => []),
        launch: mock(async () => ({ status: 'running' }) as never),
      } as unknown as SendResilienceDeps['governor'],
      health: {
        getHealth: mock(() => ({ signals: [{ signal: 'session_expiry', value: 0 }] })),
      } as unknown as SendResilienceDeps['health'],
    })
    const engine = new SendResilienceEngine(deps)
    const res = await engine.preflight('chatgpt', 'slave:chatgpt:acct1')
    expect(res.ok).toBe(false)
    expect(res.recoveryKind).toBe('session_expired')
  })
})

describe('SendResilienceEngine.sendResilient', () => {
  it('throws SendResilienceError on pre-flight chrome_crash', async () => {
    const deps = makeDeps({
      governor: {
        getAllHealth: mock(async () => new Map([['slave:chatgpt:acct1', { status: 'stopped' }]])),
        getAllSlaves: mock(() => []),
        launch: mock(async () => ({ status: 'running' }) as never),
      } as unknown as SendResilienceDeps['governor'],
    })
    const engine = new SendResilienceEngine(deps)
    await expect(engine.sendResilient(INPUT)).rejects.toBeInstanceOf(SendResilienceError)
  })

  it('auto-reconnects once on cdp_down then resends successfully', async () => {
    let calls = 0
    const deps = makeDeps({
      governor: {
        getAllHealth: mock(async () => new Map([['slave:chatgpt:acct1', { status: 'running' }]])),
        getAllSlaves: mock(() => []),
        launch: mock(async () => ({ status: 'running' }) as never),
      } as unknown as SendResilienceDeps['governor'],
      send: mock(async () => {
        calls++
        if (calls === 1) throw new Error('cdp transport not configured')
        return { ok: true, messageId: 'm2' }
      }),
    })
    const engine = new SendResilienceEngine(deps)
    const out = await engine.sendResilient(INPUT)
    expect(out.ok).toBe(true)
    expect(calls).toBe(2) // first failed, second after reconnect succeeded
  })

  it('throws with autoReconnectAttempted=true after second cdp_down failure', async () => {
    const deps = makeDeps({
      governor: {
        getAllHealth: mock(async () => new Map([['slave:chatgpt:acct1', { status: 'running' }]])),
        getAllSlaves: mock(() => []),
        launch: mock(async () => ({ status: 'running' }) as never),
      } as unknown as SendResilienceDeps['governor'],
      send: mock(async () => {
        throw new Error('cdp transport not configured')
      }),
    })
    const engine = new SendResilienceEngine(deps)
    try {
      await engine.sendResilient(INPUT)
      throw new Error('should have thrown')
    } catch (err) {
      expect(err).toBeInstanceOf(SendResilienceError)
      expect((err as SendResilienceError).recoveryKind).toBe('cdp_down')
      expect((err as SendResilienceError).autoReconnectAttempted).toBe(true)
    }
  })

  it('maps circuit-open EngineError to circuit_open with retryAfterMs', async () => {
    const { EngineError } = await import('../../../src/errors.js')
    const deps = makeDeps({
      governor: {
        getAllHealth: mock(async () => new Map([['slave:chatgpt:acct1', { status: 'running' }]])),
        getAllSlaves: mock(() => []),
        launch: mock(async () => ({ status: 'running' }) as never),
      } as unknown as SendResilienceDeps['governor'],
      send: mock(async () => {
        throw new EngineError('Circuit breaker open for slave: slave:chatgpt:acct1')
      }),
    })
    const engine = new SendResilienceEngine(deps)
    try {
      await engine.sendResilient(INPUT)
      throw new Error('should have thrown')
    } catch (err) {
      expect(err).toBeInstanceOf(SendResilienceError)
      expect((err as SendResilienceError).recoveryKind).toBe('circuit_open')
      expect((err as SendResilienceError).retryAfterMs).toBeGreaterThan(0)
    }
  })
})

describe('SendResilienceEngine.recover', () => {
  it('retry reconnects and resends lastMessage', async () => {
    let calls = 0
    const deps = makeDeps({
      governor: {
        getAllHealth: mock(async () => new Map([['slave:chatgpt:acct1', { status: 'running' }]])),
        getAllSlaves: mock(() => []),
        launch: mock(async () => ({ status: 'running' }) as never),
      } as unknown as SendResilienceDeps['governor'],
      send: mock(async (i: SendInput) => {
        calls++
        if (calls === 1) throw new Error('cdp transport not configured')
        expect(i.text).toBe('hello') // lastMessage
        return { ok: true, messageId: 'm3' }
      }),
    })
    const engine = new SendResilienceEngine(deps)
    const out = await engine.recover('chrome_crash', INPUT)
    expect(out.ok).toBe(true)
    expect(calls).toBe(2)
  })

  it('relogin invokes wizard.needsSetup and launches visible', async () => {
    const launch = mock(async () => ({ status: 'running' }) as never)
    const needsSetup = mock(async () => true)
    const deps = makeDeps({
      governor: {
        getAllHealth: mock(async () => new Map()),
        getAllSlaves: mock(() => []),
        launch,
      } as unknown as SendResilienceDeps['governor'],
      wizard: { needsSetup } as unknown as SendResilienceDeps['wizard'],
    })
    const engine = new SendResilienceEngine(deps)
    const out = await engine.recover('relogin', INPUT)
    expect(out.ok).toBe(true)
    expect(needsSetup).toHaveBeenCalledWith('chatgpt', 'slave:chatgpt:acct1')
    expect(launch).toHaveBeenCalledWith('chatgpt', { visible: true })
  })
})
