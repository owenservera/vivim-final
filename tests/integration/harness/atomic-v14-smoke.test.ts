// tests/integration/harness/atomic-v14-smoke.test.ts
// Unit 25.4 - v14 end-to-end verification.
// Seeds a recipe as a program, publishes it as a UnifiedCapability (One Entry
// Point), then drives it through registry.execute -> handler -> executor ->
// governor plan -> captured blocks. Uses the real MemoryProgramStore and the
// real UnifiedCapabilityRegistry; only the governor/fleet + telemetry sinks are
// stubbed (Governor Canon: the harness never touches CDP directly).

import { describe, expect, it, mock } from 'bun:test'
import { composeHarness, seedAndPublish } from '../../../src/engines/harness/index.js'
import { UnifiedCapabilityRegistry } from '../../../src/engines/unified-registry.js'
import type { Recipe } from '../../../src/storage/contracts/program-store.js'
import { MemoryProgramStore } from '../../../src/storage/impl/program-store-mem.js'

function makeGovernor() {
  return {
    ensureRunningForAccount: mock(async () => ({ slaveId: 'slave-1', circuitState: 'closed' })),
    recoverAuth: mock(async () => ({ slaveId: 'slave-1' })),
    getHealth: mock(async () => ({ circuitState: 'closed' })),
    probe: mock(async () => true),
    runHarnessPlan: mock(async () => ({
      success: true,
      stepsCompleted: 1,
      capturedBody: 'hello from harness',
    })),
  }
}

function makeParser() {
  return {
    parse: mock(async () => ({
      blocks: [{ type: 'text' as const, text: 'hello from harness' }],
      confidence: 1,
      parserName: 'mock-parser',
      parserVersion: 1,
      durationMs: 0,
      blockDiagnostics: {
        textBlocks: 1,
        toolCallBlocks: 0,
        fileBlocks: 0,
        errorBlocks: 0,
        reasoningBlocks: 0,
        codeBlocks: 0,
        sourceBlocks: 0,
      },
      wireFormat: 'plain-text' as const,
      fallbackDepth: 0,
      rawSizeBytes: 18,
    })),
  }
}

const recipe: Recipe = {
  id: 'chatgpt:send-message',
  providerId: 'chatgpt',
  capabilitySlug: 'send-message',
  version: 1,
  steps: [{ kind: 'type_text', text: 'hi', composerType: 'textarea' }],
}

describe('atomic-v14 end-to-end smoke', () => {
  it('seeds a program, publishes it, and executes it through the One Entry Point', async () => {
    const programStore = new MemoryProgramStore()
    const registry = new UnifiedCapabilityRegistry()
    const governor = makeGovernor()
    const createOutcome = mock(async () => ({}) as never)
    const storeBlocks = mock(async () => {})
    const emit = mock(() => {})

    const composition = composeHarness({
      governor: governor as never,
      programStore,
      capabilityStore: { createOutcome } as never,
      blockStore: { storeBlocks } as never,
      eventBus: { emit } as never,
      parser: makeParser() as never,
      registry,
    })

    const published = await seedAndPublish(composition, [recipe], registry)
    expect(published).toHaveLength(1)
    const first = published[0]
    if (!first) throw new Error('expected one published capability')
    const { capabilityId, programId } = first
    expect(capabilityId).toBe('cap:prog:send-message:chatgpt')
    expect(programId).toBeTruthy()

    // The published capability is reachable across surfaces (One Entry Point).
    const cap = registry.get(capabilityId)
    if (!cap) throw new Error('expected registered capability')
    expect(cap.surfaces).toContain('cli')
    expect(cap.surfaces).toContain('ui')
    expect(cap.surfaces).toContain('api')

    // Execute through the registry — this must resolve the seeded program and
    // run the governor plan (not the synthetic prog-* slug).
    const result = (await registry.execute(
      capabilityId,
      { accountId: 'acc-1' },
      { providerId: 'chatgpt', metadata: {} },
    )) as { ok: boolean; captured?: unknown; slaveId?: string }

    expect(result.ok).toBe(true)
    expect(result.captured).toBe('hello from harness')
    expect(result.slaveId).toBe('slave-1')

    // Governor plan ran; outcome + captured block were recorded.
    expect((governor.runHarnessPlan as ReturnType<typeof mock>).mock.calls.length).toBe(1)
    expect(createOutcome.mock.calls.length).toBe(1)
    expect(storeBlocks.mock.calls.length).toBeGreaterThan(0)
  })

  it('resolves by real capability slug when no programId is forwarded', async () => {
    const programStore = new MemoryProgramStore()
    const governor = makeGovernor()
    const composition = composeHarness({
      governor: governor as never,
      programStore,
      capabilityStore: { createOutcome: mock(async () => ({}) as never) } as never,
      blockStore: { storeBlocks: mock(async () => {}) } as never,
      eventBus: { emit: mock(() => {}) } as never,
      parser: makeParser() as never,
    })
    await composition.registrar.register(recipe)

    const result = await composition.executor.execute({
      capabilitySlug: 'send-message',
      providerId: 'chatgpt',
      accountId: 'acc-1',
      input: {},
    })
    expect(result.ok).toBe(true)
    expect(result.captured).toBe('hello from harness')
  })
})
