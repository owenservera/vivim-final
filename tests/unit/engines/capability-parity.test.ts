// tests/unit/engines/capability-parity.test.ts
// Phase 1 — Tests for the Capability Parity Auditor.

import { describe, expect, test } from 'bun:test'
import { CapabilityParityAuditor } from '../../../src/engines/capability-parity.js'
import { UnifiedCapabilityRegistry } from '../../../src/engines/unified-registry.js'
import type { CommandPattern } from '../../../src/engines/nlcl/types.js'

function makePattern(overrides: Partial<CommandPattern>): CommandPattern {
  return {
    id: 'test-pattern',
    intent: 'test.intent',
    description: 'Test pattern',
    patterns: [],
    aliases: [],
    examples: [],
    inputSchema: { parse: () => ({}) } as never,
    outputSchema: { parse: () => ({}) } as never,
    executor: 'capability',
    execute: async () => ({ ok: true }),
    category: 'test',
    surfaces: ['cli', 'ui'],
    requiresConfirmation: false,
    classification: 'read',
    aiFallback: false,
    tags: [],
    ...overrides,
  }
}

describe('CapabilityParityAuditor', () => {
  const auditor = new CapabilityParityAuditor()

  test('passes when no patterns and no capabilities', () => {
    const registry = new UnifiedCapabilityRegistry()
    const report = auditor.audit([], registry)
    expect(report.passed).toBe(true)
    expect(report.findings).toHaveLength(0)
  })

  test('flags pattern referencing missing capability', () => {
    const registry = new UnifiedCapabilityRegistry()
    const patterns = [
      makePattern({
        capabilityId: 'nonexistent:cap',
        intent: 'test.missing',
      }),
    ]
    const report = auditor.audit(patterns, registry)
    expect(report.passed).toBe(false)
    expect(report.findings.some((f) => f.category === 'missing_capability')).toBe(true)
  })

  test('passes when pattern references existing capability', () => {
    const registry = new UnifiedCapabilityRegistry()
    registry.register({
      id: 'cap:test:action',
      slug: 'test_action',
      name: 'Test Action',
      description: 'Test',
      category: 'test',
      surfaces: ['cli', 'ui'],
      inputSchema: {},
      outputSchema: {},
      handler: async () => ({}),
      cliCommand: { name: 'test action', aliases: [], examples: [] },
      ui: { component: 'action-button', position: 'sidebar', order: 1 },
      isAsync: true,
      requiresConfirmation: false,
      tags: [],
    })
    const patterns = [
      makePattern({
        capabilityId: 'test_action',
        intent: 'test.action',
      }),
    ]
    const report = auditor.audit(patterns, registry)
    // Should not have missing_capability errors
    expect(report.findings.filter((f) => f.category === 'missing_capability')).toHaveLength(0)
  })

  test('warns about missing classification', () => {
    const registry = new UnifiedCapabilityRegistry()
    const patterns = [
      makePattern({
        intent: 'test.noclass',
        classification: undefined as never,
      }),
    ]
    const report = auditor.audit(patterns, registry)
    expect(report.findings.some((f) => f.category === 'risk_missing')).toBe(true)
  })

  test('formatReport produces readable output', () => {
    const registry = new UnifiedCapabilityRegistry()
    const report = auditor.audit([], registry)
    const formatted = auditor.formatReport(report)
    expect(formatted).toContain('Capability Parity Report')
    expect(formatted).toContain('PASSED')
  })
})
