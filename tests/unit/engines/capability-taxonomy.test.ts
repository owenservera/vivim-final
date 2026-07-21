// tests/unit/engines/capability-taxonomy.test.ts
// Unit 5.4 — validate capability taxonomy catalog

import { describe, expect, it } from 'bun:test'
import { CAPABILITY_TAXONOMY_V2 } from '../../../src/engines/capability-taxonomy.js'

describe('Capability Taxonomy v2', () => {
  it('length >= 15 (seed catalog established)', () => {
    expect(CAPABILITY_TAXONOMY_V2.length).toBeGreaterThanOrEqual(15)
  })

  it('every entry has required fields (id, slug, name, category)', () => {
    const _categories = new Set([
      'conversation',
      'model',
      'tools',
      'context',
      'export',
      'media',
      'navigation',
    ])
    for (const entry of CAPABILITY_TAXONOMY_V2) {
      expect(entry.id).toBeTruthy()
      expect(entry.slug).toBeTruthy()
      expect(entry.name).toBeTruthy()
      expect(entry.category).toBeTruthy()
    }
  })

  it('slugs unique across catalog', () => {
    const slugs = CAPABILITY_TAXONOMY_V2.map((e) => e.slug)
    const unique = new Set(slugs)
    expect(unique.size).toBe(slugs.length)
  })

  it('every entry has intentPatterns array', () => {
    for (const entry of CAPABILITY_TAXONOMY_V2) {
      expect(Array.isArray(entry.intentPatterns)).toBe(true)
      expect(entry.intentPatterns.length).toBeGreaterThan(0)
    }
  })

  it('every entry has all 5 surfaces', () => {
    const _allSurfaces: string[] = []
    for (const entry of CAPABILITY_TAXONOMY_V2) {
      expect(entry.surfaces).toContain('cli')
      expect(entry.surfaces).toContain('ui')
      expect(entry.surfaces).toContain('workflow')
      expect(entry.surfaces).toContain('mcp')
      expect(entry.surfaces).toContain('api')
    }
  })
})
