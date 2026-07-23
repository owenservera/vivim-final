import { describe, expect, it } from 'bun:test'
import { nextStatus, promoteProgram, isActive } from '../../../../src/engines/harness/binding-status-ladder.js'

describe('binding-status-ladder', () => {
  describe('nextStatus', () => {
    it('promotes draft to active on success', () => {
      expect(nextStatus('draft', true)).toBe('active')
    })

    it('promotes candidate to active on success', () => {
      expect(nextStatus('candidate', true)).toBe('active')
    })

    it('promotes degraded to active on success', () => {
      expect(nextStatus('degraded', true)).toBe('active')
    })

    it('promotes failed to active on success', () => {
      expect(nextStatus('failed', true)).toBe('active')
    })

    it('keeps active as active on success', () => {
      expect(nextStatus('active', true)).toBe('active')
    })

    it('degrades active on failure', () => {
      expect(nextStatus('active', false)).toBe('degraded')
    })

    it('degrades candidate on failure', () => {
      expect(nextStatus('candidate', false)).toBe('degraded')
    })

    it('fails degraded on failure', () => {
      expect(nextStatus('degraded', false)).toBe('failed')
    })

    it('stays failed on failure', () => {
      expect(nextStatus('failed', false)).toBe('failed')
    })
  })

  describe('promoteProgram', () => {
    it('promotes to "promoted" when binding is active', () => {
      expect(promoteProgram('candidate', 'active')).toBe('promoted')
    })

    it('demotes "promoted" to "candidate" when binding is not active', () => {
      expect(promoteProgram('promoted', 'degraded')).toBe('candidate')
    })

    it('returns current status when not promotable', () => {
      expect(promoteProgram('draft', 'degraded')).toBe('draft')
    })
  })

  describe('isActive', () => {
    it('returns true for active', () => {
      expect(isActive('active')).toBe(true)
    })

    it('returns false for non-active', () => {
      expect(isActive('draft')).toBe(false)
      expect(isActive('degraded')).toBe(false)
      expect(isActive('failed')).toBe(false)
    })
  })
})
