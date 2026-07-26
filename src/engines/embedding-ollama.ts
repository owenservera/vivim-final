// src/engines/embedding-ollama.ts
// OllamaEmbeddingProvider — real embeddings via Ollama /api/embeddings.
// Uses nomic-embed-text (768-d). Falls back gracefully if Ollama is unavailable.

import { EngineError } from '../errors.js'
import type { EmbeddingProvider } from './semantic-search.js'

export class OllamaEmbeddingProvider implements EmbeddingProvider {
  readonly name = 'ollama:nomic-embed-text'
  readonly dimensions = 768
  private readonly endpoint: string

  constructor(endpoint = 'http://localhost:11434') {
    this.endpoint = endpoint
  }

  async embed(text: string): Promise<number[]> {
    const result = (await this.embedBatch([text]))[0]
    if (!result) throw new EngineError('Ollama embed returned empty result')
    return result
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return []

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 120_000)

    try {
      const res = await fetch(`${this.endpoint}/api/embeddings`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ model: 'nomic-embed-text', input: texts }),
        signal: controller.signal,
      })

      clearTimeout(timeout)

      if (!res.ok) {
        throw new EngineError(`Ollama embed failed: ${res.status} ${res.statusText}`)
      }

      const data = (await res.json()) as { embeddings: number[][] }
      const embeddings = data.embeddings

      if (!Array.isArray(embeddings) || embeddings.length !== texts.length) {
        throw new EngineError('Ollama embed response shape mismatch')
      }

      return embeddings
    } catch (err) {
      clearTimeout(timeout)
      if (err instanceof EngineError) throw err
      throw new EngineError(
        `Ollama embed request failed: ${err instanceof Error ? err.message : String(err)}`,
      )
    }
  }
}
