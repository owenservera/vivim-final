// tests/unit/engines/capability.test.ts
// Unit 4.2 — CapabilityEngine: execute, login detection, recovery strategies, outcomes.

import { beforeEach, describe, expect, it, mock } from 'bun:test'
import { CapabilityEngine } from '../../../src/engines/capability.js'
import type { ChromeGovernor } from '../../../src/engines/chrome-governor.js'
import type { CapabilityEventBus } from '../../../src/engines/conversation-manager.js'
import type {
  CapabilityBindingRow,
  CapabilityStore,
  CapabilityTaxonomyRow,
  OutcomeRow,
  SelectorStrategyRow,
} from '../../../src/storage/contracts/capability-store.js'

function makeCap(): CapabilityTaxonomyRow {
  return {
    id: 'cap_send',
    slug: 'send_message',
    name: 'Send Message',
    description: null,
    kind: 'composer',
    createdAt: 0,
    updatedAt: 0,
  }
}

function makeBinding(): CapabilityBindingRow {
  return {
    id: 'bind_1',
    capabilityId: 'cap_send',
    providerId: 'claude',
    selectorStrategyId: 'sel_1',
    status: 'healthy',
    healthScore: 1,
    lastSuccessAt: null,
    lastFailureAt: null,
    createdAt: 0,
    updatedAt: 0,
  }
}

function makeSelector(): SelectorStrategyRow {
  return {
    id: 'sel_1',
    capabilityId: 'cap_send',
    providerId: 'claude',
    selector: 'textarea',
    priority: 1,
    strategyType: 'css',
    hitCount: 0,
    missCount: 0,
    createdAt: 0,
    updatedAt: 0,
  }
}

function mockStore(overrides?: Partial<CapabilityStore>): CapabilityStore {
  return {
    getCapability: mock(async () => null),
    getCapabilityBySlug: mock(async () => makeCap()),
    getBinding: mock(async () => makeBinding()),
    getProgram: mock(async () => null),
    getPrograms: mock(async () => []),
    getSelectors: mock(async () => [makeSelector()]),
    createOutcome: mock(
      async (o) =>
        ({ ...o, id: 'out_1', bindingId: o.bindingId ?? null, createdAt: 0 }) as OutcomeRow,
    ),
    updateBindingHealth: mock(async () => {}),
    updateSelectorHealth: mock(async () => {}),
    ...overrides,
  }
}

function mockEventBus(): CapabilityEventBus & { events: unknown[] } {
  const events: unknown[] = []
  return {
    events,
    emit: mock((e: unknown) => {
      events.push(e)
    }),
    on: mock(() => () => {}),
    once: mock(() => () => {}),
    subscribe: mock(() => {}),
    unsubscribe: mock(() => {}),
    unsubscribeAll: mock(() => {}),
    removeAllListeners: mock(() => {}),
    getInstance: mock(() => mockEventBus()),
    resetInstance: mock(() => {}),
  } as unknown as CapabilityEventBus & { events: unknown[] }
}

function mockGovernor(sendImpl?: (...a: unknown[]) => unknown): ChromeGovernor {
  const send = mock(async (...args: unknown[]) => (sendImpl ? sendImpl(...args) : { nodeId: 1 }))
  return {
    ensureRunning: mock(async (slaveId: string) => ({
      slaveId,
      providerId: 'claude',
      accountId: 'acct_1',
      debugPort: 9222,
      profileDir: '/tmp/test',
      status: 'running',
      superState: 'idle',
      pid: 123,
      consecutiveFailures: 0,
      circuitState: 'closed',
      lastHealthCheck: Date.now(),
    })),
    cdp: {
      send,
      capture: mock(async () => ({ url: '', body: '', headers: {}, status: 200 })),
      getPageState: mock(async () => ({
        url: 'https://chat.example.com',
        title: 'Chat',
        readyState: 'complete',
      })),
      captureScreenshot: mock(async () => 'base64'),
    },
  } as unknown as ChromeGovernor
}

describe('CapabilityEngine', () => {
  let store: ReturnType<typeof mockStore>
  let bus: ReturnType<typeof mockEventBus>

  beforeEach(() => {
    store = mockStore()
    bus = mockEventBus()
  })

  it('execute(send_message) sends via Governor CDP and emits capability:executed', async () => {
    const gov = mockGovernor()
    const engine = new CapabilityEngine(gov, store, bus)
    const result = await engine.execute('send_message', 'claude', 'acct_1', { message: 'hi' })
    expect(result.ok).toBe(true)
    expect(result.capabilityId).toBe('cap_send')
    expect(bus.emit).toHaveBeenCalledWith(expect.objectContaining({ type: 'capability:executed' }))
    expect(store.createOutcome).toHaveBeenCalled()
  })

  it('detectLogin() detects logged-in state via DOM indicators', async () => {
    const gov = mockGovernor(() => null) // no login form → logged in
    const engine = new CapabilityEngine(gov, store, bus)
    const login = await engine.detectLogin('claude', 'acct_1')
    expect(login.isLoggedIn).toBe(true)
    expect(login.confidence).toBeGreaterThan(0.5)
  })

  it('Recovery strategy: retry_selector works on first miss', async () => {
    let calls = 0
    const gov = mockGovernor(() => {
      calls++
      if (calls === 1) throw new Error('miss')
      return { nodeId: 1 }
    })
    const engine = new CapabilityEngine(gov, store, bus)
    const result = await engine.execute('send_message', 'claude', 'acct_1', { message: 'hi' })
    expect(result.ok).toBe(true)
    expect(result.recoveryAttempted).toBe(true)
    expect(result.recoveryStrategies?.[0]?.strategy).toBe('retry_selector')
    expect(result.recoveryStrategies?.[0]?.ok).toBe(true)
  })

  it('Recovery strategy: navigate_home redirects and retries', async () => {
    let calls = 0
    const gov = mockGovernor((_slaveId: unknown, method: unknown) => {
      if (method === 'Page.navigate') return {}
      calls++
      if (calls === 1) throw new Error('miss')
      return { nodeId: 1 }
    })
    const engine = new CapabilityEngine(gov, store, bus)
    const result = await engine.execute('send_message', 'claude', 'acct_1', {
      message: 'hi',
      recoveryStrategies: [{ type: 'navigate_home' }],
    })
    expect(result.ok).toBe(true)
    expect(result.recoveryStrategies?.[0]?.strategy).toBe('navigate_home')
  })

  it('Recovery strategy: mark_broken updates binding status on total failure', async () => {
    const gov = mockGovernor(() => {
      throw new Error('always miss')
    })
    const engine = new CapabilityEngine(gov, store, bus)
    const result = await engine.execute('send_message', 'claude', 'acct_1', {
      message: 'hi',
      recoveryStrategies: [{ type: 'mark_broken' }],
    })
    expect(result.ok).toBe(false)
    expect(store.updateBindingHealth).toHaveBeenCalledWith(
      'bind_1',
      expect.objectContaining({ status: 'broken' }),
    )
    expect(bus.emit).toHaveBeenCalledWith(expect.objectContaining({ type: 'capability:failed' }))
  })

  it('Outcome is recorded and selector health updated after each execution', async () => {
    const gov = mockGovernor()
    const engine = new CapabilityEngine(gov, store, bus)
    await engine.execute('send_message', 'claude', 'acct_1', { message: 'hi' })
    expect(store.createOutcome).toHaveBeenCalledTimes(1)
    expect(store.updateSelectorHealth).toHaveBeenCalledWith('sel_1', true)
  })
})
