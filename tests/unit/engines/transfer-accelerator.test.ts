import { beforeEach, describe, expect, mock, test } from 'bun:test'
import {
  type ProviderCapabilityStore,
  TransferAccelerator,
} from '../../../src/engines/transfer-accelerator.js'

function makeMemory() {
  return {
    recallEpisodes: mock(() =>
      Promise.resolve([{ id: 'e1', action: 'click', providerId: 'a', success: true, ts: 1000 }]),
    ),
    assertFact: mock(() => Promise.resolve()),
  } as any
}

function makeProviderStore(): ProviderCapabilityStore {
  return {
    getProviders: mock(() =>
      Promise.resolve([
        { id: 'a', capabilities: ['click'] },
        { id: 'b', capabilities: [] },
      ]),
    ),
    getProviderCapabilities: mock(() => Promise.resolve([])),
  }
}

describe('TransferAccelerator', () => {
  let memory: ReturnType<typeof makeMemory>
  let providerStore: ProviderCapabilityStore
  let engine: TransferAccelerator

  beforeEach(() => {
    memory = makeMemory()
    providerStore = makeProviderStore()
    engine = new TransferAccelerator(memory, providerStore)
  })

  test('findTransferCandidates returns cross-provider patterns', async () => {
    const candidates = await engine.findTransferCandidates()
    expect(Array.isArray(candidates)).toBe(true)
  })

  test('attemptTransfer returns failure for unknown candidate', async () => {
    const result = await engine.attemptTransfer('nonexistent')
    expect(result.success).toBe(false)
    expect(result.lessonsLearned).toContain('Candidate not found')
  })

  test('batchTransfer returns summary', async () => {
    const result = await engine.batchTransfer()
    expect(result).toHaveProperty('candidatesFound')
    expect(result).toHaveProperty('attempted')
  })
})
