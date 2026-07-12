import { beforeEach, describe, expect, mock, test } from 'bun:test'
import { AgenticLoopEngine, type PlanningStrategy } from '../../../src/engines/agentic-loop.js'

function makeMirror() {
  return {
    projectState: mock(() => Promise.resolve({ url: 'https://x.com', text: 'hello' })),
    sendAction: mock(() => Promise.resolve({ ok: true })),
  } as any
}

function makeObservation() {
  return {
    start: mock(() => Promise.resolve()),
    stop: mock(() => Promise.resolve()),
    isActive: mock(() => true),
    onEvent: mock(() => () => {}),
  } as any
}

describe('AgenticLoopEngine', () => {
  let mirror: ReturnType<typeof makeMirror>
  let observation: ReturnType<typeof makeObservation>
  let engine: AgenticLoopEngine

  beforeEach(() => {
    mirror = makeMirror()
    observation = makeObservation()
    engine = new AgenticLoopEngine(mirror, observation)
  })

  test('executeAgenticLoop runs and returns result', async () => {
    const result = await engine.executeAgenticLoop('s1', {
      description: 'click button',
      maxIterations: 1,
    })
    expect(result.success).toBe(true)
    expect(result.iterations).toBeGreaterThanOrEqual(0)
    expect(result.episodes).toBeInstanceOf(Array)
  })

  test('executeAgenticLoop stops observation in finally', async () => {
    await engine.executeAgenticLoop('s1', { description: 'do nothing', maxIterations: 1 })
    expect(observation.stop).toHaveBeenCalledWith('s1')
  })

  test('executeAgenticLoop with custom planning strategy', async () => {
    const strategy: PlanningStrategy = {
      name: 'simple',
      priority: 1,
      plan: mock(() => Promise.resolve(['step1', 'step2'])),
    }
    const eng = new AgenticLoopEngine(mirror, observation, [strategy])
    const result = await eng.executeAgenticLoop('s1', {
      description: 'plan test',
      maxIterations: 1,
    })
    expect(result.actions.length).toBeGreaterThanOrEqual(1)
  })

  test('executeAgenticLoop stops observation on error', async () => {
    mirror.projectState.mockRejectedValueOnce(new Error('boom'))
    const result = await engine.executeAgenticLoop('s1', { description: 'fail', maxIterations: 1 })
    expect(result.success).toBe(false)
    expect(observation.stop).toHaveBeenCalled()
  })
})
