import { describe, expect, it } from 'bun:test'
import { TextNormalizer, normalizeText, tokenizeText } from '../../../../src/engines/nlcl/text-normalizer.js'

describe('text-normalizer', () => {
  const normalizer = new TextNormalizer()

  describe('normalize', () => {
    it('lowercases input', () => {
      expect(normalizer.normalize('Hello World')).toBe('hello world')
    })

    it('strips filler prefix "please"', () => {
      expect(normalizer.normalize('please open my resume')).toBe('open my resume')
    })

    it('strips filler prefix "can you"', () => {
      expect(normalizer.normalize('can you search for weather')).toBe('search for weather')
    })

    it('strips filler prefix "i want to"', () => {
      expect(normalizer.normalize('i want to create a file')).toBe('create a file')
    })

    it('collapses whitespace', () => {
      expect(normalizer.normalize('  hello   world  ')).toBe('hello world')
    })

    it('returns empty string for empty input', () => {
      expect(normalizer.normalize('')).toBe('')
    })

    it('strips multiple filler layers', () => {
      expect(normalizer.normalize('please can you open the file')).toBe('open the file')
    })

    it('does not strip stopwords (only tokenize does)', () => {
      expect(normalizer.normalize('the quick brown fox')).toBe('the quick brown fox')
    })
  })

  describe('tokenize', () => {
    it('removes stopwords', () => {
      const tokens = normalizer.tokenize('the quick brown fox')
      expect(tokens).not.toContain('the')
      expect(tokens).toContain('quick')
      expect(tokens).toContain('brown')
      expect(tokens).toContain('fox')
    })

    it('applies stemming', () => {
      const tokens = normalizer.tokenize('running walked')
      expect(tokens).toContain('runn')
      expect(tokens).toContain('walk')
    })

    it('filters single-char tokens', () => {
      const tokens = normalizer.tokenize('a b c test')
      expect(tokens).not.toContain('a')
      expect(tokens).not.toContain('b')
      expect(tokens).toContain('test')
    })
  })

  describe('stem', () => {
    it('strips -ing suffix', () => {
      expect(normalizer.stem('running')).toBe('runn')
    })

    it('strips -ed suffix', () => {
      expect(normalizer.stem('walked')).toBe('walk')
    })

    it('strips -es suffix before -s', () => {
      expect(normalizer.stem('files')).toBe('fil')
    })

    it('strips -s suffix when -es does not match', () => {
      expect(normalizer.stem('cats')).toBe('cat')
    })

    it('strips -ly suffix', () => {
      expect(normalizer.stem('quickly')).toBe('quick')
    })

    it('does not stem short words', () => {
      expect(normalizer.stem('the')).toBe('the')
    })

    it('converts -ies to -y', () => {
      expect(normalizer.stem('cities')).toBe('city')
    })
  })

  describe('removeStopwords', () => {
    it('removes common stopwords', () => {
      expect(normalizer.removeStopwords(['the', 'cat', 'is', 'here'])).toEqual(['cat', 'here'])
    })
  })

  describe('normalizeText (exported)', () => {
    it('works the same as instance method', () => {
      expect(normalizeText('Please Open My Resume')).toBe('open my resume')
    })
  })

  describe('tokenizeText (exported)', () => {
    it('works the same as instance method', () => {
      const tokens = tokenizeText('the quick brown fox jumps')
      expect(tokens).toContain('quick')
      expect(tokens).toContain('brown')
    })
  })
})
