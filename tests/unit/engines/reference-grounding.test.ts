// tests/unit/engines/reference-grounding.test.ts
// Phase 2 — ReferenceGroundingEngine unit tests.

import { describe, expect, it } from 'bun:test'
import { ReferenceGroundingEngine } from '../../../src/engines/reference-grounding.js'
import type { NLCContext } from '../../../src/engines/nlcl/types.js'

const CTX: NLCContext = {
  conversationId: 'conv-ground-test',
  metadata: { lastSubject: 'the quarterly report' },
}

const CTX_EMPTY: NLCContext = {
  conversationId: 'conv-ground-empty',
  metadata: {},
}

describe('ReferenceGroundingEngine', () => {
  const engine = new ReferenceGroundingEngine()

  it('should resolve "that" from dialogue context', () => {
    const refs = engine.ground('open that in a new tab', CTX)
    const thatRef = refs.find((r) => r.raw === 'that')
    expect(thatRef).toBeDefined()
    expect(thatRef!.resolvedValue).toBe('the quarterly report')
    expect(thatRef!.confidence).toBeGreaterThanOrEqual(0.7)
  })

  it('should resolve "the report" pattern', () => {
    const refs = engine.ground('summarize the report', CTX)
    const reportRef = refs.find((r) =>
      r.raw.toLowerCase().includes('report'),
    )
    expect(reportRef).toBeDefined()
    expect(reportRef!.resolvedType).toBe('entity')
  })

  it('should resolve temporal references', () => {
    const refs = engine.ground('show me yesterday\'s messages', CTX_EMPTY)
    const yesterdayRef = refs.find((r) => r.raw === 'yesterday')
    expect(yesterdayRef).toBeDefined()
    expect(yesterdayRef!.resolvedType).toBe('entity')
    expect(yesterdayRef!.confidence).toBe(0.9)
    // Should resolve to an ISO date string
    expect(yesterdayRef!.resolvedValue).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('should resolve browser context references', () => {
    const ctxWithSlave: NLCContext = { ...CTX_EMPTY, slaveId: 'chrome-1' }
    const refs = engine.ground('take a screenshot of the current page', ctxWithSlave)
    const pageRef = refs.find((r) =>
      r.raw.toLowerCase().includes('page'),
    )
    expect(pageRef).toBeDefined()
    expect(pageRef!.resolvedType).toBe('browser_element')
    expect(pageRef!.resolvedValue).toBe('browser:chrome-1')
  })

  it('should deduplicate references', () => {
    const refs = engine.ground('that and that', CTX)
    const thatRefs = refs.filter((r) => r.raw === 'that')
    expect(thatRefs.length).toBe(1)
  })

  it('should resolve a specific reference via resolveReference', () => {
    const existing = engine.ground('open the report', CTX)
    const resolved = engine.resolveReference('the report', CTX, existing)
    expect(resolved).not.toBeNull()
    expect(resolved!.resolvedValue).toBe('the quarterly report')
  })

  it('should return null for unresolvable reference', () => {
    const resolved = engine.resolveReference(
      'quantum entanglement device',
      CTX_EMPTY,
      [],
    )
    expect(resolved).toBeNull()
  })
})
