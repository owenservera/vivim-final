// tests/unit/engines/embedding-classifier.test.ts
// EmbeddingClassifier — cosine-similarity category classification tests

import { describe, expect, test, vi } from 'bun:test'
import { EmbeddingClassifier, type CategoryAnchor } from '../../../src/engines/embedding-classifier.js'
import type { EmbeddingProvider } from '../../../src/engines/semantic-search.js'

// Deterministic provider: maps a unique token to a unique axis so anchors and
// inputs never collide. Unrecognized text → zero vector (cosine 0 with everything).
function makeProvider() {
  const embed = vi.fn(async (text: string): Promise<number[] | null> => {
    if (text.includes('ZZTECH')) return [1, 0, 0]
    if (text.includes('ZZPERSON')) return [0, 1, 0]
    if (text.includes('ZZPROJ')) return [0, 0, 1]
    return [0, 0, 0]
  })
  return { provider: { embed } as unknown as EmbeddingProvider, embed }
}

const CUSTOM: CategoryAnchor[] = [
  { category: 'technology', anchorPhrases: ['ZZTECH anchor'] },
  { category: 'person', anchorPhrases: ['ZZPERSON anchor'] },
  { category: 'project', anchorPhrases: ['ZZPROJ anchor'] },
]

describe('EmbeddingClassifier', () => {
  test('init precomputes anchor embeddings', async () => {
    const { provider, embed } = makeProvider()
    const clf = new EmbeddingClassifier(provider, CUSTOM)
    await clf.init()
    expect(embed).toHaveBeenCalled()
  })

  test('classify returns a sorted, non-empty score list', async () => {
    const { provider } = makeProvider()
    const clf = new EmbeddingClassifier(provider, CUSTOM)
    const results = await clf.classify('ZZTECH input')
    expect(results.length).toBe(3)
    expect(results[0]!.score).toBeGreaterThanOrEqual(results[1]!.score)
    expect(results[1]!.score).toBeGreaterThanOrEqual(results[2]!.score)
  })

  test('topCategory returns the best-matching category', async () => {
    const { provider } = makeProvider()
    const clf = new EmbeddingClassifier(provider, CUSTOM)
    expect(await clf.topCategory('ZZPERSON input here')).toBe('person')
    expect(await clf.topCategory('ZZPROJ input here')).toBe('project')
    expect(await clf.topCategory('ZZTECH input here')).toBe('technology')
  })

  test('uses custom anchors provided at construction', async () => {
    const { provider } = makeProvider()
    const anchors: CategoryAnchor[] = [{ category: 'code', anchorPhrases: ['ZZTECH anchor'] }]
    const clf = new EmbeddingClassifier(provider, anchors)
    expect(await clf.topCategory('ZZTECH input')).toBe('code')
  })

  test('returns empty when provider yields no embeddings', async () => {
    const provider = { embed: vi.fn(async () => null) } as unknown as EmbeddingProvider
    const clf = new EmbeddingClassifier(provider, CUSTOM)
    expect(await clf.classify('anything')).toEqual([])
  })

  test('is idempotent across multiple classifications', async () => {
    const { provider } = makeProvider()
    const clf = new EmbeddingClassifier(provider, CUSTOM)
    const a = await clf.topCategory('ZZTECH input')
    const b = await clf.topCategory('ZZTECH input')
    expect(a).toBe(b)
  })
})
