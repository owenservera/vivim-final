// tests/unit/engines/policy-engine.test.ts
// P0PolicyEngine — deterministic risk/confirmation policy tests

import { describe, expect, test } from 'bun:test'
import { P0PolicyEngine } from '../../../src/engines/policy-engine.js'

type PlanNode = { risk: 'read' | 'reversible_write' | 'external_communication' | 'destructive' | 'security_sensitive'; requiresConfirmation?: boolean }
function plan(nodes: PlanNode[]): any {
  return { version: 1, goal: 'g', nodes, metadata: {} }
}

describe('P0PolicyEngine.evaluate', () => {
  test('allows read-only plan by default', () => {
    const engine = new P0PolicyEngine()
    const d = engine.evaluate(plan([{ risk: 'read' }, { risk: 'reversible_write' }]))
    expect(d.allowed).toBe(true)
  })

  test('blocks destructive action by default', () => {
    const engine = new P0PolicyEngine()
    const d = engine.evaluate(plan([{ risk: 'destructive' }]))
    expect(d.allowed).toBe(false)
    expect((d as { reason?: string }).reason).toMatch(/destructive/i)
  })

  test('blocks external_communication by default', () => {
    const engine = new P0PolicyEngine()
    const d = engine.evaluate(plan([{ risk: 'external_communication' }]))
    expect(d.allowed).toBe(false)
  })

  test('allows destructive when explicitly enabled', () => {
    const engine = new P0PolicyEngine({ allowDestructive: true })
    const d = engine.evaluate(plan([{ risk: 'destructive' }]))
    expect(d.allowed).toBe(true)
  })

  test('allows communication when explicitly enabled', () => {
    const engine = new P0PolicyEngine({ allowCommunication: true })
    const d = engine.evaluate(plan([{ risk: 'external_communication' }]))
    expect(d.allowed).toBe(true)
  })

  test('blocks when risk tier exceeds maxRiskTier', () => {
    const engine = new P0PolicyEngine({ maxRiskTier: 1 })
    const d = engine.evaluate(plan([{ risk: 'security_sensitive' }]))
    expect(d.allowed).toBe(false)
    expect((d as { reason?: string }).reason).toMatch(/exceeds maximum/i)
  })

  test('requires confirmation for risk tier >= 2', () => {
    const engine = new P0PolicyEngine({ allowCommunication: true })
    const d = engine.evaluate(plan([{ risk: 'external_communication' }]))
    expect(d.allowed).toBe(true)
    expect(d.requiresConfirmation).toBe(true)
  })

  test('requires confirmation when node flags it', () => {
    const engine = new P0PolicyEngine()
    const d = engine.evaluate(plan([{ risk: 'read', requiresConfirmation: true }]))
    expect(d.allowed).toBe(true)
    expect(d.requiresConfirmation).toBe(true)
  })

  test('first blocking node short-circuits the decision', () => {
    const engine = new P0PolicyEngine()
    const d = engine.evaluate(plan([{ risk: 'read' }, { risk: 'destructive' }, { risk: 'external_communication' }]))
    expect(d.allowed).toBe(false)
    expect((d as { reason?: string }).reason).toMatch(/destructive/i)
  })
})
