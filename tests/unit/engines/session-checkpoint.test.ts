import { beforeEach, describe, expect, mock, test } from 'bun:test'
import {
  SessionCheckpointEngine,
  type SessionCheckpointStore,
} from '../../../src/engines/session-checkpoint.js'

function makeStore(): SessionCheckpointStore {
  return {
    create: mock((input: any) => Promise.resolve(input)),
    getLatestBySession: mock(() => Promise.resolve(null)),
    deleteOlderThan: mock(() => Promise.resolve()),
  }
}

describe('SessionCheckpointEngine', () => {
  let store: SessionCheckpointStore
  let engine: SessionCheckpointEngine

  beforeEach(() => {
    store = makeStore()
    engine = new SessionCheckpointEngine(store)
  })

  test('save creates checkpoint row', async () => {
    const row = await engine.save('sess1', { step: 3 })
    expect(row.vivim_session_id).toBe('sess1')
    expect(row.checkpoint_json).toBe(JSON.stringify({ step: 3 }))
    expect(store.create).toHaveBeenCalled()
  })

  test('getLatest delegates to store', async () => {
    ;(store.getLatestBySession as any).mockResolvedValue({ id: 'cp1', vivim_session_id: 'sess1' })
    const result = await engine.getLatest('sess1')
    expect(result?.id).toBe('cp1')
  })

  test('pruneOlderThan delegates to store', async () => {
    await engine.pruneOlderThan('sess1', 5)
    expect(store.deleteOlderThan).toHaveBeenCalledWith('sess1', 5)
  })
})
