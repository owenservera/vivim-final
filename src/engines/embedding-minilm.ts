// src/engines/embedding-minilm.ts
// MiniLmEmbeddingProvider — pure-TS deterministic fallback for offline use.
// Hashed token bag-of-words -> 256-d vector with L2 normalization.
// Not SOTA, but produces real (non-zero) vectors with cosine structure.

import type { EmbeddingProvider } from './semantic-search.js'

function hashToken(token: string): number {
  let h = 0
  for (let i = 0; i < token.length; i++) {
    h = ((h << 5) - h + token.charCodeAt(i)) | 0
  }
  return Math.abs(h)
}

function l2Norm(vec: number[]): number {
  return Math.sqrt(vec.reduce((sum, v) => sum + v * v, 0))
}

function normalize(vec: number[]): number[] {
  const norm = l2Norm(vec)
  if (norm === 0) return vec
  return vec.map((v) => v / norm)
}

export class MiniLmEmbeddingProvider implements EmbeddingProvider {
  readonly name = 'minilm:ts'
  readonly dimensions = 256

  async embed(text: string): Promise<number[]> {
    return this.pool(text)
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    return texts.map((t) => this.pool(t))
  }

  private pool(text: string): number[] {
    const tokens = text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter((t) => t.length > 0)

    const vec = new Array(this.dimensions).fill(0)

    for (const token of tokens) {
      const bucket = hashToken(token) % this.dimensions
      vec[bucket] += 1
    }

    return normalize(vec)
  }
}
