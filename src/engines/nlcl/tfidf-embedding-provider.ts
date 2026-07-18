// src/engines/nlcl/tfidf-embedding-provider.ts
// TfidfEmbeddingProvider — EmbeddingProvider backed by TF-IDF sparse vectors.
// Converts sparse TF-IDF vectors to fixed-size dense vectors via the hashing trick.
// Used as a fallback when no local LLM embedding model is available.

import { createHash } from 'node:crypto'
import type { EmbeddingProvider } from '../semantic-search.js'
import { Tfidf } from './tfidf.js'

const DEFAULT_DIMENSIONS = 128

export class TfidfEmbeddingProvider implements EmbeddingProvider {
  readonly name = 'tfidf'
  readonly dimensions: number
  private readonly tfidf: Tfidf

  constructor(dimensions: number = DEFAULT_DIMENSIONS) {
    this.dimensions = dimensions
    this.tfidf = new Tfidf()
  }

  /** Fit the TF-IDF model on a corpus before embedding. */
  fitCorpus(corpus: string[]): void {
    this.tfidf.fit(corpus)
  }

  async embed(text: string): Promise<number[]> {
    const sparse = this.tfidf.transform(text)
    return this.sparseToDense(sparse)
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    return texts.map((t) => {
      const sparse = this.tfidf.transform(t)
      return this.sparseToDense(sparse)
    })
  }

  private sparseToDense(sparse: Map<string, number>): number[] {
    const vec = new Array<number>(this.dimensions).fill(0)
    for (const [token, weight] of sparse) {
      const bucket = this.hashToBucket(token)
      const current = vec[bucket]
      if (current !== undefined) {
        vec[bucket] = current + weight
      }
    }
    // L2 normalize
    let norm = 0
    for (let i = 0; i < vec.length; i++) {
      const v = vec[i]
      if (v !== undefined) {
        norm += v * v
      }
    }
    norm = Math.sqrt(norm) || 1
    for (let i = 0; i < vec.length; i++) {
      const v = vec[i]
      if (v !== undefined) {
        vec[i] = v / norm
      }
    }
    return vec
  }

  private hashToBucket(token: string): number {
    const hash = createHash('sha256').update(token).digest('hex')
    const num = Number.parseInt(hash.slice(0, 8), 16)
    return Math.abs(num) % this.dimensions
  }
}
