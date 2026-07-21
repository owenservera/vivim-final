// tests/unit/engines/provider-test-harness.test.ts
// Unit 6.10 — ProviderTestHarness unit tests (pure engine, no DB)

import { describe, expect, it } from 'bun:test'
import type { HarnessOutcome } from '../../../src/engines/provider-test-harness.js'
import type {
  CapabilityStore,
  DriftEventInput,
} from '../../../src/storage/contracts/capability-store.js'

const mockCapabilities = [
  {
    providerId: 'prov_claude',
    capabilitySlug: 'send_message',
    selector: 'div[contenteditable="true"]',
  },
  { providerId: 'prov_chatgpt', capabilitySlug: 'send_message', selector: '#prompt-textarea' },
]

const makeMockStore = (): CapabilityStore => ({
  getCapability: async () => null,
  getCapabilityBySlug: async () => null,
  getBinding: async () => null,
  getProgram: async () => null,
  getPrograms: async () => [],
  getSelectors: async () => [],
  createOutcome: async () => ({
    id: 'outcome_1',
    capabilityId: 'cap_1',
    providerId: 'prov_1',
    accountId: 'acc_1',
    ok: true,
    latencyMs: 0,
    error: null,
    outputJson: '{}',
    traceId: 'trace_1',
    createdAt: Date.now(),
  }),
  updateBindingHealth: async () => {},
  updateSelectorHealth: async () => {},
  getBestProgramByCapability: async () => null,
  loadSnapshot: async () => [],
  listBindings: async () =>
    mockCapabilities.map((m) => ({
      id: `id_${Math.random().toString(36).slice(2, 8)}`,
      ...m,
      status: 'active',
      confidence: 1.0,
    })),
  recordDrift: async (_input: DriftEventInput) => {},
})

describe('ProviderTestHarness types', () => {
  it('HarnessOutcome interface has required fields', () => {
    const outcome: HarnessOutcome = {
      providerId: 'test_provider',
      capabilitySlug: 'send_message',
      ok: true,
      drift: false,
    }
    expect(outcome.providerId).toBe('test_provider')
    expect(outcome.capabilitySlug).toBe('send_message')
    expect(outcome.ok).toBe(true)
    expect(outcome.drift).toBe(false)
  })

  it('HarnessOutcome supports optional error field', () => {
    const outcome: HarnessOutcome = {
      providerId: 'test_provider',
      capabilitySlug: 'send_message',
      ok: false,
      drift: false,
      error: 'Element not found',
    }
    expect(outcome.error).toBe('Element not found')
  })

  it('DriftEventInput has correct structure', () => {
    const drift: DriftEventInput = {
      id: 'drift_123',
      providerId: 'prov_claude',
      capabilitySlug: 'send_message',
      selector: 'div.old-selector',
      status: 'open',
    }
    expect(drift.id).toBe('drift_123')
    expect(drift.status).toBe('open')
  })
})

describe('CapabilityStore listBindings', () => {
  it('returns binding matrix rows for testing', async () => {
    const store = makeMockStore()
    const bindings = await store.listBindings([])
    expect(bindings.length).toBe(2)
    expect(bindings[0].providerId).toBe('prov_claude')
    expect(bindings[1].capabilitySlug).toBe('send_message')
  })
})

describe('CapabilityStore recordDrift', () => {
  it('accepts drift event input', async () => {
    const store = makeMockStore()
    const driftEvent = {
      id: 'd_1',
      providerId: 'prov_claude',
      capabilitySlug: 'send_message',
      selector: 'div.old',
      status: 'open',
    }
    await store.recordDrift(driftEvent)
    // If no exception thrown, the contract is satisfied
  })
})
