// tests/unit/ml/embed-runtime.test.ts
import { describe, expect, it } from 'bun:test'
import {
  MlBackendError,
  MlNotReadyError,
  cosine,
} from 'C:/0-BlackBoxProject-0/vivim-final/web/ui/src/ml/embed-runtime'
import { classify } from 'C:/0-BlackBoxProject-0/vivim-final/web/ui/src/ml/prerouter'

describe('cosine', () => {
  it('returns 1 for identical normalized vectors', () => {
    expect(cosine([1, 0, 0], [1, 0, 0])).toBeCloseTo(1)
  })
  it('returns 0 for orthogonal vectors', () => {
    expect(cosine([1, 0], [0, 1])).toBeCloseTo(0)
  })
  it('is scale-invariant', () => {
    expect(cosine([2, 0, 0], [1, 0, 0])).toBeCloseTo(1)
  })
  it('throws on length mismatch', () => {
    expect(() => cosine([1, 2], [1])).toThrow()
  })
})

describe('prerouter.classify', () => {
  it('routes a model-switch phrase to local', () => {
    const r = classify('switch model to claude')
    expect(r.route).toBe('local')
    expect(r.action).toBe('select_model')
    expect(r.confidence).toBeGreaterThan(0.5)
  })
  it('falls through ambiguous phrases to remote', () => {
    const r = classify('summarize this conversation')
    expect(r.route).toBe('remote')
  })
  it('returns remote for empty input', () => {
    expect(classify('').route).toBe('remote')
  })
})

describe('error classes', () => {
  it('MlNotReadyError is an Error', () => {
    expect(new MlNotReadyError()).toBeInstanceOf(Error)
  })
  it('MlBackendError is an Error', () => {
    expect(new MlBackendError()).toBeInstanceOf(Error)
  })
})
