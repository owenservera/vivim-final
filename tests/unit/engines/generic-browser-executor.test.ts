import { beforeEach, describe, expect, mock, test } from 'bun:test'
import { GenericBrowserExecutor } from '../../../src/engines/nlcl/executors/generic-browser-executor.js'
import type { ParsedIntent } from '../../../src/engines/nlcl/types.js'

function makeOrchestrator() {
  return {
    run: mock(() =>
      Promise.resolve({
        role: 'researcher',
        recipeId: 'auto:research:report',
        steps: 3,
        observations: [],
        output: { kind: 'report' },
        trustLevel: 'read',
        humanGated: false,
      }),
    ),
  } as any
}

function makeIntent(over: Partial<ParsedIntent> = {}): ParsedIntent {
  return {
    patternId: 'auto.research',
    intent: 'auto.research',
    input: { role: 'researcher', queryUrl: 'https://example.com' },
    confidence: 1,
    rawInput: 'research the crisis',
    matchedPattern: 'auto.research',
    alternatives: [],
    resolvedAt: Date.now(),
    classification: 'read',
    ...over,
  }
}

describe('GenericBrowserExecutor', () => {
  let orch: ReturnType<typeof makeOrchestrator>
  let exec: GenericBrowserExecutor

  beforeEach(() => {
    orch = makeOrchestrator()
    exec = new GenericBrowserExecutor(undefined, orch)
  })

  test('id is generic-browser', () => {
    expect(exec.id).toBe('generic-browser')
  })

  test('execute routes research intent to orchestrator', async () => {
    const res = await exec.execute(makeIntent(), { surface: 'cli' } as any)
    expect(res.ok).toBe(true)
    expect(orch.run).toHaveBeenCalled()
    expect(res.text).toContain('researcher')
  })

  test('infers role from intent when params omit role', async () => {
    await exec.execute(makeIntent({ input: { url: 'https://x.com' }, intent: 'auto.test' }), {
      surface: 'cli',
    } as any)
    expect(orch.run.mock.calls[0][0].role).toBe('tester')
  })

  test('fails gracefully when orchestrator missing', async () => {
    const bare = new GenericBrowserExecutor(undefined, undefined)
    const res = await bare.execute(makeIntent(), { surface: 'cli' } as any)
    expect(res.ok).toBe(false)
  })
})
