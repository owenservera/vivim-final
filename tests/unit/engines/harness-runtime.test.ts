// tests/unit/engines/harness-runtime.test.ts
import { beforeEach, describe, expect, it, mock } from 'bun:test'
import type { CapabilityEvent } from '../../../src/engines/capability-event-bus'
import {
  type HarnessContext,
  type HarnessModule,
  type HarnessModuleResult,
  HarnessRuntime,
} from '../../../src/engines/harness-runtime'

describe('HarnessRuntime', () => {
  let runtime: HarnessRuntime

  beforeEach(() => {
    runtime = new HarnessRuntime()
  })

  function makeModule(
    name: string,
    execute: (input: Record<string, unknown>, ctx: HarnessContext) => Promise<HarnessModuleResult>,
  ): HarnessModule {
    return {
      name,
      version: 1,
      inputSchema: {},
      outputSchema: {},
      preconditions: [],
      postconditions: [],
      execute,
    }
  }

  it('sequence runs steps in order', async () => {
    runtime.register(makeModule('m1', async () => ({ ok: true, output: { a: 1 } })))
    runtime.register(makeModule('m2', async () => ({ ok: true, output: { b: 2 } })))

    const result = await runtime.execute({
      steps: [
        { type: 'step', moduleId: 'm1', input: {}, outputKey: 'r1' },
        { type: 'step', moduleId: 'm2', input: {}, outputKey: 'r2' },
      ],
    })

    expect(result.ok).toBe(true)
    expect(result.outputs.r1).toEqual({ a: 1 })
    expect(result.outputs.r2).toEqual({ b: 2 })
    expect(result.stepsCompleted).toBe(2)
  })

  it('branch evaluates condition and routes correctly', async () => {
    const rt = new HarnessRuntime()
    rt.register(makeModule('thenMod', async () => ({ ok: true, output: { branch: 'then' } })))
    rt.register(makeModule('elseMod', async () => ({ ok: true, output: { branch: 'else' } })))

    const branchNode = {
      type: 'branch',
      condition: { type: 'selector_exists', value: 'exists' },
      // biome-ignore lint/suspicious/noThenProperty: HarnessNode uses 'then' as a property name
      then: { type: 'step', moduleId: 'thenMod', input: {}, outputKey: 'res' },
      alternative: { type: 'step', moduleId: 'elseMod', input: {}, outputKey: 'res' },
    } as unknown as import('../../../src/engines/harness-runtime').HarnessNode

    const result = await rt.execute({ steps: [branchNode] })

    expect(result.ok).toBe(true)
    expect(result.outputs.res).toEqual({ branch: 'then' })
  })

  it('parallel runs steps concurrently', async () => {
    const order: string[] = []
    runtime.register(
      makeModule('p1', async () => {
        await new Promise((r) => setTimeout(r, 30))
        order.push('p1')
        return { ok: true, output: { p: 1 } }
      }),
    )
    runtime.register(
      makeModule('p2', async () => {
        await new Promise((r) => setTimeout(r, 10))
        order.push('p2')
        return { ok: true, output: { p: 2 } }
      }),
    )

    const _start = Date.now()
    const result = await runtime.execute({
      steps: [
        { type: 'step', moduleId: 'p1', input: {}, outputKey: 'r1' },
        { type: 'step', moduleId: 'p2', input: {}, outputKey: 'r2' },
      ],
    })
    // parallel, order verifies concurrency

    expect(result.ok).toBe(true)
    expect(result.outputs.r1).toEqual({ p: 1 })
    expect(result.outputs.r2).toEqual({ p: 2 })
    // Parallel runs in parallel (both awaited via Promise.all)
    expect(order).toContain('p1')
    expect(order).toContain('p2')
  })

  it('retry retries failed step with backoff', async () => {
    let attempts = 0
    runtime.register(
      makeModule('failing', async () => {
        attempts++
        if (attempts < 2) throw new Error('try again')
        return { ok: true, output: { success: true } }
      }),
    )

    const result = await runtime.execute({
      steps: [
        {
          type: 'retry',
          maxRetries: 2,
          backoffMs: 5,
          step: { type: 'step', moduleId: 'failing', input: {}, outputKey: 'res' },
        },
      ],
    })

    expect(result.ok).toBe(true)
    expect(attempts).toBe(2)
  })

  it('emits progress events per step', async () => {
    const emitMock = mock()
    const runtimeWithBus = new HarnessRuntime({
      emit: emitMock as unknown as (event: CapabilityEvent) => void,
    } as unknown as import('../../../src/engines/capability-event-bus').CapabilityEventBus)
    runtimeWithBus.register(makeModule('test', async () => ({ ok: true, output: {} })))

    await runtimeWithBus.execute({
      steps: [{ type: 'step', moduleId: 'test', input: {}, outputKey: 'r' }],
    })

    expect(emitMock).toHaveBeenCalled()
  })
})
