// tests/unit/engines/embedding-ollama.test.ts
import { describe, expect, it, vi } from 'bun:test'
import { OllamaEmbeddingProvider } from '../../../src/engines/embedding-ollama.js'
import { MiniLmEmbeddingProvider } from '../../../src/engines/embedding-minilm.js'

describe('OllamaEmbeddingProvider', () => {
  it('embedBatch parses data.embeddings with correct shape and dims', async () => {
    const fakeEmbeddings = [
      Array.from({ length: 768 }, () => 0.1),
      Array.from({ length: 768 }, () => 0.2),
    ]

    const originalFetch = globalThis.fetch
    globalThis.fetch = vi.fn(async (_url: string, _init?: RequestInit) => {
      return new Response(JSON.stringify({ embeddings: fakeEmbeddings }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    }) as typeof fetch

    try {
      const provider = new OllamaEmbeddingProvider('http://localhost:11434')
      const result = await (provider as any).embedBatch(['hello', 'world'])

      expect(globalThis.fetch).toHaveBeenCalledTimes(1)
      expect(result).toHaveLength(2)
      expect(result[0]).toHaveLength(768)
      expect(result[1]).toHaveLength(768)
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  it('throws on non-200 response', async () => {
    const originalFetch = globalThis.fetch
    globalThis.fetch = vi.fn(async () => {
      return new Response('not found', { status: 404 })
    }) as typeof fetch

    try {
      const provider = new OllamaEmbeddingProvider('http://localhost:11434')
      await expect((provider as any).embedBatch(['hello'])).rejects.toThrow('Ollama embed failed: 404')
    } finally {
      globalThis.fetch = originalFetch
    }
  })
})

describe('MiniLmEmbeddingProvider', () => {
  it('embed returns 256-d non-zero deterministic vector', async () => {
    const provider = new MiniLmEmbeddingProvider()
    const v1 = await provider.embed('hello world')
    const v2 = await provider.embed('hello world')

    expect(v1).toHaveLength(256)
    expect(v1.some((x) => x !== 0)).toBe(true)
    expect(v1).toEqual(v2)
  })
})
