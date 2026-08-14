// tests/unit/engines/dcb-profile.test.ts
// DcbProfile — profile → active layers + depth mode mapping tests

import { describe, expect, test } from 'bun:test'
import { activeLayers, DCB_PROFILES, profileToDepth, type DcbProfile } from '../../../src/engines/dcb-profile.js'

describe('activeLayers', () => {
  test('seed profile is minimal (identity + prefs + query)', () => {
    expect(activeLayers('seed')).toEqual(['L0Identity', 'L1GlobalPrefs', 'L7UserQuery'])
  })

  test('continuum includes conversation + history', () => {
    const layers = activeLayers('continuum')
    expect(layers).toContain('L4Conversation')
    expect(layers).toContain('L6RecentHistory')
  })

  test('handoff excludes prefs', () => {
    const layers = activeLayers('handoff')
    expect(layers).not.toContain('L1GlobalPrefs')
    expect(layers).toContain('L3Entity')
  })

  test('deep_research includes project + history', () => {
    const layers = activeLayers('deep_research')
    expect(layers).toContain('LpProjectState')
    expect(layers).toContain('L6RecentHistory')
  })

  test('unknown profile returns empty array', () => {
    expect(activeLayers('nope' as DcbProfile)).toEqual([])
  })

  test('every declared profile has at least the fixed layers', () => {
    for (const p of DCB_PROFILES) {
      const layers = activeLayers(p)
      expect(layers).toContain('L0Identity')
      expect(layers).toContain('L7UserQuery')
    }
  })
})

describe('profileToDepth', () => {
  test('seed → Compact', () => {
    expect(profileToDepth('seed')).toBe('Compact')
  })
  test('deep_research / convergence → Deep', () => {
    expect(profileToDepth('deep_research')).toBe('Deep')
    expect(profileToDepth('convergence')).toBe('Deep')
  })
  test('default → Standard', () => {
    expect(profileToDepth('continuum')).toBe('Standard')
    expect(profileToDepth('reunion')).toBe('Standard')
  })
})

describe('DCB_PROFILES', () => {
  test('enumerates all 8 profiles', () => {
    expect(DCB_PROFILES).toHaveLength(8)
    expect(new Set(DCB_PROFILES).size).toBe(8)
  })
})
