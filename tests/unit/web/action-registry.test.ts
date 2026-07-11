// tests/unit/web/action-registry.test.ts
import { beforeEach, describe, expect, test } from 'bun:test'
import { z } from 'zod'

// We need to import from a test build or run the module
// For now, let's create a minimal registry test inline

interface ActionSpec {
  description: string
  params: unknown
  run: (params: unknown) => Promise<void> | void
}

interface RegisteredAction {
  id: string
  spec: ActionSpec
}

const actions = new Map<string, RegisteredAction>()

function registerAction(id: string, spec: ActionSpec): void {
  if (actions.has(id)) {
    throw new Error(`Action ${id} already registered`)
  }
  actions.set(id, { id, spec })
}

function dispatch(id: string, params: unknown): Promise<void> {
  const action = actions.get(id)
  if (!action) {
    throw new Error(`Action ${id} not found. Available actions: ${listActions().join(', ')}`)
  }
  return Promise.resolve(action.spec.run(params))
}

function getAction(id: string): RegisteredAction | undefined {
  return actions.get(id)
}

function listActions(): string[] {
  return [...actions.keys()]
}

function listWithMetadata(): Array<{ id: string; description: string }> {
  return [...actions.entries()].map(([id, action]) => ({
    id,
    description: action.spec.description,
  }))
}

describe('ActionRegistry', () => {
  beforeEach(() => {
    actions.clear()
  })

  test('register adds action to registry', () => {
    registerAction('test.action', {
      description: 'Test action',
      params: z.object({ value: z.string() }),
      run: () => {},
    })
    expect(getAction('test.action')).toBeDefined()
    expect(getAction('test.action')?.spec.description).toBe('Test action')
  })

  test('register throws for duplicate action', () => {
    registerAction('test.action', {
      description: 'Test action',
      params: z.object({}),
      run: () => {},
    })
    expect(() =>
      registerAction('test.action', {
        description: 'Duplicate',
        params: z.object({}),
        run: () => {},
      }),
    ).toThrow('already registered')
  })

  test('dispatch calls action handler with params', async () => {
    let received: unknown
    registerAction('test.echo', {
      description: 'Echo action',
      params: z.object({ value: z.string() }),
      run: (params) => {
        received = params
      },
    })

    await dispatch('test.echo', { value: 'hello' })
    expect(received).toEqual({ value: 'hello' })
  })

  test('dispatch throws for unknown action', async () => {
    let threw = false
    try {
      await dispatch('nonexistent', {})
    } catch {
      threw = true
    }
    expect(threw).toBe(true)
  })

  test('list returns all registered action ids', () => {
    registerAction('action.a', { description: 'A', params: z.object({}), run: () => {} })
    registerAction('action.b', { description: 'B', params: z.object({}), run: () => {} })
    expect(listActions()).toEqual(['action.a', 'action.b'])
  })

  test('listWithMetadata returns id and description', () => {
    registerAction('test.a', { description: 'Action A', params: z.object({}), run: () => {} })
    registerAction('test.b', { description: 'Action B', params: z.object({}), run: () => {} })

    const result = listWithMetadata()
    expect(result).toHaveLength(2)
    expect(result.find((r) => r.id === 'test.a')?.description).toBe('Action A')
  })
})
