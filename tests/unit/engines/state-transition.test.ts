import { beforeEach, describe, expect, mock, test } from 'bun:test'
import {
  StateTransitionEngine,
  type StateTransitionStore,
} from '../../../src/engines/state-transition.js'

function makeStore(): StateTransitionStore {
  return {
    create: mock((input: any) => Promise.resolve(input)),
    listByEntity: mock(() => Promise.resolve([])),
    listByType: mock(() => Promise.resolve([])),
  }
}

describe('StateTransitionEngine', () => {
  let store: StateTransitionStore
  let engine: StateTransitionEngine

  beforeEach(() => {
    store = makeStore()
    engine = new StateTransitionEngine(store)
  })

  test('record creates a state transition row', async () => {
    const row = await engine.record({
      entityType: 'slave',
      entityId: 's1',
      fromState: 'idle',
      toState: 'running',
      trigger: 'launch',
    })
    expect(row.entityType).toBe('slave')
    expect(row.fromState).toBe('idle')
    expect(row.toState).toBe('running')
    expect(row.trigger).toBe('launch')
    expect(store.create).toHaveBeenCalled()
  })

  test('query delegates to store.listByEntity', async () => {
    await engine.query('slave', 's1', { limit: 10 })
    expect(store.listByEntity).toHaveBeenCalledWith('slave', 's1', { limit: 10 })
  })

  test('queryByType delegates to store.listByType', async () => {
    await engine.queryByType('conversation', { since: 1000 })
    expect(store.listByType).toHaveBeenCalledWith('conversation', { since: 1000 })
  })
})
