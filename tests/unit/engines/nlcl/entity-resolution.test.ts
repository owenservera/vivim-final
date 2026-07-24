import { describe, expect, it } from 'bun:test'
import {
  listIntents,
  normalizeBoolean,
  normalizeNumberWords,
  normalizeRelativeDate,
  normalizeRelativeTime,
  registerIntent,
  resolveEntityValues,
  resolveIntentFromRegistry,
} from '../../../../src/engines/nlcl/entity-resolution.js'

describe('entity-resolution', () => {
  const fixedNow = new Date('2026-07-15T12:00:00Z')

  describe('normalizeRelativeDate', () => {
    it('resolves "today"', () => {
      expect(normalizeRelativeDate('today', fixedNow)).toBe('2026-07-15')
    })

    it('resolves "tomorrow"', () => {
      expect(normalizeRelativeDate('tomorrow', fixedNow)).toBe('2026-07-16')
    })

    it('resolves "yesterday"', () => {
      expect(normalizeRelativeDate('yesterday', fixedNow)).toBe('2026-07-14')
    })

    it('resolves "in 3 days"', () => {
      expect(normalizeRelativeDate('in 3 days', fixedNow)).toBe('2026-07-18')
    })

    it('resolves "next friday" (Wed July 15 → next Fri July 17)', () => {
      expect(normalizeRelativeDate('next friday', fixedNow)).toBe('2026-07-17')
    })

    it('resolves "next monday" (Wed July 15 → next Mon July 20)', () => {
      expect(normalizeRelativeDate('next monday', fixedNow)).toBe('2026-07-20')
    })

    it('returns original text for unrecognized patterns', () => {
      expect(normalizeRelativeDate('july 4th', fixedNow)).toBe('july 4th')
    })
  })

  describe('normalizeRelativeTime', () => {
    it('resolves "noon"', () => {
      expect(normalizeRelativeTime('noon')).toBe('12:00')
    })

    it('resolves "midnight"', () => {
      expect(normalizeRelativeTime('midnight')).toBe('00:00')
    })

    it('resolves "3pm"', () => {
      expect(normalizeRelativeTime('3pm')).toBe('15:00')
    })

    it('resolves "12am"', () => {
      expect(normalizeRelativeTime('12am')).toBe('00:00')
    })

    it('resolves "9:30am"', () => {
      expect(normalizeRelativeTime('9:30am')).toBe('09:30')
    })

    it('returns original text for unrecognized patterns', () => {
      expect(normalizeRelativeTime('sometime')).toBe('sometime')
    })
  })

  describe('normalizeNumberWords', () => {
    it('converts "1k" to "1000"', () => {
      expect(normalizeNumberWords('1k')).toBe('1000')
    })

    it('converts "2m" to "2000000"', () => {
      expect(normalizeNumberWords('2m')).toBe('2000000')
    })

    it('converts "3b" to "3000000000"', () => {
      expect(normalizeNumberWords('3b')).toBe('3000000000')
    })

    it('converts spelled-out numbers', () => {
      expect(normalizeNumberWords('five')).toBe('5')
    })

    it('leaves plain numbers unchanged', () => {
      expect(normalizeNumberWords('42')).toBe('42')
    })
  })

  describe('normalizeBoolean', () => {
    it('returns true for "yes"', () => {
      expect(normalizeBoolean('yes')).toBe(true)
    })

    it('returns true for "true"', () => {
      expect(normalizeBoolean('true')).toBe(true)
    })

    it('returns false for "no"', () => {
      expect(normalizeBoolean('no')).toBe(false)
    })

    it('returns false for "off"', () => {
      expect(normalizeBoolean('off')).toBe(false)
    })

    it('returns original string for non-boolean', () => {
      expect(normalizeBoolean('maybe')).toBe('maybe')
    })
  })

  describe('resolveEntityValues', () => {
    it('resolves date keys', () => {
      const result = resolveEntityValues({ date: 'today' }, fixedNow)
      expect(result.date).toBe('2026-07-15')
    })

    it('resolves time keys', () => {
      const result = resolveEntityValues({ time: 'noon' })
      expect(result.time).toBe('12:00')
    })

    it('resolves count keys', () => {
      const result = resolveEntityValues({ count: '3k' })
      expect(result.count).toBe('3000')
    })

    it('resolves boolean keys', () => {
      const result = resolveEntityValues({ enabled: 'yes' })
      expect(result.enabled).toBe('true')
    })

    it('leaves unknown keys untouched', () => {
      const result = resolveEntityValues({ name: 'Alice' })
      expect(result.name).toBe('Alice')
    })

    it('recursively resolves nested objects', () => {
      const result = resolveEntityValues({ nested: { date: 'tomorrow' } }, fixedNow)
      expect((result.nested as any).date).toBe('2026-07-16')
    })
  })

  describe('intent registry', () => {
    it('registerIntent + listIntents', () => {
      registerIntent('test_reg_1', ['alpha_beta_77'], { confidence: 0.9 })
      const intents = listIntents()
      const found = intents.find((i) => i.slug === 'test_reg_1')
      expect(found).toBeDefined()
      expect(found?.patterns).toEqual(['alpha_beta_77'])
      expect(found?.confidence).toBe(0.9)
    })

    it('resolveIntentFromRegistry matches patterns', () => {
      registerIntent('test_reg_2', ['gamma_delta_88'], { confidence: 0.85 })
      const result = resolveIntentFromRegistry('please gamma_delta_88 for foo')
      expect(result).not.toBeNull()
      expect(result?.slug).toBe('test_reg_2')
      expect(result?.confidence).toBe(0.85)
    })

    it('resolveIntentFromRegistry returns null for no match', () => {
      const result = resolveIntentFromRegistry('zzz_no_match_zzz_999')
      expect(result).toBeNull()
    })
  })
})
