// tests/unit/devops/confidence-gate.test.ts
import { describe, expect, it } from 'bun:test'
import {
  PARSER_MIN_CONFIDENCE,
  SELECTOR_MIN_CONFIDENCE,
  confidenceGate,
} from '../../../devops/confidence-gate.js'

describe('confidenceGate', () => {
  it('passes at or above threshold', () => {
    const r = confidenceGate('sel', 0.85, SELECTOR_MIN_CONFIDENCE)
    expect(r.passed).toBe(true)
    expect(r.score).toBe(0.85)
  })

  it('fails below threshold', () => {
    const r = confidenceGate('sel', 0.79, SELECTOR_MIN_CONFIDENCE)
    expect(r.passed).toBe(false)
  })

  it('exposes correct thresholds', () => {
    expect(PARSER_MIN_CONFIDENCE).toBe(0.7)
    expect(SELECTOR_MIN_CONFIDENCE).toBe(0.8)
    const p = confidenceGate('p', 0.7, PARSER_MIN_CONFIDENCE)
    expect(p.passed).toBe(true)
    const s = confidenceGate('s', 0.79, SELECTOR_MIN_CONFIDENCE)
    expect(s.passed).toBe(false)
  })
})
