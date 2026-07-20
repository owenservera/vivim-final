// tests/unit/engines/nlcl/text-normalizer.test.ts
import { describe, expect, it } from 'bun:test'
import {
  TextNormalizer,
  normalizeText,
  tokenizeText,
} from '../../../../src/engines/nlcl/text-normalizer.js'

const n = new TextNormalizer()

describe('TextNormalizer.normalize', () => {
  it('lower cases and trims', () => {
    expect(n.normalize('  Open SETTINGS  ')).toBe('open settings')
  })

  it('strips leading filler prefixes (one pass)', () => {
    expect(n.normalize('please open settings')).toBe('open settings')
    expect(n.normalize('can you send a message')).toBe('send a message')
  })

  it('strips repeated filler prefixes (loop to fixpoint)', () => {
    expect(n.normalize('please hey open settings')).toBe('open settings')
  })

  it('collapses internal whitespace', () => {
    expect(n.normalize('open    the     settings')).toBe('open the settings')
  })

  it('returns empty string for empty input', () => {
    expect(n.normalize('')).toBe('')
  })

  it('module-level normalizeText matches the class', () => {
    expect(normalizeText('Hey please open')).toBe('open')
  })
})

describe('TextNormalizer.tokenize', () => {
  it('tokenizes, stems, and drops stopwords', () => {
    const toks = n.tokenize('please open the settings page')
    expect(toks).toContain('open')
    expect(toks).toContain('setting')
    expect(toks).toContain('page')
    // stopwords removed
    expect(toks).not.toContain('the')
    expect(toks).not.toContain('please')
  })

  it('drops single-char tokens', () => {
    const toks = n.tokenize('a b open')
    expect(toks).not.toContain('a')
    expect(toks).not.toContain('b')
    expect(toks).toContain('open')
  })

  it('module-level tokenizeText works', () => {
    expect(tokenizeText('open settings').length).toBeGreaterThan(0)
  })
})

describe('TextNormalizer.stem (Porter-lite)', () => {
  it('strips a single matching suffix without shrinking below 3 chars', () => {
    // Porter-lite applies one suffix per call.
    expect(n.stem('running')).toBe('runn')
    expect(n.stem('settings')).toBe('setting')
    expect(n.stem('quickly')).toBe('quick')
  })

  it('leaves short tokens unchanged', () => {
    expect(n.stem('cat')).toBe('cat')
  })
})
