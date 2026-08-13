// src/engines/embedding-classifier.ts
// EmbeddingClassifier — classify entities by cosine similarity to category anchors.
// Uses prototype embeddings for each category (technology, person, project).
// Falls back gracefully when embedding provider is unavailable.

import type { EmbeddingProvider } from './semantic-search.js'
import { cosineSimilarity } from './onboarding/webapp-fingerprint.js'

export interface CategoryAnchor {
  category: string
  anchorPhrases: string[]
}

const DEFAULT_ANCHORS: CategoryAnchor[] = [
  {
    category: 'technology',
    anchorPhrases: [
      'programming language',
      'software library',
      'database',
      'cloud platform',
      'framework',
      'build tool',
      'API',
      'SDK',
    ],
  },
  {
    category: 'person',
    anchorPhrases: ['person name', 'author', 'developer', 'user', 'team member'],
  },
  {
    category: 'project',
    anchorPhrases: ['software project', 'application name', 'system', 'repository', 'module'],
  },
]

export class EmbeddingClassifier {
  private anchors: Map<string, number[]> = new Map()
  private anchorDefinitions: CategoryAnchor[]
  private initialized = false

  constructor(
    private embeddingProvider: EmbeddingProvider,
    anchors?: CategoryAnchor[],
  ) {
    this.anchorDefinitions = anchors ?? DEFAULT_ANCHORS
  }

  /** Pre-compute anchor embeddings. Call once after construction. */
  async init(): Promise<void> {
    if (this.initialized) return
    for (const anchor of this.anchorDefinitions) {
      const combined = anchor.anchorPhrases.join(' ')
      const embedding = await this.embeddingProvider.embed(combined)
      if (embedding) {
        this.anchors.set(anchor.category, embedding)
      }
    }
    this.initialized = true
  }

  /**
   * Classify text into categories by cosine similarity to anchor embeddings.
   * Returns categories sorted by score (highest first).
   */
  async classify(text: string): Promise<Array<{ category: string; score: number }>> {
    if (!this.initialized) await this.init()
    if (this.anchors.size === 0) return []

    const textEmbedding = await this.embeddingProvider.embed(text)
    if (!textEmbedding) return []

    const results: Array<{ category: string; score: number }> = []
    for (const [category, anchorEmbedding] of this.anchors) {
      const score = cosineSimilarity(textEmbedding, anchorEmbedding)
      results.push({ category, score })
    }
    return results.sort((a, b) => b.score - a.score)
  }

  /**
   * Get the top category for a text snippet.
   * Returns null if no embedding provider or empty anchors.
   */
  async topCategory(text: string): Promise<string | null> {
    const results = await this.classify(text)
    return results[0]?.category ?? null
  }
}
