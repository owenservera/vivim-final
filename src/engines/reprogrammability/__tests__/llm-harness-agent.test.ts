// src/engines/reprogrammability/__tests__/llm-harness-agent.test.ts
// Phase 7 of ROADMAP-REPROGRAMMABLE-CANVAS.md — LLM Harness Escalation.

import { describe, test, expect, beforeEach } from 'bun:test'
import { ulid } from 'ulid'
import {
  LlmHarnessAgent,
  type LlmHarnessAgentDeps,
} from '../llm-harness-agent.js'
import type { ProviderLLMAdapter } from '../../nlcl/llm-slave-resolver.js'
import { surfaceRegistry } from '../../../reprogrammability/registry.js'
import { resetCanonicalSurfacesForTest } from '../../../reprogrammability/canonical-surfaces.js'
import type { SurfaceMutationPlan } from '../../../reprogrammability/mutation-schema.js'

class FakeLLM implements ProviderLLMAdapter {
  constructor(private responses: string[]) {}
  private i = 0
  async query(prompt: string): Promise<string> {
    if (this.i >= this.responses.length) {
      throw new Error('FakeLLM: out of responses')
    }
    return this.responses[this.i++]!
  }
}

describe('LlmHarnessAgent', () => {
  beforeEach(() => {
    surfaceRegistry.clear()
    resetCanonicalSurfacesForTest()
  })

  test('produces a valid plan from a well-formed LLM response', async () => {
    const plan: SurfaceMutationPlan = {
      id: `plan-${ulid()}`,
      mutations: [
        {
          op: 'restyle',
          target: 'panel:conversations',
          provenance: 'llm-harness',
          payload: { background: 'red' },
          reason: 'Highlight the conversations panel',
          idempotencyKey: `k-${ulid()}`,
        },
      ],
      provenance: 'llm-harness',
      description: 'Restyle the conversations panel',
    }
    const fakeLlm = new FakeLLM([JSON.stringify(plan)])
    const agent = new LlmHarnessAgent({ providerLLM: fakeLlm })

    const result = await agent.producePlan('make the conversations panel red')

    expect(result.ok).toBe(true)
    expect(result.plan).toBeDefined()
    expect(result.plan!.mutations).toHaveLength(1)
    expect(result.plan!.mutations[0]!.op).toBe('restyle')
    expect(result.plan!.mutations[0]!.target).toBe('panel:conversations')
    expect(result.plan!.mutations[0]!.provenance).toBe('llm-harness')
    expect(result.plan!.provenance).toBe('llm-harness')
    expect(result.retries).toBe(0)
  })

  test('retries when LLM output is invalid JSON', async () => {
    const validPlan: SurfaceMutationPlan = {
      id: `plan-${ulid()}`,
      mutations: [
        {
          op: 'set_property',
          target: 'panel:conversations',
          provenance: 'llm-harness',
          payload: { path: 'title', value: 'My Conversations' },
          reason: 'Rename',
          idempotencyKey: `k-${ulid()}`,
        },
      ],
      provenance: 'llm-harness',
      description: 'Rename',
    }
    const fakeLlm = new FakeLLM([
      'this is not JSON',
      JSON.stringify(validPlan),
    ])
    const agent = new LlmHarnessAgent({ providerLLM: fakeLlm })

    const result = await agent.producePlan('rename the conversations panel')

    expect(result.ok).toBe(true)
    expect(result.plan).toBeDefined()
    expect(result.retries).toBe(1)
  })

  test('retries when LLM output fails schema validation', async () => {
    const invalidPlan = {
      id: 'p1',
      mutations: [
        {
          op: 'NOT_A_REAL_OP', // invalid op
          target: 'panel:conversations',
          provenance: 'llm-harness',
          payload: {},
        },
      ],
      provenance: 'llm-harness',
    }
    const validPlan: SurfaceMutationPlan = {
      id: `plan-${ulid()}`,
      mutations: [
        {
          op: 'set_property',
          target: 'panel:conversations',
          provenance: 'llm-harness',
          payload: { path: 'title', value: 'New' },
          idempotencyKey: `k-${ulid()}`,
        },
      ],
      provenance: 'llm-harness',
    }
    const fakeLlm = new FakeLLM([
      JSON.stringify(invalidPlan),
      JSON.stringify(validPlan),
    ])
    const agent = new LlmHarnessAgent({ providerLLM: fakeLlm })

    const result = await agent.producePlan('rename')

    expect(result.ok).toBe(true)
    expect(result.retries).toBe(1)
  })

  test('returns error after MAX_RETRIES exhausted', async () => {
    const fakeLlm = new FakeLLM([
      'invalid',
      'still invalid',
      'also invalid',
    ])
    const agent = new LlmHarnessAgent({ providerLLM: fakeLlm, maxRetries: 2 })

    const result = await agent.producePlan('anything')

    expect(result.ok).toBe(false)
    expect(result.error).toContain('JSON')
    expect(result.retries).toBe(2)
  })

  test('strips ```json code fences from LLM output', async () => {
    const plan: SurfaceMutationPlan = {
      id: `plan-${ulid()}`,
      mutations: [
        {
          op: 'restyle',
          target: 'panel:conversations',
          provenance: 'llm-harness',
          payload: { color: 'blue' },
          idempotencyKey: `k-${ulid()}`,
        },
      ],
      provenance: 'llm-harness',
    }
    const fenced = '```json\n' + JSON.stringify(plan) + '\n```'
    const fakeLlm = new FakeLLM([fenced])
    const agent = new LlmHarnessAgent({ providerLLM: fakeLlm })

    const result = await agent.producePlan('make it blue')

    expect(result.ok).toBe(true)
    expect(result.plan!.mutations[0]!.op).toBe('restyle')
  })

  test('forces provenance to llm-harness even if LLM lies', async () => {
    const lyingPlan = {
      id: 'p1',
      mutations: [
        {
          op: 'restyle',
          target: 'panel:conversations',
          provenance: 'manual', // LLM tries to lie about provenance
          payload: { color: 'green' },
          idempotencyKey: 'k1',
        },
      ],
      provenance: 'manual', // also at plan level
    }
    const fakeLlm = new FakeLLM([JSON.stringify(lyingPlan)])
    const agent = new LlmHarnessAgent({ providerLLM: fakeLlm })

    const result = await agent.producePlan('make it green')

    expect(result.ok).toBe(true)
    expect(result.plan!.provenance).toBe('llm-harness')
    expect(result.plan!.mutations[0]!.provenance).toBe('llm-harness')
  })

  test('synthesizes idempotencyKey if LLM omits it', async () => {
    const planMissingKey = {
      id: 'p1',
      mutations: [
        {
          op: 'restyle',
          target: 'panel:conversations',
          provenance: 'llm-harness',
          payload: { color: 'yellow' },
          // No idempotencyKey
        },
      ],
      provenance: 'llm-harness',
    }
    const fakeLlm = new FakeLLM([JSON.stringify(planMissingKey)])
    const agent = new LlmHarnessAgent({ providerLLM: fakeLlm })

    const result = await agent.producePlan('make it yellow')

    expect(result.ok).toBe(true)
    expect(result.plan!.mutations[0]!.idempotencyKey).toBeDefined()
    expect(result.plan!.mutations[0]!.idempotencyKey).toMatch(/^llm-/)
  })
})
