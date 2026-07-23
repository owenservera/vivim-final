// tests/unit/engines/capability-binder.test.ts
// CapabilityBinder — capability binding and topological ordering.
import { describe, expect, it, mock, beforeEach } from 'bun:test'
import { CapabilityBinder } from '../../../src/engines/capability-binder.js'

function makeStore() {
  return {
    putCapability: mock(() => Promise.resolve({ id: 'cap-1' })),
    bindCapability: mock(() => Promise.resolve()),
    nodes: {
      getNode: mock(() => Promise.resolve(null)),
    },
  }
}

describe('CapabilityBinder', () => {
  let store: ReturnType<typeof makeStore>
  let binder: CapabilityBinder

  beforeEach(() => {
    store = makeStore()
    binder = new CapabilityBinder(store as never)
  })

  it('putCapability delegates to store', async () => {
    const result = await binder.putCapability({ name: 'test', kind: 'builtin' })
    expect(result.id).toBe('cap-1')
    expect(store.putCapability).toHaveBeenCalledWith({ name: 'test', kind: 'builtin' })
  })

  it('bind delegates to store.bindCapability', async () => {
    await binder.bind('cap-1', 'run-1', 5)
    expect(store.bindCapability).toHaveBeenCalledWith('cap-1', 'run-1', 5)
  })

  it('bind uses default ordering=0', async () => {
    await binder.bind('cap-1', 'run-1')
    expect(store.bindCapability).toHaveBeenCalledWith('cap-1', 'run-1', 0)
  })

  it('resolveOrder returns empty when run not found', async () => {
    store.nodes.getNode.mockResolvedValue(null)
    const result = await binder.resolveOrder('run-1')
    expect(result).toEqual([])
  })

  it('resolveOrder returns sorted capabilities by ordering', async () => {
    const runNode = {
      edgesJson: JSON.stringify([
        { type: 'uses', targetId: 'cap-a', properties: { ordering: 2 } },
        { type: 'uses', targetId: 'cap-b', properties: { ordering: 1 } },
      ]),
    }
    const capA = { dataJson: JSON.stringify({ name: 'Alpha', provenanceJson: { capabilityKind: 'tool' } }) }
    const capB = { dataJson: JSON.stringify({ name: 'Beta', provenanceJson: { capabilityKind: 'builtin' } }) }

    store.nodes.getNode
      .mockResolvedValueOnce(runNode as never)
      .mockResolvedValueOnce(capA as never)
      .mockResolvedValueOnce(capB as never)

    const result = await binder.resolveOrder('run-1')
    expect(result).toHaveLength(2)
    expect(result[0]!.capId).toBe('cap-b')
    expect(result[0]!.ordering).toBe(1)
    expect(result[1]!.capId).toBe('cap-a')
    expect(result[1]!.ordering).toBe(2)
  })

  it('resolveOrder handles missing edgesJson gracefully', async () => {
    store.nodes.getNode.mockResolvedValue({ edgesJson: undefined } as never)
    const result = await binder.resolveOrder('run-1')
    expect(result).toEqual([])
  })
})
