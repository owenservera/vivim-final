import { describe, expect, it } from 'bun:test'
import { updateHealthScore, shouldPromote, shouldDemote } from '../../../../src/engines/harness/confidence-promotion.js'

describe('confidence-promotion', () => {
  describe('updateHealthScore', () => {
    it('moves toward 1 on success', () => {
      const score = updateHealthScore({ current: 0.5, ok: true })
      expect(score).toBeGreaterThan(0.5)
      expect(score).toBeLessThanOrEqual(1)
    })

    it('moves toward 0 on failure', () => {
      const score = updateHealthScore({ current: 0.5, ok: false })
      expect(score).toBeLessThan(0.5)
      expect(score).toBeGreaterThanOrEqual(0)
    })

    it('uses default alpha of 0.2', () => {
      const score = updateHealthScore({ current: 0, ok: true })
      expect(score).toBe(0.2)
    })

    it('respects custom alpha', () => {
      const score = updateHealthScore({ current: 0, ok: true, alpha: 0.5 })
      expect(score).toBe(0.5)
    })

    it('clamps to [0, 1]', () => {
      expect(updateHealthScore({ current: 1, ok: true })).toBe(1)
      expect(updateHealthScore({ current: 0, ok: false })).toBe(0)
    })

    it('converges toward target over iterations', () => {
      let score = 0
      for (let i = 0; i < 50; i++) score = updateHealthScore({ current: score, ok: true })
      expect(score).toBeCloseTo(1, 0)
    })
  })

  describe('shouldPromote', () => {
    it('promotes when above threshold', () => {
      expect(shouldPromote(0.9)).toBe(true)
    })

    it('does not promote when below threshold', () => {
      expect(shouldPromote(0.7)).toBe(false)
    })

    it('uses default threshold of 0.8', () => {
      expect(shouldPromote(0.8)).toBe(true)
      expect(shouldPromote(0.79)).toBe(false)
    })

    it('respects custom threshold', () => {
      expect(shouldPromote(0.6, 0.5)).toBe(true)
      expect(shouldPromote(0.6, 0.7)).toBe(false)
    })
  })

  describe('shouldDemote', () => {
    it('demotes when below floor', () => {
      expect(shouldDemote(0.2)).toBe(true)
    })

    it('does not demote when above floor', () => {
      expect(shouldDemote(0.4)).toBe(false)
    })

    it('uses default floor of 0.3', () => {
      expect(shouldDemote(0.3)).toBe(false)
      expect(shouldDemote(0.29)).toBe(true)
    })

    it('respects custom floor', () => {
      expect(shouldDemote(0.4, 0.5)).toBe(true)
      expect(shouldDemote(0.4, 0.3)).toBe(false)
    })
  })
})
