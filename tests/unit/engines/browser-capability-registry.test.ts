import { describe, expect, test } from 'bun:test'
import { AGENT_ROLES, getAgentRole } from '../../../src/engines/automation/agents.js'
import { RECIPES, getRecipe } from '../../../src/engines/browser-automation/recipes.js'
import { BrowserCapabilityRegistry } from '../../../src/engines/browser-automation/registry.js'
import type { CapabilityAxis } from '../../../src/engines/browser-automation/types.js'

function makeGov() {
  return {} as any
}
function makeGrounding() {
  return {} as any
}

describe('BrowserCapabilityRegistry', () => {
  const reg = new BrowserCapabilityRegistry(makeGov(), makeGrounding())

  test('registers 100+ capabilities', () => {
    expect(reg.list().length).toBeGreaterThanOrEqual(100)
  })

  test('capabilities span all 12 axes', () => {
    const axes = new Set(reg.list().map((d) => d.axis))
    for (const axis of [
      'nav',
      'input',
      'scroll',
      'wait',
      'extract',
      'capture',
      'tab',
      'net',
      'state',
      'observe',
      'flow',
      'os',
    ]) {
      expect(axes.has(axis as CapabilityAxis)).toBe(true)
    }
  })

  test('resolve returns a known capability', () => {
    const def = reg.resolve('auto:nav:navigate' as any)
    expect(def.id).toBe('auto:nav:navigate')
  })

  test('resolve throws on unknown', () => {
    expect(() => reg.resolve('auto:nope:nope')).toThrow()
  })
})

describe('recipe library', () => {
  test('exposes 40+ composite recipes', () => {
    expect(RECIPES.length).toBeGreaterThanOrEqual(40)
  })

  test('recipe ids follow auto:<class>:<action>', () => {
    for (const r of RECIPES) expect(r.id.startsWith('auto:')).toBe(true)
  })

  test('getRecipe finds by id', () => {
    expect(getRecipe('auto:research:report')?.id).toBe('auto:research:report')
  })
})

describe('agent roles', () => {
  test('five config-role agents defined', () => {
    expect(Object.keys(AGENT_ROLES).sort()).toEqual(
      ['extractor', 'monitor', 'researcher', 'synthesizer', 'tester'].sort(),
    )
  })

  test('each role has a trust policy + default recipe', () => {
    for (const role of Object.values(AGENT_ROLES)) {
      expect(role.trust).toBeDefined()
      expect(role.defaultRecipe).toMatch(/^auto:/)
    }
  })

  test('tester is destructive-gated, researcher is read', () => {
    expect(getAgentRole('tester').trust.requiresConfirmation).toBe(true)
    expect(getAgentRole('researcher').trust.level).toBe('read')
  })
})
