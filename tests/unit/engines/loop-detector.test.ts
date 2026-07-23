// tests/unit/engines/loop-detector.test.ts
// Detects agent loops (repeated failed actions, oscillation).

import { describe, expect, it } from 'bun:test'
import { LoopDetector } from '../../../src/engines/loop-detector.js'

describe('LoopDetector', () => {
  describe('isLooping', () => {
    it('returns false with insufficient history', () => {
      const det = new LoopDetector({ maxRepeats: 3, windowSize: 10 })
      det.record('click', 'button', 'failure')
      det.record('click', 'button', 'failure')
      expect(det.isLooping()).toBe(false)
    })

    it('detects repeated failed actions (same action + target)', () => {
      const det = new LoopDetector({ maxRepeats: 3, windowSize: 10 })
      // Fill window with enough history
      for (let i = 0; i < 7; i++) {
        det.record('click', 'send-btn', 'success')
      }
      // 3 consecutive failures on same action
      det.record('click', 'send-btn', 'failure')
      det.record('click', 'send-btn', 'failure')
      det.record('click', 'send-btn', 'failure')

      expect(det.isLooping()).toBe(true)
    })

    it('does not detect loop when failures are on different actions', () => {
      const det = new LoopDetector({ maxRepeats: 3, windowSize: 10 })
      for (let i = 0; i < 7; i++) {
        det.record('scroll', 'page', 'success')
      }
      det.record('click', 'btn-a', 'failure')
      det.record('type', 'input-b', 'failure')
      det.record('click', 'btn-c', 'failure')

      expect(det.isLooping()).toBe(false)
    })

    it('detects oscillation pattern (A-B-A-B)', () => {
      const det = new LoopDetector({ maxRepeats: 3, windowSize: 10 })
      // Oscillation must be in the LAST 4 of the window
      // Fill with 6 neutral records, then the oscillation
      det.record('scroll', 'page', 'success')
      det.record('scroll', 'page', 'success')
      det.record('scroll', 'page', 'success')
      det.record('scroll', 'page', 'success')
      det.record('scroll', 'page', 'success')
      det.record('scroll', 'page', 'success')
      // Last 4: click-A, click-B, click-A, click-B
      det.record('click', 'btn-a', 'success')
      det.record('click', 'btn-b', 'success')
      det.record('click', 'btn-a', 'success')
      det.record('click', 'btn-b', 'success')

      expect(det.isLooping()).toBe(true)
    })

    it('does not detect oscillation with only 3 actions', () => {
      const det = new LoopDetector({ maxRepeats: 3, windowSize: 10 })
      for (let i = 0; i < 7; i++) {
        det.record('scroll', 'page', 'success')
      }
      // Only 3 alternating — not enough for pattern
      det.record('click', 'btn-a', 'success')
      det.record('click', 'btn-b', 'success')
      det.record('click', 'btn-a', 'success')

      expect(det.isLooping()).toBe(false)
    })

    it('resets after successful actions break the pattern', () => {
      const det = new LoopDetector({ maxRepeats: 3, windowSize: 10 })
      for (let i = 0; i < 7; i++) {
        det.record('scroll', 'page', 'success')
      }
      det.record('click', 'btn', 'failure')
      det.record('click', 'btn', 'failure')
      det.record('click', 'btn', 'failure')
      expect(det.isLooping()).toBe(true)

      det.reset()
      expect(det.isLooping()).toBe(false)
    })
  })

  describe('getSuggestion', () => {
    it('returns suggestion about the last failed action', () => {
      const det = new LoopDetector({ maxRepeats: 3, windowSize: 10 })
      for (let i = 0; i < 7; i++) {
        det.record('scroll', 'page', 'success')
      }
      det.record('click', 'send-btn', 'failure')
      det.record('click', 'send-btn', 'failure')
      det.record('click', 'send-btn', 'failure')

      const suggestion = det.getSuggestion()
      expect(suggestion).toContain('click')
      expect(suggestion).toContain('send-btn')
    })

    it('returns generic suggestion when no failures recorded', () => {
      const det = new LoopDetector()
      const suggestion = det.getSuggestion()
      expect(suggestion).toContain('looping')
    })
  })

  describe('config', () => {
    it('respects custom maxRepeats', () => {
      const det = new LoopDetector({ maxRepeats: 2, windowSize: 10 })
      for (let i = 0; i < 8; i++) {
        det.record('scroll', 'page', 'success')
      }
      det.record('click', 'btn', 'failure')
      det.record('click', 'btn', 'failure')

      expect(det.isLooping()).toBe(true)
    })

    it('respects custom windowSize', () => {
      const det = new LoopDetector({ maxRepeats: 3, windowSize: 5 })
      // Only 5 actions in window, need 3 failures
      det.record('click', 'btn', 'failure')
      det.record('click', 'btn', 'failure')
      det.record('click', 'btn', 'failure')
      det.record('scroll', 'page', 'success')
      det.record('scroll', 'page', 'success')

      // Window is 5, so recent 5 = [fail, fail, fail, success, success]
      // 3 consecutive failures exist
      expect(det.isLooping()).toBe(true)
    })
  })
})
