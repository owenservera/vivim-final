// tests/unit/engines/nlcl/tfidf.test.ts
import { describe, expect, it } from 'bun:test'
import { Tfidf, cosineSimilarity } from '../../../../src/engines/nlcl/tfidf.js'

describe('Tfidf', () => {
  const corpus = [
    'open the settings page',
    'send a message to the team',
    'summarize the conversation',
    'open the browser window',
  ]

  it('fit builds a vocabulary and idf map over the corpus', () => {
    const tfidf = new Tfidf()
    tfidf.fit(corpus)
    const vec = tfidf.transform('open the settings')
    expect(vec.size).toBeGreaterThan(0)
    // every weight is finite and positive (smoothed IDF)
    for (const w of vec.values()) {
      expect(Number.isFinite(w)).toBe(true)
      expect(w).toBeGreaterThan(0)
    }
  })

  it('transform returns empty vector for empty input', () => {
    const tfidf = new Tfidf()
    tfidf.fit(corpus)
    expect(tfidf.transform('').size).toBe(0)
  })

  it('transform drops tokens shorter than minTokenLength', () => {
    const tfidf = new Tfidf({ minTokenLength: 4 })
    tfidf.fit(corpus)
    const vec = tfidf.transform('open the page')
    // "the" (3) should be dropped
    expect(vec.has('the')).toBe(false)
    expect(vec.has('open')).toBe(true)
  })

  it('produces normalized vectors (unit length)', () => {
    const tfidf = new Tfidf()
    tfidf.fit(corpus)
    const vec = tfidf.transform('open the settings page now')
    let norm = 0
    for (const w of vec.values()) norm += w * w
    expect(Math.sqrt(norm)).toBeCloseTo(1, 5)
  })
})

describe('cosineSimilarity', () => {
  it('is 0 for empty vectors', () => {
    expect(cosineSimilarity(new Map(), new Map())).toBe(0)
  })

  it('is 1 for identical (normalized) vectors', () => {
    // cosineSimilarity expects pre-normalized vectors (as Tfidf.transform returns).
    const a = new Map([
      ['x', 1 / Math.sqrt(5)],
      ['y', 2 / Math.sqrt(5)],
    ])
    expect(cosineSimilarity(a, new Map(a))).toBeCloseTo(1, 10)
  })

  it('is 0 for orthogonal vectors', () => {
    const a = new Map([['x', 1]])
    const b = new Map([['y', 1]])
    expect(cosineSimilarity(a, b)).toBe(0)
  })

  it('is in (0,1) for partially overlapping vectors', () => {
    const a = new Map([
      ['open', 0.8],
      ['settings', 0.6],
    ])
    const b = new Map([
      ['open', 0.7],
      ['window', 0.9],
    ])
    const sim = cosineSimilarity(a, b)
    expect(sim).toBeGreaterThan(0)
    expect(sim).toBeLessThan(1)
  })
})
