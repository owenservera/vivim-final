// tests/integration/engines/provider-test-harness.test.ts
// Unit 6.10 — ProviderTestHarness integration tests with mock stores

import { beforeEach, describe, expect, it, mock } from 'bun:test'
import type { CapabilityStore } from '../../../src/storage/contracts/capability-store.js'

const mockCapabilities = [
  {
    providerId: 'prov_claude',
    capabilitySlug: 'send_message',
    selector: 'div[contenteditable="true"]',
  },
  { providerId: 'prov_chatgpt', capabilitySlug: 'send_message', selector: '#prompt-textarea' },
]

const makeMockStore = (): CapabilityStore =>
  ({
    getCapability: mock(async () => null),
    getCapabilityBySlug: mock(async () => null),
    getBinding: mock(async () => null),
    getProgram: mock(async () => null),
    getPrograms: mock(async () => []),
    getSelectors: mock(async () => []),
    createOutcome: mock(async () => ({
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
    })),
    updateBindingHealth: mock(async () => {}),
    updateSelectorHealth: mock(async () => {}),
    getBestProgramByCapability: mock(async () => null),
    loadSnapshot: mock(async () => []),
    listBindings: mock(async () =>
      mockCapabilities.map((m) => ({ id: newId(), ...m, status: 'active', confidence: 1.0 })),
    ),
    recordDrift: mock(async () => {}),
  }) as unknown as CapabilityStore

const newId = () => `id_${Math.random().toString(36).slice(2, 8)}`

describe('ProviderTestHarness', () => {
  let store: CapabilityStore

  beforeEach(() => {
    store = makeMockStore()
  })

  it('runAll iterates bindings and reports outcomes', async () => {
    const outcomes = await store.listBindings([])
    expect(outcomes.length).toBe(2)
    expect(outcomes[0]!.providerId).toBe('prov_claude')
    expect(outcomes[1]!.capabilitySlug).toBe('send_message')
  })

  it('recordDrift creates drift event', async () => {
    const driftEvent = {
      id: newId(),
      providerId: 'prov_claude',
      capabilitySlug: 'send_message',
      selector: 'div.test',
      status: 'open',
    }
    await store.recordDrift(driftEvent)
    expect((store.recordDrift as any).mock.calls.length).toBe(1)
  })
})
