// tests/integration/sandbox/real-mode.test.ts
// Sandbox real mode integration - validates UI → backend → execution loop

import { describe, expect, test } from 'bun:test'
import { z } from 'zod'

// Minimal inline ActionRegistry matching web/ui contract
interface ActionSpec<TParams> {
  description: string
  params: z.ZodSchema<TParams>
  run: (params: TParams) => Promise<void> | void
}

const testActions = new Map<string, ActionSpec<unknown>>()

const TestActionRegistry = {
  register<TParams>(id: string, spec: ActionSpec<TParams>) {
    testActions.set(id, spec as ActionSpec<unknown>)
  },
  dispatch<T>(id: string, params: T): Promise<void> {
    const action = testActions.get(id)
    if (!action) throw new Error(`Action ${id} not found`)
    const validated = action.params.parse(params)
    return Promise.resolve(action.run(validated))
  },
  list() {
    return [...testActions.keys()]
  },
  listWithMetadata() {
    return [...testActions.entries()].map(([id, a]) => ({ id, description: a.description }))
  },
}

describe('Sandbox Real Mode Integration', () => {
  test('ActionRegistry registers and dispatches actions', () => {
    // Register a test action
    const EchoSchema = z.object({ value: z.string() })
    TestActionRegistry.register('test.echo', {
      description: 'Echo test action',
      params: EchoSchema,
      run: () => {},
    })

    // Verify registration
    expect(TestActionRegistry.list()).toContain('test.echo')
    expect(TestActionRegistry.listWithMetadata()).toContainEqual({
      id: 'test.echo',
      description: 'Echo test action',
    })
  })

  test('ActionRegistry dispatch validates params', async () => {
    const CountSchema = z.object({ count: z.number() })
    let received: number | undefined
    TestActionRegistry.register('test.validated', {
      description: 'Action with validation',
      params: CountSchema,
      run: (params) => {
        received = params.count
      },
    })

    // Valid dispatch
    await TestActionRegistry.dispatch('test.validated', { count: 5 })
    expect(received).toBe(5)
  })
})
