// tests/unit/engines/intent-decomposer-clarify.test.ts
// Unit 2.3 — IntentDecomposer clarification flow.

import { describe, expect, it } from 'bun:test'
import type { CapabilityEventBus } from '../../../src/engines/capability-event-bus.js'
import { IntentDecomposer } from '../../../src/engines/intent-decomposer.js'
import type {
  DecomposeContext,
  IntentDecomposerStore,
} from '../../../src/engines/intent-decomposer.js'
import { EngineError } from '../../../src/errors.js'

class MockStore implements IntentDecomposerStore {
  async listTemplates() {
    return []
  }
  async getTemplate() {
    return null
  }
}

class MockRegistry {
  list() {
    return [
      { slug: 'navigate', description: 'Go to a URL' },
      { slug: 'extract', description: 'Extract content' },
      { slug: 'search', description: 'Search the web' },
    ]
  }
  getBySlug(_slug: string) {
    return { slug: 'navigate', description: 'Go to a URL' }
  }
}

class MockBus implements CapabilityEventBus {
  events: Array<{ type: string; clarification?: unknown }> = []
  emit(payload: Parameters<CapabilityEventBus['emit']>[0]): void {
    this.events.push({ type: payload.type, clarification: (payload as any).clarification })
  }
  subscribe() {
    return () => {}
  }
}

const ctx: DecomposeContext = {
  availableCapabilities: ['navigate', 'extract', 'search'],
}

describe('IntentDecomposer — clarify flow', () => {
  it('emits intent:clarify with ≥2 options when confidence < threshold', async () => {
    const bus = new MockBus()
    const decomposer = new IntentDecomposer(
      new MockStore(),
      new MockRegistry() as never,
      undefined,
      bus as never,
      0.5,
    )
    const result = await decomposer.clarify('confusing input', ctx, 0.3)
    expect(bus.events).toHaveLength(1)
    expect(bus.events[0].type).toBe('intent:clarify')
    expect(result.options.length).toBeGreaterThanOrEqual(1)
    expect(result.question).toBeTruthy()
  })

  it('throws when confidence >= threshold', async () => {
    const decomposer = new IntentDecomposer(
      new MockStore(),
      new MockRegistry() as never,
      undefined,
      undefined,
      0.5,
    )
    await expect(decomposer.clarify('input', ctx, 0.6)).rejects.toThrow(EngineError)
  })

  it('every option capabilitySlug resolves via registry', async () => {
    const bus = new MockBus()
    const decomposer = new IntentDecomposer(
      new MockStore(),
      new MockRegistry() as never,
      undefined,
      bus as never,
      0.5,
    )
    const result = await decomposer.clarify('input', ctx, 0.2)
    for (const opt of result.options) {
      expect(ctx.availableCapabilities).toContain(opt.capabilitySlug)
    }
  })
})
