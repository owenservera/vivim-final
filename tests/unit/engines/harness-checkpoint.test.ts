import { beforeEach, describe, expect, mock, test } from 'bun:test'
import {
  HarnessCheckpointEngine,
  type HarnessCheckpointStore,
} from '../../../src/engines/harness-checkpoint.js'

function makeStore(): HarnessCheckpointStore {
  return {
    create: mock((input: any) => Promise.resolve(input)),
    getLatestBySlave: mock(() => Promise.resolve(null)),
    getLatestByConversation: mock(() => Promise.resolve(null)),
    deleteBySlave: mock(() => Promise.resolve()),
  }
}

describe('HarnessCheckpointEngine', () => {
  let store: HarnessCheckpointStore
  let engine: HarnessCheckpointEngine

  beforeEach(() => {
    store = makeStore()
    engine = new HarnessCheckpointEngine(store)
  })

  test('save clears old checkpoint and creates new one', async () => {
    const row = await engine.save({ slaveId: 's1', conversationId: 'c1', pageUrl: 'https://x.com' })
    expect(store.deleteBySlave).toHaveBeenCalledWith('s1')
    expect(row.slaveId).toBe('s1')
    expect(row.conversationId).toBe('c1')
    expect(row.pageUrl).toBe('https://x.com')
  })

  test('getLatest delegates to store.getLatestBySlave', async () => {
    ;(store.getLatestBySlave as any).mockResolvedValue({ id: 'cp1' })
    const result = await engine.getLatest('s1')
    expect(result?.id).toBe('cp1')
  })

  test('getForConversation delegates to store.getLatestByConversation', async () => {
    ;(store.getLatestByConversation as any).mockResolvedValue({ id: 'cp2' })
    const result = await engine.getForConversation('c1')
    expect(result?.id).toBe('cp2')
  })
})
