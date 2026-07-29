// tests/unit/engines/objective-engine.test.ts
// ObjectiveEngine — putObjective, advance, sleep, wake, pursue.
import { beforeEach, describe, expect, it, mock } from 'bun:test'
import { ObjectiveEngine } from '../../../src/engines/objective-engine.js'

function makeStore() {
  return {
    putObjective: mock(() => Promise.resolve({ id: 'obj-1' })),
    advanceAgenda: mock(() => Promise.resolve({ current: 'step-2', done: false })),
    sleepObjective: mock(() => Promise.resolve()),
    wakeObjective: mock(() => Promise.resolve()),
    nodes: {
      getNode: mock(() => Promise.resolve(null)),
      updateNode: mock(() => Promise.resolve()),
    },
  }
}

describe('ObjectiveEngine', () => {
  let store: ReturnType<typeof makeStore>
  let engine: ObjectiveEngine

  beforeEach(() => {
    store = makeStore()
    engine = new ObjectiveEngine(store as never)
  })

  it('putObjective delegates to store', async () => {
    const result = await engine.putObjective({
      title: 'Test Objective',
      ownerActor: { kind: 'agent', id: 'a1' },
    })
    expect(result.id).toBe('obj-1')
    expect(store.putObjective).toHaveBeenCalled()
  })

  it('advance delegates to store.advanceAgenda', async () => {
    const result = await engine.advance('obj-1')
    expect(result.current).toBe('step-2')
    expect(result.done).toBe(false)
  })

  it('sleep delegates to store.sleepObjective', async () => {
    await engine.sleep('obj-1', Date.now() + 60000)
    expect(store.sleepObjective).toHaveBeenCalled()
  })

  it('wake delegates to store.wakeObjective', async () => {
    await engine.wake('obj-1')
    expect(store.wakeObjective).toHaveBeenCalled()
  })

  it('pursue creates agent->objective edge when agent exists', async () => {
    store.nodes.getNode.mockResolvedValue({
      edgesJson: '[]',
      dataJson: '{}',
    } as never)
    await engine.pursue('agent-1', 'obj-1')
    expect(store.nodes.updateNode).toHaveBeenCalled()
    const call = store.nodes.updateNode.mock.calls[0] as any as [string, { edgesJson: string }]
    const edges = JSON.parse(call[1].edgesJson)
    expect(edges[0].type).toBe('pursues')
    expect(edges[0].targetId).toBe('obj-1')
  })

  it('pursue does nothing when agent not found', async () => {
    store.nodes.getNode.mockResolvedValue(null)
    await engine.pursue('missing', 'obj-1')
    expect(store.nodes.updateNode).not.toHaveBeenCalled()
  })
})
