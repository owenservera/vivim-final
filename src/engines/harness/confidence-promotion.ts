// src/engines/harness/confidence-promotion.ts
// Unit 24.2 - Confidence promotion (cap-store healthScore exponential smoothing).
// Each outcome nudges the binding healthScore toward 1 (success) or 0 (failure).
// The smoothing factor keeps a single failure from nuking a healthy binding.

const DEFAULT_ALPHA = 0.2

export interface HealthInput {
  current: number
  ok: boolean
  alpha?: number
}

/** Exponential moving average of success rate -> new healthScore in [0,1]. */
export function updateHealthScore(input: HealthInput): number {
  const alpha = input.alpha ?? DEFAULT_ALPHA
  const target = input.ok ? 1 : 0
  const next = input.current + alpha * (target - input.current)
  return Math.min(1, Math.max(0, Number(next.toFixed(4))))
}

/**
 * Decide whether a binding should be promoted to 'active' based on its
 * smoothed healthScore crossing a confidence threshold (cap-store confidence gate).
 */
export function shouldPromote(healthScore: number, threshold = 0.8): boolean {
  return healthScore >= threshold
}

/** Demote when health sinks below a floor. */
export function shouldDemote(healthScore: number, floor = 0.3): boolean {
  return healthScore < floor
}
