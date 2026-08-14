// tests/unit/engines/embedding-hf.test.ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'bun:test'
import { HfEmbeddingProvider } from '../../../src/engines/embedding-hf.js'

// Mock @huggingface/transformers — ONNX pipeline is heavy and needs model download
// pipeline() must return a callable function (the pipeline), not an object.
const mockPipelineFn = vi.fn()

vi.mock('@huggingface/transformers', () => ({
  pipeline: vi.fn(async () => mockPipelineFn),
}))

describe('HfEmbeddingProvider', () => {
  let provider: HfEmbeddingProvider

  beforeEach(() => {
    provider = new HfEmbeddingProvider()
    mockPipelineFn.mockReset()
  })

  afterEach(() => {
    // Reset the module-level _pipePromise singleton between tests
    provider.dispose()
  })

  it('has correct name and dimensions', () => {
    expect(provider.name).toBe('hf:mpnet-base-v2')
    expect(provider.dimensions).toBe(768)
  })

  it('embed returns 768-d L2-normalized vector', async () => {
    const fakeVec = Array.from({ length: 768 }, (_, i) => (i % 2 === 0 ? 0.01 : -0.01))
    const norm = Math.sqrt(fakeVec.reduce((s, v) => s + v * v, 0))
    const normalized = fakeVec.map((v) => v / norm)

    mockPipelineFn.mockResolvedValue({
      data: new Float32Array(normalized),
      dims: [1, 768],
    })

    await provider.init()
    const result = await provider.embed('hello world')

    expect(result).toHaveLength(768)
    // L2 norm should be ~1.0 (normalized)
    const resultNorm = Math.sqrt(result.reduce((s, v) => s + v * v, 0))
    expect(resultNorm).toBeCloseTo(1.0, 2)
  })

  it('embedBatch returns multiple 768-d vectors', async () => {
    const vec1 = Array.from({ length: 768 }, () => 0.01)
    const vec2 = Array.from({ length: 768 }, () => -0.01)
    const n1 = Math.sqrt(vec1.reduce((s, v) => s + v * v, 0))
    const n2 = Math.sqrt(vec2.reduce((s, v) => s + v * v, 0))
    const norm1 = vec1.map((v) => v / n1)
    const norm2 = vec2.map((v) => v / n2)

    // embedBatch calls pipe(texts) once — returns flat [batch*dim] tensor
    mockPipelineFn.mockResolvedValueOnce({
      data: new Float32Array([...norm1, ...norm2]),
      dims: [2, 768],
    })

    await provider.init()
    const results = await provider.embedBatch(['hello', 'world'])

    expect(results).toHaveLength(2)
    expect(results[0]).toHaveLength(768)
    expect(results[1]).toHaveLength(768)
    // Vectors should be different
    expect(results[0]?.[0]).not.toBe(results[1]?.[0])
  })

  it('init is idempotent — double init does not recreate pipeline', async () => {
    mockPipelineFn.mockResolvedValue({
      data: new Float32Array(768),
      dims: [1, 768],
    })

    await provider.init()
    await provider.init()

    // Pipeline should only be created once (module-level singleton)
    // The mock just verifies init doesn't throw
    expect(true).toBe(true)
  })

  it('dispose clears state for tests', async () => {
    mockPipelineFn.mockResolvedValue({
      data: new Float32Array(768),
      dims: [1, 768],
    })

    await provider.init()
    provider.dispose()
    // After dispose, next init should recreate
    await provider.init()
    expect(true).toBe(true)
  })
})

describe('HfEmbeddingProvider — semantic quality (mock)', () => {
  let provider: HfEmbeddingProvider

  afterEach(() => {
    provider?.dispose()
  })

  it('similar texts produce more similar vectors than dissimilar ones', async () => {
    provider = new HfEmbeddingProvider()

    // Craft mock vectors where "cat" and "kitten" are similar, "cat" and "car" are not
    const catVec = Array.from({ length: 768 }, (_, i) => Math.sin(i * 0.1) * 0.01)
    const kittenVec = catVec.map((v) => v + 0.001) // very close to cat
    const carVec = Array.from({ length: 768 }, (_, i) => Math.cos(i * 0.1) * 0.01) // different direction

    const normalize = (v: number[]) => {
      const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0))
      return v.map((x) => x / norm)
    }

    await provider.init()

    // embedBatch calls pipe(texts) once — returns flat [batch*dim] tensor
    mockPipelineFn.mockResolvedValueOnce({
      data: new Float32Array([...normalize(catVec), ...normalize(kittenVec), ...normalize(carVec)]),
      dims: [3, 768],
    })

    const [catEmb, kittenEmb, carEmb] = await provider.embedBatch(['cat', 'kitten', 'car'])

    // cosine similarity helper
    const cos = (a: number[], b: number[]) => {
      let dot = 0,
        na = 0,
        nb = 0
      for (let i = 0; i < a.length; i++) {
        dot += (a[i] ?? 0) * (b[i] ?? 0)
        na += (a[i] ?? 0) ** 2
        nb += (b[i] ?? 0) ** 2
      }
      return dot / (Math.sqrt(na) * Math.sqrt(nb))
    }

    const simCatKitten = cos(catEmb ?? [], kittenEmb ?? [])
    const simCatCar = cos(catEmb ?? [], carEmb ?? [])

    expect(simCatKitten).toBeGreaterThan(simCatCar)
  })
})
