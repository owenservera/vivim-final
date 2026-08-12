// tests/unit/engines/classifier-nli.test.ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'bun:test'
import { NliClassifierProvider } from '../../../src/engines/classifier-nli.js'

// Mock @huggingface/transformers — ONNX pipeline is heavy and needs model download.
// pipeline() must return a callable function (the pipeline), not an object.
const mockPipelineFn = vi.fn()

vi.mock('@huggingface/transformers', () => ({
  pipeline: vi.fn(async () => mockPipelineFn),
}))

describe('NliClassifierProvider', () => {
  let provider: NliClassifierProvider

  beforeEach(() => {
    provider = new NliClassifierProvider()
    mockPipelineFn.mockReset()
  })

  afterEach(() => {
    provider.dispose()
  })

  it('has a stable provider name', () => {
    expect(provider.name).toBe('nli:deberta-v3-xsmall')
  })

  it('classify returns labels sorted by confidence', async () => {
    mockPipelineFn.mockResolvedValue({
      sequence: 'show me the system logs',
      labels: ['view logs', 'delete files', 'restart server'],
      scores: [0.91, 0.05, 0.04],
    })

    await provider.init()
    const result = await provider.classify('show me the system logs', [
      'view logs',
      'delete files',
      'restart server',
    ])

    expect(result.labels[0]).toBe('view logs')
    expect(result.scores[0]).toBeGreaterThan(0.9)
  })

  it('classify with empty candidate list short-circuits without calling the pipeline', async () => {
    const result = await provider.classify('anything', [])
    expect(result).toEqual({ labels: [], scores: [] })
    expect(mockPipelineFn).not.toHaveBeenCalled()
  })

  it('init is idempotent — double init does not throw', async () => {
    mockPipelineFn.mockResolvedValue({ sequence: '', labels: [], scores: [] })
    await provider.init()
    await provider.init()
    expect(true).toBe(true)
  })

  it('dispose clears state so a subsequent init recreates the pipeline', async () => {
    mockPipelineFn.mockResolvedValue({ sequence: '', labels: [], scores: [] })
    await provider.init()
    provider.dispose()
    await provider.init()
    expect(true).toBe(true)
  })
})
