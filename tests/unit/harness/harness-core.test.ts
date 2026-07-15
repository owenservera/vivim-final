// tests/unit/harness/harness-core.test.ts
import { describe, expect, it } from 'bun:test'
import {
  PROGRAM_STATUS,
  configToProgram,
  recipeToConfig,
} from '../../../src/engines/harness/program-schema.js'
import { compileRecipe } from '../../../src/engines/harness/recipe-compiler.js'
import { assertRecipe } from '../../../src/engines/harness/recipe-types.js'
import { MemoryProgramStore } from '../../../src/storage/impl/program-store-mem.js'

const recipe = {
  id: 'chatgpt:send',
  providerId: 'chatgpt',
  capabilitySlug: 'send-message',
  version: 1,
  steps: [
    { kind: 'type_text', selector: 'textarea', text: 'hi', composerType: 'textarea' as const },
    { kind: 'submit', sendSelector: 'button' },
    { kind: 'capture', pattern: 'Response', timeoutMs: 5000 },
  ],
} as const

describe('recipe-compiler', () => {
  it('compiles steps into a DAG with sequential edges', () => {
    const dag = compileRecipe(recipe as never)
    expect(dag.nodes.length).toBe(3)
    expect(dag.edges.length).toBe(2)
    expect(dag.edges[0]).toEqual({ from: 0, to: 1 })
    expect(dag.nodes[2]?.action).toBe('capture')
  })

  it('compiles branches with a condition and depends on last linear step', () => {
    const dag = compileRecipe({
      ...recipe,
      branches: [
        { when: { outputKey: 's2', equals: 'ok' }, steps: [{ kind: 'navigate', url: '/x' }] },
      ],
    } as never)
    expect(dag.nodes.length).toBe(4)
    expect(dag.edges.some((e) => e.from === 2 && e.to === 3)).toBe(true)
    expect(dag.nodes[3]?.condition?.outputKey).toBe('s2')
  })
})

describe('program-schema round-trip', () => {
  it('serialises and parses a recipe', () => {
    assertRecipe(recipe)
    const cfg = recipeToConfig(recipe as never)
    const back = configToProgram(cfg)
    expect(back.recipe.id).toBe('chatgpt:send')
    expect(back.schemaVersion).toBe(1)
  })
})

describe('MemoryProgramStore', () => {
  it('upserts, links best, and resolves by capability', async () => {
    const store = new MemoryProgramStore()
    const p = await store.upsertProgram({
      bindingId: 'b1',
      version: 1,
      status: PROGRAM_STATUS.CANDIDATE,
      recipe: recipe as never,
    })
    await store.setBestProgram('b1', p.id)
    const best = await store.getBestProgram('b1')
    expect(best?.id).toBe(p.id)
    const byCap = await store.getBestProgramByCapability('send-message', 'chatgpt')
    expect(byCap?.id).toBe(p.id)
  })
})
