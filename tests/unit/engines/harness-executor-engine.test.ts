// tests/unit/engines/harness-executor-engine.test.ts
// HarnessExecutorEngine — program resolution → recipe compilation → circuit gate → execution → outcome recording.
import { beforeEach, describe, expect, it, mock } from 'bun:test'
import type {
  HarnessExecutionRequest,
  HarnessExecutorDeps,
  HarnessSink,
} from '../../../src/engines/harness/harness-contract.js'
import { HarnessExecutorEngine } from '../../../src/engines/harness/harness-executor-engine.js'
import type { CapabilityProgramRow } from '../../../src/storage/contracts/capability-store.js'
import type { ProgramStore } from '../../../src/storage/contracts/program-store.js'

function makeProgram(overrides?: Partial<CapabilityProgramRow>): CapabilityProgramRow {
  return {
    id: 'prog-1',
    bindingId: 'bind-1',
    capabilityId: 'cap:send_message',
    configJson: JSON.stringify({
      schemaVersion: 1,
      recipe: {
        steps: [{ kind: 'type_text', text: 'hello' }, { kind: 'submit' }],
        timeoutMs: 5000,
      },
    }),
    status: 'promoted',
    score: 0.9,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  }
}

function makeDeps(overrides?: Partial<HarnessExecutorDeps>): HarnessExecutorDeps {
  return {
    governor: {
      runHarnessPlan: mock(() =>
        Promise.resolve({ success: true, stepsCompleted: 2, capturedBody: 'response text' }),
      ),
      getHealth: mock(() => Promise.resolve({ circuitState: 'closed' })),
    } as never,
    programStore: {
      getProgramById: mock(() => Promise.resolve(makeProgram())),
      getBestProgramByCapability: mock(() => Promise.resolve(makeProgram())),
    } as unknown as ProgramStore,
    store: {
      createOutcome: mock(() => Promise.resolve({ id: 'out-1' })),
    } as never,
    blockStore: {
      storeBlocks: mock(() => Promise.resolve()),
    } as never,
    eventBus: {
      emit: mock(() => {}),
    } as never,
    slaveResolver: {
      resolve: mock(() => Promise.resolve('slave-1')),
    },
    parser: {
      parse: mock(() =>
        Promise.resolve({
          blocks: [{ type: 'text', text: 'response text' }],
          parserName: 'test-parser',
          confidence: 0.95,
          wireFormat: 'text',
        }),
      ),
    } as never,
    defaultTimeoutMs: 10_000,
    ...overrides,
  }
}

function makeReq(overrides?: Partial<HarnessExecutionRequest>): HarnessExecutionRequest {
  return {
    capabilitySlug: 'send_message',
    providerId: 'chatgpt',
    accountId: 'acc-1',
    input: { text: 'hello' },
    ...overrides,
  }
}

describe('HarnessExecutorEngine', () => {
  let deps: HarnessExecutorDeps
  let engine: HarnessExecutorEngine

  beforeEach(() => {
    deps = makeDeps()
    engine = new HarnessExecutorEngine(deps)
  })

  it('resolves best program by capability+provider when no programId given', async () => {
    const result = await engine.execute(makeReq())
    expect(result.ok).toBe(true)
    expect(deps.programStore.getBestProgramByCapability).toHaveBeenCalledWith(
      'send_message',
      'chatgpt',
    )
    expect(deps.programStore.getProgramById).not.toHaveBeenCalled()
  })

  it('resolves specific program by programId when provided', async () => {
    const result = await engine.execute(makeReq({ programId: 'prog-42' }))
    expect(result.ok).toBe(true)
    expect(deps.programStore.getProgramById).toHaveBeenCalledWith('prog-42')
  })

  it('returns error when no program found', async () => {
    deps.programStore.getBestProgramByCapability = mock(() => Promise.resolve(null)) as never
    const result = await engine.execute(makeReq())
    expect(result.ok).toBe(false)
    expect(result.error).toContain('No program')
  })

  it('returns error when no live slave found', async () => {
    deps.slaveResolver.resolve = mock(() => Promise.resolve(null))
    const result = await engine.execute(makeReq())
    expect(result.ok).toBe(false)
    expect(result.error).toContain('No live slave')
  })

  it('returns error when circuit is open', async () => {
    deps.governor.getHealth = mock(() => Promise.resolve({ circuitState: 'open' })) as never
    const result = await engine.execute(makeReq())
    expect(result.ok).toBe(false)
    expect(result.error).toContain('Circuit open')
  })

  it('records outcome on success', async () => {
    await engine.execute(makeReq())
    expect(deps.store.createOutcome).toHaveBeenCalledWith(
      expect.objectContaining({
        capabilityId: 'cap:send_message',
        providerId: 'chatgpt',
        ok: true,
      }),
    )
  })

  it('returns error without recording outcome when program not found', async () => {
    deps.programStore.getBestProgramByCapability = mock(() => Promise.resolve(null)) as never
    const result = await engine.execute(makeReq())
    expect(result.ok).toBe(false)
    expect(result.error).toContain('No program')
    // recordOutcome is NOT called when program is null (short-circuits)
    expect(deps.store.createOutcome).not.toHaveBeenCalled()
  })

  it('emits error via sink when program not found', async () => {
    deps.programStore.getBestProgramByCapability = mock(() => Promise.resolve(null)) as never
    const errors: unknown[] = []
    const customSink: HarnessSink = {
      onBlock: mock(() => {}),
      onDone: mock(() => {}),
      onError: (e) => errors.push(e),
    }
    engine = new HarnessExecutorEngine(deps, customSink)
    await engine.execute(makeReq())
    expect(errors).toHaveLength(1)
    expect(String(errors[0])).toContain('No program')
  })

  it('parses captured body through provider-specific parser', async () => {
    await engine.execute(makeReq())
    expect(deps.parser.parse).toHaveBeenCalledWith('response text', 'chatgpt')
  })

  it('emits stream blocks for parsed content', async () => {
    const blocks: unknown[] = []
    const customSink: HarnessSink = {
      onBlock: (b) => blocks.push(b),
      onDone: mock(() => {}),
      onError: mock(() => {}),
    }
    engine = new HarnessExecutorEngine(deps, customSink)
    await engine.execute(makeReq())
    expect(blocks).toHaveLength(1)
    expect((blocks[0] as { blockKind: string }).blockKind).toBe('text')
  })
})
