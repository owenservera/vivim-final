// shared/screenshot-budget.ts
// Token budget math for screenshots — ported from edge-pwa.
// Pure functions, zero dependencies.

export interface ScreenshotBudget {
  pxPerToken: number
  maxTargetPx: number
  maxTargetTokens: number
}

export const DEFAULT_BUDGET: ScreenshotBudget = {
  pxPerToken: 28,
  maxTargetPx: 1568,
  maxTargetTokens: 1568,
}

export const SCREENSHOT_DIMENSIONS = [768, 1024, 1280, 1568, 2560] as const
export type ScreenshotDimension = (typeof SCREENSHOT_DIMENSIONS)[number]

export const SCREENSHOT_FORMATS = {
  png: { label: 'PNG (lossless, large)', lossy: false },
  jpeg: { label: 'JPEG (lossy, small)', lossy: true },
  webp: { label: 'WebP (lossy, smaller)', lossy: true },
} as const

export type ScreenshotFormat = keyof typeof SCREENSHOT_FORMATS

// ─── Core Math ───────────────────────────────────────────────────────────────

function ceilDiv(n: number, d: number): number {
  return Math.floor((n - 1) / d) + 1
}

export function estimateTokens(width: number, height: number, pxPerToken = DEFAULT_BUDGET.pxPerToken): number {
  return ceilDiv(width, pxPerToken) * ceilDiv(height, pxPerToken)
}

/**
 * Compute optimal screenshot dimensions fitting within token budget.
 * Returns [width, height] maintaining aspect ratio.
 */
export function computeOptimalSize(
  width: number,
  height: number,
  budget: ScreenshotBudget = DEFAULT_BUDGET,
): [number, number] {
  const { pxPerToken, maxTargetPx, maxTargetTokens } = budget

  if (width <= maxTargetPx && height <= maxTargetPx && estimateTokens(width, height, pxPerToken) <= maxTargetTokens) {
    return [width, height]
  }

  if (height > width) {
    const [rw, rh] = computeOptimalSize(height, width, budget)
    return [rh, rw]
  }

  const aspectRatio = width / height
  let lo = 1
  let hi = width

  for (let iter = 0; iter < 50; iter++) {
    if (lo + 1 >= hi) break
    const mid = Math.floor((lo + hi) / 2)
    const calcHeight = Math.max(Math.round(mid / aspectRatio), 1)
    if (mid <= maxTargetPx && estimateTokens(mid, calcHeight, pxPerToken) <= maxTargetTokens) {
      lo = mid
    } else {
      hi = mid
    }
  }

  const optimalHeight = Math.max(Math.round(lo / aspectRatio), 1)
  return [lo, optimalHeight]
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
}

export function estimatedFileSizeKb(width: number, height: number, format: ScreenshotFormat, quality = 80): number {
  const pixels = width * height
  switch (format) {
    case 'png': return Math.round(pixels * 3 / 1024 / 5)
    case 'jpeg': return Math.round(pixels * (quality / 100) * 0.25 / 1024)
    case 'webp': return Math.round(pixels * (quality / 100) * 0.18 / 1024)
  }
}