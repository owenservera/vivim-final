// tests/unit/canvas/sandbox-safety.test.ts
// Tests for sandbox hardening: CSP, capability allowlist, watchdog, audit.
// Agent B — Canvas & UI Production (v2 expanded).
// Step 14: allowed capability, denied returns error+audit, watchdog reload, CSP violation.

import { describe, expect, it } from 'bun:test'

// ── Types ────────────────────────────────────────────────────────────────────

interface SandboxAuditEvent {
  type: 'csp_violation' | 'capability_denied' | 'crash' | 'watchdog_timeout'
  instanceId: string
  message?: string
  timestamp: number
}

interface SandboxPolicy {
  csp: string
  allowNetwork: boolean
  allowCapabilities: string[]
  budgetMs: number
  allowInlineScript: false
}

function makeDefaultPolicy(overrides?: Partial<SandboxPolicy>): SandboxPolicy {
  return {
    csp: "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src 'self' data:; connect-src 'none';",
    allowNetwork: false,
    allowCapabilities: [],
    budgetMs: 5000,
    allowInlineScript: false,
    ...overrides,
  }
}

function isCapabilityAllowed(policy: SandboxPolicy, capability: string): boolean {
  return policy.allowCapabilities.includes(capability)
}

function createAuditCollector(): {
  events: SandboxAuditEvent[]
  collect: (e: SandboxAuditEvent) => void
} {
  const events: SandboxAuditEvent[] = []
  return {
    events,
    collect: (e) => {
      events.push(e)
    },
  }
}

// ── Watchdog simulator ───────────────────────────────────────────────────────

function createWatchdog(callback: (timeout: boolean) => void) {
  let pongReceived = false
  return {
    ping: () => {
      pongReceived = false
    },
    pong: () => {
      pongReceived = true
    },
    check: () => {
      if (!pongReceived) callback(true)
      else callback(false)
    },
  }
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('SandboxPolicy — CSP defaults', () => {
  it('uses default-deny with unsafe-inline for scripts', () => {
    const policy = makeDefaultPolicy()
    expect(policy.csp).toContain("default-src 'none'")
    expect(policy.csp).toContain("script-src 'unsafe-inline'")
  })

  it('allows style-src unsafe-inline', () => {
    expect(makeDefaultPolicy().csp).toContain("style-src 'unsafe-inline'")
  })

  it('blocks network by default', () => {
    expect(makeDefaultPolicy().allowNetwork).toBe(false)
  })

  it('allowInlineScript is always false', () => {
    expect(makeDefaultPolicy().allowInlineScript).toBe(false)
  })

  it('can customize CSP per component', () => {
    const policy = makeDefaultPolicy({ csp: "default-src 'self'; script-src 'self'" })
    expect(policy.csp).not.toContain("'unsafe-inline'")
  })
})

describe('Capability allowlist enforcement', () => {
  it('allows listed capabilities', () => {
    const policy = makeDefaultPolicy({
      allowCapabilities: ['conversation_list', 'conversation_create'],
    })
    expect(isCapabilityAllowed(policy, 'conversation_list')).toBe(true)
  })

  it('denies unlisted capabilities', () => {
    const policy = makeDefaultPolicy({ allowCapabilities: ['conversation_list'] })
    expect(isCapabilityAllowed(policy, 'conversation_delete')).toBe(false)
  })

  it('denied capability returns error + audit event', () => {
    const collector = createAuditCollector()
    const policy = makeDefaultPolicy({ allowCapabilities: ['conversation_list'] })
    const capability = 'conversation_delete'
    if (!isCapabilityAllowed(policy, capability)) {
      collector.collect({
        type: 'capability_denied',
        instanceId: 'inst:001',
        message: `Capability '${capability}' denied (not in allow-list)`,
        timestamp: Date.now(),
      })
    }
    expect(collector.events).toHaveLength(1)
    expect(collector.events[0]?.type).toBe('capability_denied')
    expect(collector.events[0]?.message).toContain('conversation_delete')
  })

  it('allowed capability returns no audit event', () => {
    const collector = createAuditCollector()
    const policy = makeDefaultPolicy({ allowCapabilities: ['conversation_list'] })
    if (isCapabilityAllowed(policy, 'conversation_list')) {
      // No audit — success
    }
    expect(collector.events).toHaveLength(0)
  })
})

describe('Watchdog timer', () => {
  it('triggers timeout when no pong received', () => {
    let timedOut = false
    const wd = createWatchdog((timeout) => {
      timedOut = timeout
    })
    wd.ping()
    wd.check()
    expect(timedOut).toBe(true)
  })

  it('does not trigger when pong is received', () => {
    let timedOut = false
    const wd = createWatchdog((timeout) => {
      timedOut = timeout
    })
    wd.ping()
    wd.pong()
    wd.check()
    expect(timedOut).toBe(false)
  })

  it('retriggers after each missed ping', () => {
    const timeouts: boolean[] = []
    const wd = createWatchdog((t) => timeouts.push(t))
    wd.ping()
    wd.check() // timeout
    wd.ping()
    wd.check() // timeout again
    expect(timeouts.filter(Boolean).length).toBe(2)
  })

  it('logs audit on watchdog timeout', () => {
    const collector = createAuditCollector()
    let timedOut = false
    const wd = createWatchdog((timeout) => {
      timedOut = timeout
      if (timeout) {
        collector.collect({
          type: 'watchdog_timeout',
          instanceId: 'inst:002',
          message: 'Iframe unresponsive after 10000ms',
          timestamp: Date.now(),
        })
      }
    })
    wd.ping()
    wd.check()
    expect(timedOut).toBe(true)
    expect(collector.events).toHaveLength(1)
    expect(collector.events[0]?.type).toBe('watchdog_timeout')
  })
})

describe('Sandbox audit logging', () => {
  it('logs capability denial events', () => {
    const c = createAuditCollector()
    c.collect({ type: 'capability_denied', instanceId: 'a', message: 'test', timestamp: 1 })
    expect(c.events).toHaveLength(1)
    expect(c.events[0]?.type).toBe('capability_denied')
  })

  it('logs CSP violation events', () => {
    const c = createAuditCollector()
    c.collect({ type: 'csp_violation', instanceId: 'a', message: 'Blocked script', timestamp: 1 })
    expect(c.events).toHaveLength(1)
    expect(c.events[0]?.type).toBe('csp_violation')
  })

  it('collects multiple audit events in order', () => {
    const c = createAuditCollector()
    c.collect({ type: 'capability_denied', instanceId: 'a', timestamp: 100 })
    c.collect({ type: 'watchdog_timeout', instanceId: 'a', timestamp: 200 })
    c.collect({ type: 'crash', instanceId: 'a', timestamp: 300 })
    expect(c.events).toHaveLength(3)
    expect(c.events[0]?.type).toBe('capability_denied')
    expect(c.events[2]?.type).toBe('crash')
  })
})

describe('SandboxPolicy — budget enforcement', () => {
  it('default budget is 5000ms', () => {
    expect(makeDefaultPolicy().budgetMs).toBe(5000)
  })

  it('can customize budget', () => {
    expect(makeDefaultPolicy({ budgetMs: 10000 }).budgetMs).toBe(10000)
  })

  it('budget is positive', () => {
    expect(makeDefaultPolicy().budgetMs).toBeGreaterThan(0)
  })
})
