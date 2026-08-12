// tests/unit/engines/nlcl/execution-kernel-wiring.test.ts
// Proves the P0 ExecutionKernel wiring into NLCL works end-to-end (Alpha Gates A/B/C).
// The kernel is OFF by default in production; this test injects it directly via
// router.setKernel(...) to verify the hardened lifecycle (policy block, correct
// plan shape + runner input, and confirmation gate) without booting the server.

import { describe, expect, test } from 'bun:test'
import { ExecutionKernel, MemoryJournal } from '../../../../src/engines/execution-kernel.js'
import { P0PolicyEngine } from '../../../../src/engines/policy-engine.js'
import { IntentRouter } from '../../../../src/engines/nlcl/intent-router.js'
import type { UnifiedCapabilityRegistry } from '../../../../src/engines/unified-registry.js'
import type { ActionClassification, NLCContext, ParsedIntent } from '../../../../src/engines/nlcl/types.js'

interface FakeRegistry {
  calls: Array<{ id: string; input: Record<string, unknown>; ctx: unknown }>
  get: () => unknown
  getBySlug: () => unknown
  execute: (id: string, input: Record<string, unknown>, ctx: unknown) => Promise<unknown>
}

function makeRegistry(requiresConfirmation: boolean): FakeRegistry {
  const calls: FakeRegistry['calls'] = []
  const cap = {
    id: 'cap:test:demo',
    slug: 'test_demo',
    name: 'Demo',
    description: '',
    category: 'test',
    surfaces: ['cli', 'ui', 'api', 'mcp'],
    requiresConfirmation,
    handler: async () => ({ ok: true }),
  }
  return {
    calls,
    get: () => cap,
    getBySlug: () => cap,
    execute: async (id: string, input: Record<string, unknown>, ctx: unknown) => {
      calls.push({ id, input, ctx })
      return { executed: true, id, echo: input }
    },
  }
}

function makeKernel() {
  return new ExecutionKernel({
    policy: new P0PolicyEngine({
      allowDestructive: false,
      allowFinancial: false,
      allowCommunication: false,
      allowSecuritySensitive: false,
      maxRiskTier: 3,
    }),
    journal: new MemoryJournal(),
  })
}

function buildIntent(
  classification: ActionClassification,
  capabilityId: string,
  input: Record<string, unknown>,
  extra: Partial<ParsedIntent> = {},
): ParsedIntent {
  return {
    patternId: 'p1',
    intent: 'demo',
    input,
    confidence: 1,
    rawInput: 'x',
    matchedPattern: 'demo',
    alternatives: [],
    resolvedAt: Date.now(),
    capabilityId,
    classification,
    ...extra,
  }
}

const ctx = { surface: 'cli', conversationId: 'c1', metadata: {} } as NLCContext

describe('ExecutionKernel ↔ NLCL wiring (Alpha Gates A/B/C)', () => {
  // Gate A — P0PolicyEngine blocks destructive (default-deny) and the capability never executes.
  test('blocks destructive capability by default (policy tier-blocking)', async () => {
    const reg = makeRegistry(false)
    const router = new IntentRouter(reg as unknown as UnifiedCapabilityRegistry)
    router.setKernel(makeKernel())

    const res = await router.route(buildIntent('destructive', 'cap:test:demo', { foo: 'bar' }), ctx)

    expect(res.ok).toBe(false)
    expect(reg.calls.length).toBe(0)
  })

  // F2 fix — the runner receives node.input (the real input), not the ActionNode,
  // and the capability executes through the kernel for a safe (read) intent.
  test('executes read capability via kernel with correct runner input (plan-shape fix)', async () => {
    const reg = makeRegistry(false)
    const router = new IntentRouter(reg as unknown as UnifiedCapabilityRegistry)
    router.setKernel(makeKernel())

    const res = await router.route(buildIntent('read', 'cap:test:demo', { foo: 'bar' }), ctx)

    expect(res.ok).toBe(true)
    expect(reg.calls.length).toBe(1)
    const call = reg.calls[0]!
    expect(call.id).toBe('cap:test:demo')
    // The input passed to the registry must be the cleaned intent input...
    expect(call.input).toEqual({ foo: 'bar' })
    // ...and must NOT be the ActionNode (which would carry a `capability` field).
    expect((call.input as Record<string, unknown>).capability).toBeUndefined()
  })

  // Gate B — confirmation-required capability without a token is blocked at the kernel gate.
  test('blocks confirmation-required capability without token', async () => {
    const reg = makeRegistry(true)
    const router = new IntentRouter(reg as unknown as UnifiedCapabilityRegistry)
    router.setKernel(makeKernel())

    const res = await router.route(buildIntent('write', 'cap:test:demo', { foo: 'bar' }), ctx)

    expect(res.ok).toBe(false)
    expect(res.error).toContain('Confirmation required')
    expect(reg.calls.length).toBe(0)
  })

  // Engine-authorization — an already-confirmed resume (confirmationSatisfied) bypasses the
  // kernel's own confirmation gate, preserving the NLCL confirmation authority upstream.
  test('engine-authorized (already-confirmed) resume executes despite requiresConfirmation', async () => {
    const reg = makeRegistry(true)
    const router = new IntentRouter(reg as unknown as UnifiedCapabilityRegistry)
    router.setKernel(makeKernel())

    const res = await router.route(
      buildIntent('write', 'cap:test:demo', { foo: 'bar' }, { confirmationSatisfied: true }),
      ctx,
    )

    expect(res.ok).toBe(true)
    expect(reg.calls.length).toBe(1)
  })
})
