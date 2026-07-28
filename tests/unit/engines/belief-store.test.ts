// tests/unit/engines/belief-store.test.ts
// BeliefStore — putBelief, updateBelief, retract, getBeliefs, getLiveBeliefs.
import { beforeEach, describe, expect, it, mock } from 'bun:test'
import { BeliefStore } from '../../../src/engines/belief-store.js'

function makeStore() {
  return {
    putBelief: mock(() => Promise.resolve({ id: 'belief-1', version: 1 })),
    retractBelief: mock(() => Promise.resolve()),
    getBeliefs: mock(() => Promise.resolve([])),
    nodes: {
      getNode: mock(() => Promise.resolve(null)),
      updateNode: mock(() => Promise.resolve()),
      getNodeHistory: mock(() => Promise.resolve([{ version: 1 }, { version: 2 }])),
    },
  }
}

describe('BeliefStore', () => {
  let store: ReturnType<typeof makeStore>
  let beliefStore: BeliefStore

  beforeEach(() => {
    store = makeStore()
    beliefStore = new BeliefStore(store as never)
  })

  it('putBelief delegates to store and returns id/version', async () => {
    const result = await beliefStore.putBelief({
      ownerKind: 'agent',
      ownerId: 'agent-1',
      topic: 'weather',
      claim: 'It is sunny',
    })
    expect(result.id).toBe('belief-1')
    expect(result.version).toBe(1)
    expect(store.putBelief).toHaveBeenCalled()
  })

  it('putBelief creates owner->belief edge when owner exists', async () => {
    store.nodes.getNode.mockResolvedValue({
      edgesJson: '[]',
      dataJson: '{}',
    } as never)
    await beliefStore.putBelief({
      ownerKind: 'agent',
      ownerId: 'agent-1',
      topic: 't',
      claim: 'c',
    })
    expect(store.nodes.updateNode).toHaveBeenCalled()
  })

  it('putBelief skips edge when owner not found', async () => {
    store.nodes.getNode.mockResolvedValue(null)
    await beliefStore.putBelief({
      ownerKind: 'agent',
      ownerId: 'missing',
      topic: 't',
      claim: 'c',
    })
    expect(store.nodes.updateNode).not.toHaveBeenCalled()
  })

  it('updateBelief patches claim and confidence', async () => {
    store.nodes.getNode.mockResolvedValue({
      dataJson: JSON.stringify({ claim: 'old', confidence: 0.5 }),
    } as never)
    const version = await beliefStore.updateBelief('belief-1', {
      claim: 'new claim',
      confidence: 0.9,
    })
    expect(version).toBe(2)
    expect(store.nodes.updateNode).toHaveBeenCalled()
  })

  it('updateBelief returns 0 when belief not found', async () => {
    store.nodes.getNode.mockResolvedValue(null)
    const version = await beliefStore.updateBelief('missing', { claim: 'x' })
    expect(version).toBe(0)
  })

  it('retract delegates to store.retractBelief', async () => {
    await beliefStore.retract('belief-1')
    expect(store.retractBelief).toHaveBeenCalledWith('belief-1')
  })

  it('getBeliefs delegates to store', async () => {
    ;(store.getBeliefs.mockResolvedValue as any)([{ id: 'b1' }])
    const result = await beliefStore.getBeliefs('agent', 'agent-1')
    expect(result).toHaveLength(1)
    expect(store.getBeliefs).toHaveBeenCalledWith('agent', 'agent-1')
  })

  it('getLiveBeliefs filters out retracted beliefs', async () => {
    ;(store.getBeliefs.mockResolvedValue as any)([
      { id: 'b1', retracted: false },
      { id: 'b2', retracted: true },
      { id: 'b3', retracted: false },
    ])
    const result = await beliefStore.getLiveBeliefs('agent', 'agent-1')
    expect(result).toHaveLength(2)
  })
})
