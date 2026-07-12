// tests/unit/engines/execution-policy.test.ts
import { beforeEach, describe, expect, it } from 'bun:test'
import { ExecutionPolicyEngine, type PolicyStore } from '../../../src/engines/execution-policy.js'

function mockStore(): PolicyStore & {
  rules: Map<string, Record<string, unknown>>
  occurrences: Map<string, number[]>
} {
  const rules = new Map<string, Record<string, unknown>>()
  const occurrences = new Map<string, number[]>()
  return {
    rules,
    occurrences,
    async createRule(rule) {
      this.rules.set(rule.id as string, rule)
    },
    async updateRule(id, patch) {
      const r = this.rules.get(id)
      if (r) Object.assign(r, patch)
    },
    async getRule(id) {
      return this.rules.get(id) ?? null
    },
    async listRules() {
      return Array.from(this.rules.values())
    },
    async getRecentOccurrences(action, windowMs) {
      const now = Date.now()
      const timestamps = this.occurrences.get(action) ?? []
      return timestamps.filter((t) => now - t < windowMs).length
    },
  }
}

describe('ExecutionPolicyEngine', () => {
  let store: ReturnType<typeof mockStore>
  let engine: ExecutionPolicyEngine

  beforeEach(async () => {
    store = mockStore()
    engine = new ExecutionPolicyEngine(store)
    await engine.initialize()
  })

  it('read action allowed without approval', async () => {
    const decision = await engine.evaluate('get', {})
    expect(decision.allowed).toBe(true)
    expect(decision.classification).toBe('read')
    expect(decision.requiresApproval).toBe(false)
  })

  it('navigate action allowed without approval', async () => {
    const decision = await engine.evaluate('navigate', { url: 'https://example.com' })
    expect(decision.allowed).toBe(true)
    expect(decision.classification).toBe('navigate')
    expect(decision.requiresApproval).toBe(false)
  })

  it('write action requires approval', async () => {
    const decision = await engine.evaluate('create', { data: 'test' })
    expect(decision.allowed).toBe(true)
    expect(decision.classification).toBe('write')
    expect(decision.requiresApproval).toBe(true)
  })

  it('destructive action always requires approval', async () => {
    const decision = await engine.evaluate('delete_permanent', { id: '123' })
    expect(decision.allowed).toBe(true)
    expect(decision.classification).toBe('destructive')
    expect(decision.requiresApproval).toBe(true)
  })

  it('financial action always requires approval', async () => {
    const decision = await engine.evaluate('purchase', { item: 'widget' })
    expect(decision.allowed).toBe(true)
    expect(decision.classification).toBe('financial')
    expect(decision.requiresApproval).toBe(true)
  })

  it('communication action requires approval', async () => {
    const decision = await engine.evaluate('send_email', { to: 'test@example.com' })
    expect(decision.allowed).toBe(true)
    expect(decision.classification).toBe('communication')
    expect(decision.requiresApproval).toBe(true)
  })

  it('classify returns correct classification', async () => {
    expect(await engine.classify('get')).toBe('read')
    expect(await engine.classify('navigate')).toBe('navigate')
    expect(await engine.classify('create')).toBe('write')
    expect(await engine.classify('delete_permanent')).toBe('destructive')
    expect(await engine.classify('purchase')).toBe('financial')
    expect(await engine.classify('send_email')).toBe('communication')
  })

  it('unknown action defaults to read', async () => {
    const decision = await engine.evaluate('custom_unknown_action', {})
    expect(decision.allowed).toBe(true)
    expect(decision.classification).toBe('read')
  })

  it('addRule adds a custom rule', async () => {
    const rule = await engine.addRule({
      name: 'custom_rule',
      condition: 'action matches ^custom$',
      classification: 'write',
      requiresApproval: true,
      cooldownMs: 0,
      maxOccurrences: 5,
      windowMs: 60_000,
      isActive: true,
    })
    expect(rule.id).toBeDefined()
    expect(rule.name).toBe('custom_rule')
    const rules = await engine.listRules()
    expect(rules.length).toBe(7) // 6 defaults + 1 custom
  })

  it('cooldown blocks rapid repeated actions', async () => {
    // Add a rule with cooldown
    await engine.addRule({
      name: 'cooldown_test',
      condition: 'action matches ^cooldown_action$',
      classification: 'write',
      requiresApproval: false,
      cooldownMs: 60_000,
      maxOccurrences: 100,
      windowMs: 60_000,
      isActive: true,
    })

    // First occurrence should be allowed
    store.occurrences.set('cooldown_action', [Date.now()])
    const decision = await engine.evaluate('cooldown_action', {})
    expect(decision.allowed).toBe(false)
    expect(decision.reason).toContain('Cooldown')
  })

  it('max occurrences blocks when limit reached', async () => {
    await engine.addRule({
      name: 'max_occ_test',
      condition: 'action matches ^limited_action$',
      classification: 'write',
      requiresApproval: false,
      cooldownMs: 0,
      maxOccurrences: 2,
      windowMs: 60_000,
      isActive: true,
    })

    // Simulate 2 recent occurrences
    const now = Date.now()
    store.occurrences.set('limited_action', [now - 1000, now - 500])
    const decision = await engine.evaluate('limited_action', {})
    expect(decision.allowed).toBe(false)
    expect(decision.reason).toContain('Max occurrences')
  })

  it('listRules returns all default rules', async () => {
    const rules = await engine.listRules()
    expect(rules.length).toBe(6)
    expect(rules.map((r) => r.name)).toContain('read_only_safe')
    expect(rules.map((r) => r.name)).toContain('navigate_safe')
    expect(rules.map((r) => r.name)).toContain('write_needs_approval')
    expect(rules.map((r) => r.name)).toContain('destructive_always')
    expect(rules.map((r) => r.name)).toContain('financial_always')
    expect(rules.map((r) => r.name)).toContain('communication_always')
  })
})
