// src/engines/nlcl/tfidf.ts
// TFIDF — Layer 3 of the SOTA NLU pipeline (Semantic Similarity).
// Sparse TF-IDF vectorization + cosine similarity. Pure TypeScript, zero deps.
//
// SOTA reference: TF-IDF cosine is the "feels like AI" layer for paraphrase
// detection without ML training (Vex Intent Classifier, REIC RAG augmentation).
// Builds an IDF model over a corpus, then scores query→document cosine similarity.

import { defaultNormalizer } from './text-normalizer.js'

export type SparseVector = Map<string, number>

export interface TfidfOptions {
  minTokenLength?: number
}

export class Tfidf {
  private idf = new Map<string, number>()
  private docCount = 0
  private vocabulary = new Set<string>()
  private readonly minTokenLength: number

  constructor(opts: TfidfOptions = {}) {
    this.minTokenLength = opts.minTokenLength ?? 2
  }

  /** Fit IDF over a corpus of raw documents. Call once (or when corpus changes). */
  fit(corpus: string[]): void {
    this.docCount = corpus.length
    this.idf.clear()
    this.vocabulary.clear()

    const df = new Map<string, number>()
    for (const doc of corpus) {
      const tokens = this.tokenize(doc)
      const seen = new Set(tokens)
      for (const tok of seen) {
        this.vocabulary.add(tok)
        df.set(tok, (df.get(tok) ?? 0) + 1)
      }
    }

    for (const [tok, freq] of df) {
      // Smoothed IDF (always > 0).
      this.idf.set(tok, Math.log((this.docCount + 1) / (freq + 1)) + 1)
    }
  }

  /** Transform a raw text into a normalized TF-IDF sparse vector. */
  transform(text: string): SparseVector {
    const tokens = this.tokenize(text)
    if (tokens.length === 0) return new Map()
    const tf = new Map<string, number>()
    for (const tok of tokens) {
      tf.set(tok, (tf.get(tok) ?? 0) + 1)
    }
    const vec = new Map<string, number>()
    let norm = 0
    for (const [tok, count] of tf) {
      const idf = this.idf.get(tok)
      if (idf === undefined) continue
      const weight = (count / tokens.length) * idf
      vec.set(tok, weight)
      norm += weight * weight
    }
    norm = Math.sqrt(norm) || 1
    for (const [tok, weight] of vec) {
      vec.set(tok, weight / norm)
    }
    return vec
  }

  private tokenize(text: string): string[] {
    return defaultNormalizer
      .tokenize(text)
      .filter((t) => t.length >= this.minTokenLength)
  }
}

/** Cosine similarity between two sparse vectors in [0, 1]. */
export function cosineSimilarity(a: SparseVector, b: SparseVector): number {
  if (a.size === 0 || b.size === 0) return 0
  // Iterate the smaller vector for efficiency.
  const [small, large] = a.size <= b.size ? [a, b] : [b, a]
  let dot = 0
  for (const [tok, weight] of small) {
    const other = large.get(tok)
    if (other) dot += weight * other
  }
  return dot
}
