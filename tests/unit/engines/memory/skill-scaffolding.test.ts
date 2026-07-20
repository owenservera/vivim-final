// tests/unit/engines/memory/skill-scaffolding.test.ts
// Unit tests for stripSkillScaffolding (decision D10 / FR-012).

import { describe, expect, it } from 'bun:test'
import { stripSkillScaffolding } from '../../../../src/engines/memory/skill-scaffolding.js'

describe('stripSkillScaffolding', () => {
  it('returns trimmed text with no scaffolding', () => {
    expect(stripSkillScaffolding('  just do the thing  ')).toBe('just do the thing')
  })

  it('recovers real instruction when scaffolding wraps it', () => {
    const input =
      '<skill_scaffolding>use the search tool</skill_scaffolding>\nFind the capital of France'
    expect(stripSkillScaffolding(input)).toBe('Find the capital of France')
  })

  it('returns null for bare skill invocation (nothing but scaffolding)', () => {
    const input = '<skill_scaffolding>call tool X then tool Y</skill_scaffolding>'
    expect(stripSkillScaffolding(input)).toBeNull()
  })

  it('handles multiple scaffolding blocks', () => {
    const input =
      '<skill_scaffolding>a</skill_scaffolding>real<skill_scaffolding>b</skill_scaffolding>'
    expect(stripSkillScaffolding(input)).toBe('real')
  })

  it('returns null for empty/whitespace-only content', () => {
    expect(stripSkillScaffolding('   ')).toBeNull()
  })
})
