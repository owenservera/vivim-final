// tests/unit/harness/harness-executor.test.ts
import { describe, expect, it, mock } from 'bun:test'
import { nextStatus } from '../../../src/engines/harness/binding-status-ladder.js'
import { canExecute } from '../../../src/engines/harness/circuit-breaker-adapter.js'
import { updateHealthScore } from '../../../src/engines/harness/confidence-promotion.js'
import type { HarnessExecutorDeps } from '../../../src/engines/harness/harness-contract.js'
import { HarnessExecutorEngine } from '../../../src/engines/harness/harness-executor-engine.js'
import { composeHarness } from '../../../src/engines/harness/index.js'
import { withTimeout } from '../../../src/engines/harness/timeout-guard.js'

function makeDeps(overrides: Partial<HarnessExecutorDeps> = {}): HarnessExecutorDeps {
  const programRow = {
    id: 'prog1',
    bindingId: 'b1',
    version: 1,
    status: 'candidate',
    configJson: JSON.stringify({
      schemaVersion: 1,
      recipe: {
        id: 'chatgpt:send',
        providerId: 'chatgpt',
        capabilitySlug: 'send-message',
        version: 1,
        steps: [{ kind: 'type_text', text: 'hi', composerType: 'textarea' }],
      },
    }),
    createdAt: 0,
    updatedAt: 0,
  }
  const programStore = {
    getProgramById: mock(async () => programRow),
    getBestProgramByCapability: mock(async () => programRow),
  } as unknown as HarnessExecutorDeps['programStore']
  const store = {
    createOutcome: mock(async () => ({}) as never),
  } as unknown as HarnessExecutorDeps['store']
  const governor = {
    runHarnessPlan: mock(async () => ({ success: true, stepsCompleted: 1, capturedBody: 'hello' })),
    getHealth: mock(async () => ({ circuitState: 'closed' })),
    probe: mock(async () => true),
  } as unknown as HarnessExecutorDeps['governor']
  const blockStore = {
    storeBlocks: mock(async () => {}),
  } as unknown as HarnessExecutorDeps['blockStore']
  const eventBus = { emit: mock(() => {}) } as unknown as HarnessExecutorDeps['eventBus']
  const slaveResolver = {
    resolve: mock(async () => 'slave1'),
  } as unknown as HarnessExecutorDeps['slaveResolver']
  const parser = {
    parse: mock(async () => ({
      blocks: [{ type: 'text', text: 'hello' }],
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
      rawSizeBytes: 5,
    })),
  } as unknown as HarnessExecutorDeps['parser']
  return {
    governor,
    programStore,
    store,
    blockStore,
    eventBus,
    slaveResolver,
    parser,
    ...overrides,
  }
}

describe('HarnessExecutorEngine', () => {
  it('resolves program, runs governor plan, records outcome', async () => {
    const deps = makeDeps()
    const exec = new HarnessExecutorEngine(deps)
    const result = await exec.execute({
      capabilitySlug: 'send-message',
      providerId: 'chatgpt',
      accountId: 'acc1',
      input: {},
    })
    expect(result.ok).toBe(true)
    expect(result.slaveId).toBe('slave1')
    expect(result.captured).toBe('hello')
    expect((deps.store.createOutcome as ReturnType<typeof mock>).mock.calls.length).toBeGreaterThan(
      0,
    )
  })

  it('fails when no slave can be resolved', async () => {
    const deps = makeDeps()
    deps.slaveResolver = { resolve: mock(async () => null) } as never
    const exec = new HarnessExecutorEngine(deps)
    const result = await exec.execute({
      capabilitySlug: 'send-message',
      providerId: 'chatgpt',
      accountId: 'a',
      input: {},
    })
    expect(result.ok).toBe(false)
    expect(result.error).toMatch(/No live slave/)
  })
})

describe('lifecycle + confidence', () => {
  it('ladder promotes on success and degrades on failure', () => {
    expect(nextStatus('candidate', true)).toBe('active')
    expect(nextStatus('active', false)).toBe('degraded')
    expect(nextStatus('degraded', false)).toBe('failed')
  })

  it('health score smooths toward target', () => {
    expect(updateHealthScore({ current: 1, ok: false })).toBeLessThan(1)
    expect(updateHealthScore({ current: 0, ok: true })).toBeGreaterThan(0)
  })

  it('timeout guard aborts long work', async () => {
    const r = await withTimeout(async (signal) => {
      await new Promise<void>((_res, rej) => {
        const t = setTimeout(() => _res(), 50)
        signal.addEventListener('abort', () => {
          clearTimeout(t)
          rej(new Error('AbortError'))
        })
      })
      return 'done'
    }, 10)
    expect(r.timedOut).toBe(true)
  })

  it('circuit gate blocks open circuits', async () => {
    const gov = { getHealth: mock(async () => ({ circuitState: 'open' })) } as never
    expect(await canExecute(gov, 's1')).toBe(false)
  })
})

describe('composeHarness wiring', () => {
  it('assembles an executor from deps', () => {
    const deps = makeDeps()
    const comp = composeHarness({
      governor: deps.governor,
      capabilityStore: deps.store,
      programStore: deps.programStore,
      blockStore: deps.blockStore,
      eventBus: deps.eventBus,
      parser: deps.parser,
    })
    expect(comp.executor).toBeInstanceOf(HarnessExecutorEngine)
    expect(comp.registrar).toBeDefined()
  })
})
