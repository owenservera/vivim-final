// ─── Category Color System ──────────────────────────────────────────
// Maps command categories to HSL color triples (light/medium/dark shades).
// WCAG AA compliant: light shade on white bg, dark shade on dark bg.

import { CommandLanguageError } from '../../errors.js'
import type { CommandCategory } from './types.js'

export interface HslColor {
  h: number // 0-360
  s: number // 0-100
  l: number // 0-100
}

export interface CategoryColor {
  light: HslColor
  medium: HslColor
  dark: HslColor
}

/**
 * 12 categories × 3 HSL shades.
 * Light = for light backgrounds, Medium = default, Dark = for dark backgrounds.
 */
export const CATEGORY_COLORS: Record<CommandCategory, CategoryColor> = {
  conversation: {
    light: { h: 210, s: 80, l: 75 },
    medium: { h: 210, s: 80, l: 55 },
    dark: { h: 210, s: 80, l: 35 },
  },
  memory: {
    light: { h: 280, s: 70, l: 75 },
    medium: { h: 280, s: 70, l: 55 },
    dark: { h: 280, s: 70, l: 35 },
  },
  email: {
    light: { h: 160, s: 70, l: 75 },
    medium: { h: 160, s: 70, l: 50 },
    dark: { h: 160, s: 70, l: 30 },
  },
  file: {
    light: { h: 30, s: 80, l: 75 },
    medium: { h: 30, s: 80, l: 55 },
    dark: { h: 30, s: 80, l: 35 },
  },
  browser: {
    light: { h: 190, s: 75, l: 75 },
    medium: { h: 190, s: 75, l: 55 },
    dark: { h: 190, s: 75, l: 35 },
  },
  llm: {
    light: { h: 340, s: 75, l: 75 },
    medium: { h: 340, s: 75, l: 55 },
    dark: { h: 340, s: 75, l: 35 },
  },
  system: {
    light: { h: 220, s: 60, l: 75 },
    medium: { h: 220, s: 60, l: 50 },
    dark: { h: 220, s: 60, l: 30 },
  },
  canvas: {
    light: { h: 120, s: 60, l: 75 },
    medium: { h: 120, s: 60, l: 50 },
    dark: { h: 120, s: 60, l: 30 },
  },
  channel: {
    light: { h: 45, s: 80, l: 75 },
    medium: { h: 45, s: 80, l: 55 },
    dark: { h: 45, s: 80, l: 35 },
  },
  session: {
    light: { h: 300, s: 65, l: 75 },
    medium: { h: 300, s: 65, l: 50 },
    dark: { h: 300, s: 65, l: 30 },
  },
  workflow: {
    light: { h: 15, s: 80, l: 75 },
    medium: { h: 15, s: 80, l: 55 },
    dark: { h: 15, s: 80, l: 35 },
  },
  automation: {
    light: { h: 260, s: 70, l: 75 },
    medium: { h: 260, s: 70, l: 50 },
    dark: { h: 260, s: 70, l: 30 },
  },
  provider: {
    light: { h: 180, s: 70, l: 75 },
    medium: { h: 180, s: 70, l: 50 },
    dark: { h: 180, s: 70, l: 30 },
  },
  agent: {
    light: { h: 320, s: 65, l: 75 },
    medium: { h: 320, s: 65, l: 50 },
    dark: { h: 320, s: 65, l: 30 },
  },
  tag: {
    light: { h: 50, s: 80, l: 75 },
    medium: { h: 50, s: 80, l: 55 },
    dark: { h: 50, s: 80, l: 35 },
  },
  discovery: {
    light: { h: 200, s: 75, l: 75 },
    medium: { h: 200, s: 75, l: 55 },
    dark: { h: 200, s: 75, l: 35 },
  },
}

/**
 * Get a specific shade for a category.
 */
export function getShade(category: CommandCategory, shade: 'light' | 'medium' | 'dark'): HslColor {
  const colors = CATEGORY_COLORS[category]
  if (!colors) {
    throw new CommandLanguageError('UNKNOWN_CATEGORY', `Unknown category: ${category}`)
  }
  return colors[shade]
}

/**
 * Blend multiple category colors into a single HSL color.
 * Uses circular mean for hue, arithmetic mean for saturation and lightness.
 */
export function getBlendedColor(
  categories: CommandCategory[],
  shade: 'light' | 'medium' | 'dark' = 'light',
): HslColor {
  if (categories.length === 0) {
    return { h: 0, s: 0, l: 50 }
  }

  if (categories.length === 1) {
    return getShade(categories[0]!, shade)
  }

  // Circular mean for hue
  let sinSum = 0
  let cosSum = 0
  let sSum = 0
  let lSum = 0

  for (const cat of categories) {
    const color = getShade(cat, shade)
    const hueRad = (color.h * Math.PI) / 180
    sinSum += Math.sin(hueRad)
    cosSum += Math.cos(hueRad)
    sSum += color.s
    lSum += color.l
  }

  const avgHueRad = Math.atan2(sinSum, cosSum)
  const avgHue = ((avgHueRad * 180) / Math.PI + 360) % 360

  return {
    h: Math.round(avgHue),
    s: Math.round(sSum / categories.length),
    l: Math.round(lSum / categories.length),
  }
}

/**
 * Calculate WCAG contrast ratio between two HSL colors.
 * Returns ratio between 1 (identical) and 21 (black on white).
 */
export function getContrastRatio(fg: HslColor, bg: HslColor): number {
  const fgLum = getRelativeLuminance(fg)
  const bgLum = getRelativeLuminance(bg)

  const lighter = Math.max(fgLum, bgLum)
  const darker = Math.min(fgLum, bgLum)

  return (lighter + 0.05) / (darker + 0.05)
}

/**
 * Get relative luminance from HSL color.
 */
function getRelativeLuminance(color: HslColor): number {
  const rgb = hslToRgb(color.h, color.s, color.l)
  const mapped = rgb.map((c) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  })
  const r = mapped[0] as number
  const g = mapped[1] as number
  const b = mapped[2] as number
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/**
 * Convert HSL to RGB.
 */
function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const sN = s / 100
  const lN = l / 100

  const c = (1 - Math.abs(2 * lN - 1)) * sN
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = lN - c / 2

  let r = 0
  let g = 0
  let b = 0

  if (h < 60) {
    r = c
    g = x
    b = 0
  } else if (h < 120) {
    r = x
    g = c
    b = 0
  } else if (h < 180) {
    r = 0
    g = c
    b = x
  } else if (h < 240) {
    r = 0
    g = x
    b = c
  } else if (h < 300) {
    r = x
    g = 0
    b = c
  } else {
    r = c
    g = 0
    b = x
  }

  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)]
}

/**
 * Convert hex color to HSL.
 */
export function hexToHsl(hex: string): HslColor {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  if (!result) {
    throw new CommandLanguageError('INVALID_HEX_COLOR', `Invalid hex color: ${hex}`)
  }

  const r = Number.parseInt(result[1] as string, 16) / 255
  const g = Number.parseInt(result[2] as string, 16) / 255
  const b = Number.parseInt(result[3] as string, 16) / 255

  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const d = max - min
  const l = (max + min) / 2

  let h = 0
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1))

  if (d !== 0) {
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6
    else if (max === g) h = ((b - r) / d + 2) / 6
    else h = ((r - g) / d + 4) / 6
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  }
}

/**
 * Convert HSL to hex color.
 */
export function hslToHex(h: number, s: number, l: number): string {
  const rgb = hslToRgb(h, s, l)
  return `#${rgb.map((c) => c.toString(16).padStart(2, '0')).join('')}`
}
