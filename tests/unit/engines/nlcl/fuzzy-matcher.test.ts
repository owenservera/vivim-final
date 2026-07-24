import { describe, expect, it } from 'bun:test'
import {
  diceCoefficient,
  fuzzySimilarity,
  jaroWinkler,
  levenshtein,
  levenshteinSimilarity,
} from '../../../../src/engines/nlcl/fuzzy-matcher.js'

describe('fuzzy-matcher', () => {
  describe('levenshtein', () => {
    it('returns 0 for identical strings', () => {
      expect(levenshtein('abc', 'abc')).toBe(0)
    })

    it('returns length difference for empty vs non-empty', () => {
      expect(levenshtein('', 'abc')).toBe(3)
      expect(levenshtein('abc', '')).toBe(3)
    })

    it('computes single char deletion', () => {
      expect(levenshtein('abc', 'ac')).toBe(1)
    })

    it('computes single char insertion', () => {
      expect(levenshtein('ac', 'abc')).toBe(1)
    })

    it('computes substitution', () => {
      expect(levenshtein('abc', 'axc')).toBe(1)
    })

    it('computes full replacement', () => {
      expect(levenshtein('abc', 'xyz')).toBe(3)
    })
  })

  describe('levenshteinSimilarity', () => {
    it('returns 1 for identical strings', () => {
      expect(levenshteinSimilarity('abc', 'abc')).toBe(1)
    })

    it('returns 0 for completely different strings of same length', () => {
      expect(levenshteinSimilarity('abc', 'xyz')).toBe(0)
    })

    it('returns value in [0,1]', () => {
      const sim = levenshteinSimilarity('hello', 'world')
      expect(sim).toBeGreaterThanOrEqual(0)
      expect(sim).toBeLessThanOrEqual(1)
    })
  })

  describe('jaroWinkler', () => {
    it('returns 1 for identical strings', () => {
      expect(jaroWinkler('abc', 'abc')).toBe(1)
    })

    it('returns 0 for empty strings', () => {
      expect(jaroWinkler('', '')).toBe(1)
      expect(jaroWinkler('abc', '')).toBe(0)
    })

    it('is case-insensitive', () => {
      expect(jaroWinkler('ABC', 'abc')).toBe(1)
    })

    it('returns higher score for prefix matches', () => {
      const high = jaroWinkler('hello', 'hello world')
      const low = jaroWinkler('hello', 'world hello')
      expect(high).toBeGreaterThan(low)
    })

    it('returns value in [0,1]', () => {
      const score = jaroWinkler('martha', 'marhta')
      expect(score).toBeGreaterThan(0.9)
      expect(score).toBeLessThanOrEqual(1)
    })
  })

  describe('diceCoefficient', () => {
    it('returns 1 for identical strings', () => {
      expect(diceCoefficient('abc', 'abc')).toBe(1)
    })

    it('returns 0 for no bigram overlap', () => {
      expect(diceCoefficient('ab', 'cd')).toBe(0)
    })

    it('handles single char strings', () => {
      expect(diceCoefficient('a', 'a')).toBe(1)
      expect(diceCoefficient('a', 'b')).toBe(0)
    })

    it('handles empty strings', () => {
      expect(diceCoefficient('', '')).toBe(1)
    })
  })

  describe('fuzzySimilarity', () => {
    it('returns 1 for identical strings', () => {
      expect(fuzzySimilarity('abc', 'abc')).toBe(1)
    })

    it('returns value in [0,1]', () => {
      const score = fuzzySimilarity('hello', 'helo')
      expect(score).toBeGreaterThan(0)
      expect(score).toBeLessThanOrEqual(1)
    })

    it('is higher for similar strings than dissimilar', () => {
      const similar = fuzzySimilarity('hello', 'helo')
      const dissimilar = fuzzySimilarity('hello', 'world')
      expect(similar).toBeGreaterThan(dissimilar)
    })
  })
})
