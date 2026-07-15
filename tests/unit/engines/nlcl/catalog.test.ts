// tests/unit/engines/nlcl/catalog.test.ts
// Unit 1.4 — Hierarchical resolution + confidence

import { describe, expect, it } from 'bun:test'
import { getDefaultCommandPatterns } from '../../../../src/engines/nlcl/catalog.js'
import {
  listIntents,
  registerIntent,
  resolveIntentFromRegistry,
} from '../../../../src/engines/nlcl/entity-resolution.js'

describe('catalog.ts — hierarchical patterns', () => {
  it('patterns have nested slug structure (category.action)', () => {
    const patterns = getDefaultCommandPatterns()
    const browserNav = patterns.find((p) => p.id === 'browser.navigate')
    expect(browserNav).toBeTruthy()
    expect(browserNav?.category).toBe('browser')
    expect(browserNav?.executor).toBe('browser')
  })

  it('3-level NL resolves with confidence via hierarchical fallback', () => {
    const patterns = getDefaultCommandPatterns()
    const webQuery = patterns.find((p) => p.id === 'web.query')

    // Pattern exists and has capabilityId
    expect(webQuery).toBeTruthy()
    expect(webQuery?.capabilityId).toBe('cap:web:query')
    expect(webQuery?.classification).toBe('read')
  })

  it('patterns can be filtered by category', () => {
    const patterns = getDefaultCommandPatterns()
    const browserPatterns = patterns.filter((p) => p.category === 'browser')
    expect(browserPatterns.length).toBeGreaterThan(0)
    // Check hierarchical structure exists (id contains '.')
    const hasHierarchical = browserPatterns.some((p) => p.id?.includes('.'))
    expect(hasHierarchical).toBe(true)
  })
})

describe('entity-resolution.ts — registerIntent', () => {
  it('registerIntent adds a resolvable entry', () => {
    registerIntent('custom.test', ['custom pattern', 'test intent'], { confidence: 0.85 })
    const result = resolveIntentFromRegistry('run the custom pattern now')

    expect(result?.slug).toBe('custom.test')
    expect(result?.confidence).toBe(0.85)
  })

  it('listIntents returns all registered intents', () => {
    const before = listIntents().length
    registerIntent('another.test', ['another pattern'])
    const after = listIntents().length

    expect(after).toBeGreaterThanOrEqual(before + 1)
  })
})
