import { describe, expect, it } from 'bun:test'
import {
  CATEGORY_COLORS,
  getBlendedColor,
  getContrastRatio,
  getShade,
  hexToHsl,
  hslToHex,
} from '../../../../src/engines/command-language/colors.js'
import type { CommandCategory } from '../../../../src/engines/command-language/types.js'

describe('CategoryColors', () => {
  it('has colors for all 12 categories', () => {
    const expectedCategories: CommandCategory[] = [
      'conversation',
      'memory',
      'email',
      'file',
      'browser',
      'llm',
      'system',
      'canvas',
      'channel',
      'session',
      'workflow',
      'automation',
    ]
    for (const cat of expectedCategories) {
      expect(CATEGORY_COLORS[cat]).toBeDefined()
      expect(CATEGORY_COLORS[cat].light).toBeDefined()
      expect(CATEGORY_COLORS[cat].medium).toBeDefined()
      expect(CATEGORY_COLORS[cat].dark).toBeDefined()
    }
  })

  it('each category has valid HSL values', () => {
    for (const [_cat, colors] of Object.entries(CATEGORY_COLORS)) {
      expect(colors.light.h).toBeGreaterThanOrEqual(0)
      expect(colors.light.h).toBeLessThanOrEqual(360)
      expect(colors.light.s).toBeGreaterThanOrEqual(0)
      expect(colors.light.s).toBeLessThanOrEqual(100)
      expect(colors.light.l).toBeGreaterThanOrEqual(0)
      expect(colors.light.l).toBeLessThanOrEqual(100)
    }
  })
})

describe('getShade', () => {
  it('returns light shade', () => {
    const shade = getShade('conversation', 'light')
    expect(shade).toBeDefined()
    expect(shade.h).toBeGreaterThanOrEqual(0)
  })

  it('returns medium shade', () => {
    const shade = getShade('conversation', 'medium')
    expect(shade).toBeDefined()
  })

  it('returns dark shade', () => {
    const shade = getShade('conversation', 'dark')
    expect(shade).toBeDefined()
  })

  it('throws for unknown category', () => {
    expect(() => getShade('nonexistent' as CommandCategory, 'light')).toThrow()
  })
})

describe('getBlendedColor', () => {
  it('returns a color for single category', () => {
    const blended = getBlendedColor(['conversation'])
    expect(blended).toBeDefined()
    expect(blended.h).toBeGreaterThanOrEqual(0)
  })

  it('blends two categories', () => {
    const blended = getBlendedColor(['conversation', 'memory'])
    expect(blended).toBeDefined()
    expect(blended.h).toBeGreaterThanOrEqual(0)
  })

  it('blends multiple categories', () => {
    const blended = getBlendedColor(['conversation', 'memory', 'email', 'file'])
    expect(blended).toBeDefined()
  })

  it('returns light shade by default', () => {
    const blended = getBlendedColor(['conversation'])
    const direct = getShade('conversation', 'light')
    expect(blended.h).toBe(direct.h)
    expect(blended.s).toBe(direct.s)
  })
})

describe('getContrastRatio', () => {
  it('returns a number between 1 and 21', () => {
    const ratio = getContrastRatio({ h: 0, s: 100, l: 50 }, { h: 0, s: 0, l: 100 })
    expect(ratio).toBeGreaterThan(1)
    expect(ratio).toBeLessThanOrEqual(21)
  })

  it('returns 1 for identical colors', () => {
    const ratio = getContrastRatio({ h: 0, s: 100, l: 50 }, { h: 0, s: 100, l: 50 })
    expect(ratio).toBeCloseTo(1, 1)
  })

  it('returns high ratio for black and white', () => {
    const ratio = getContrastRatio({ h: 0, s: 0, l: 0 }, { h: 0, s: 0, l: 100 })
    expect(ratio).toBeCloseTo(21, 0)
  })
})

describe('hexToHsl', () => {
  it('converts red', () => {
    const hsl = hexToHsl('#ff0000')
    expect(hsl.h).toBe(0)
    expect(hsl.s).toBe(100)
    expect(hsl.l).toBe(50)
  })

  it('converts white', () => {
    const hsl = hexToHsl('#ffffff')
    expect(hsl.h).toBe(0)
    expect(hsl.s).toBe(0)
    expect(hsl.l).toBe(100)
  })

  it('converts black', () => {
    const hsl = hexToHsl('#000000')
    expect(hsl.h).toBe(0)
    expect(hsl.s).toBe(0)
    expect(hsl.l).toBe(0)
  })
})

describe('hslToHex', () => {
  it('converts red', () => {
    const hex = hslToHex(0, 100, 50)
    expect(hex).toBe('#ff0000')
  })

  it('converts white', () => {
    const hex = hslToHex(0, 0, 100)
    expect(hex).toBe('#ffffff')
  })

  it('converts black', () => {
    const hex = hslToHex(0, 0, 0)
    expect(hex).toBe('#000000')
  })
})
