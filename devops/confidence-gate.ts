// devops/confidence-gate.ts
// Per-mode confidence gate helper. A mode halts (returns passed:false) when the
// observed score is below the threshold, and the caller appends a convergence task.

export interface ConfidenceGateResult {
  passed: boolean
  field: string
  score: number
  threshold: number
}

/**
 * Evaluate a confidence gate.
 * @param field     what was measured, e.g. "selector:#prompt-textarea" or "parser:chatgpt/001"
 * @param score     observed confidence in [0,1]
 * @param threshold minimum acceptable confidence (default 0.8 for selectors, 0.7 for parsers)
 */
export function confidenceGate(field: string, score: number, threshold: number): ConfidenceGateResult {
  return { passed: score >= threshold, field, score, threshold }
}

/** Default thresholds, shared across modes. */
export const SELECTOR_MIN_CONFIDENCE = 0.8
export const PARSER_MIN_CONFIDENCE = 0.7
