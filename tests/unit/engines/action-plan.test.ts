// tests/unit/engines/action-plan.test.ts
// Phase 0 — Tests for the canonical ActionPlan contract.

import { describe, expect, test } from 'bun:test'
import { z } from 'zod'
import {
  validateActionPlan,
  topologicalOrder,
  requiresConfirmation,
  maxRiskTier,
  ActionPlanSchema,
  CapabilityRiskSchema,
  RISK_TIER,
  type CapabilityDefinition,
} from '../../../src/engines/action-plan.js'
import { ActionPlanCompiler } from '../../../src/engines/action-plan-compiler.js'

// ── Test Fixtures ────────────────────────────────────────────────────────

const capabilities = new Map<string, CapabilityDefinition>([
  [
    'browser.click',
    {
      slug: 'browser.click',
      description: 'Click a grounded browser element',
      risk: 'reversible_write',
      inputSchema: z.object({ ref: z.string().regex(/^E\d+$/) }),
    },
  ],
  [
    'browser.navigate',
    {
      slug: 'browser.navigate',
      description: 'Navigate to a URL',
      risk: 'read',
      inputSchema: z.object({ url: z.string().url() }),
    },
  ],
  [
    'file.delete',
    {
      slug: 'file.delete',
      description: 'Delete a file',
      risk: 'destructive',
      inputSchema: z.object({ path: z.string().min(1) }),
      requiresConfirmation: true,
    },
  ],
  [
    'email.send',
    {
      slug: 'email.send',
      description: 'Send an email',
      risk: 'external_communication',
      inputSchema: z.object({
        to: z.string().min(1),
        subject: z.string().min(1),
        body: z.string().min(1),
      }),
      requiresConfirmation: true,
    },
  ],
])

// ── ActionPlan Schema ────────────────────────────────────────────────────

describe('ActionPlanSchema', () => {
  test('parses a valid plan', () => {
    const plan = ActionPlanSchema.parse({
      version: 1,
      goal: 'click submit',
      nodes: [
        {
          id: 'n1',
          capability: 'browser.click',
          input: { ref: 'E1' },
          dependsOn: [],
          risk: 'reversible_write',
        },
      ],
    })
    expect(plan.version).toBe(1)
    expect(plan.nodes).toHaveLength(1)
  })

  test('rejects empty nodes', () => {
    expect(() =>
      ActionPlanSchema.parse({
        version: 1,
        goal: 'empty',
        nodes: [],
      }),
    ).toThrow()
  })

  test('rejects > 32 nodes', () => {
    const nodes = Array.from({ length: 33 }, (_, i) => ({
      id: `n${i}`,
      capability: 'browser.click',
      input: { ref: `E${i}` },
      dependsOn: [],
      risk: 'reversible_write',
    }))
    expect(() =>
      ActionPlanSchema.parse({ version: 1, goal: 'too many', nodes }),
    ).toThrow()
  })
})

// ── CapabilityRisk ───────────────────────────────────────────────────────

describe('CapabilityRisk', () => {
  test('risk tiers are ordered correctly', () => {
    expect(RISK_TIER.read).toBeLessThan(RISK_TIER.reversible_write)
    expect(RISK_TIER.reversible_write).toBeLessThan(RISK_TIER.external_communication)
    expect(RISK_TIER.external_communication).toBeLessThan(RISK_TIER.destructive)
    expect(RISK_TIER.destructive).toBeLessThan(RISK_TIER.security_sensitive)
  })

  test('all risk values parse', () => {
    for (const risk of ['read', 'reversible_write', 'external_communication', 'destructive', 'security_sensitive']) {
      expect(CapabilityRiskSchema.parse(risk)).toBe(risk)
    }
  })
})

// ── validateActionPlan ───────────────────────────────────────────────────

describe('validateActionPlan', () => {
  test('rejects unknown capability', () => {
    expect(() =>
      validateActionPlan(
        {
          version: 1,
          goal: 'x',
          nodes: [
            {
              id: 'n1',
              capability: 'does.not.exist',
              input: {},
              dependsOn: [],
              risk: 'read',
            },
          ],
        },
        capabilities,
      ),
    ).toThrow('Unknown capability')
  })

  test('rejects duplicate node ids', () => {
    expect(() =>
      validateActionPlan(
        {
          version: 1,
          goal: 'x',
          nodes: [
            {
              id: 'n1',
              capability: 'browser.click',
              input: { ref: 'E1' },
              dependsOn: [],
              risk: 'reversible_write',
            },
            {
              id: 'n1',
              capability: 'browser.click',
              input: { ref: 'E2' },
              dependsOn: [],
              risk: 'reversible_write',
            },
          ],
        },
        capabilities,
      ),
    ).toThrow('Duplicate')
  })

  test('rejects cycles', () => {
    expect(() =>
      validateActionPlan(
        {
          version: 1,
          goal: 'x',
          nodes: [
            {
              id: 'n1',
              capability: 'browser.click',
              input: { ref: 'E1' },
              dependsOn: ['n2'],
              risk: 'reversible_write',
            },
            {
              id: 'n2',
              capability: 'browser.click',
              input: { ref: 'E2' },
              dependsOn: ['n1'],
              risk: 'reversible_write',
            },
          ],
        },
        capabilities,
      ),
    ).toThrow('cycle')
  })

  test('rejects self-dependency', () => {
    expect(() =>
      validateActionPlan(
        {
          version: 1,
          goal: 'x',
          nodes: [
            {
              id: 'n1',
              capability: 'browser.click',
              input: { ref: 'E1' },
              dependsOn: ['n1'],
              risk: 'reversible_write',
            },
          ],
        },
        capabilities,
      ),
    ).toThrow('Self dependency')
  })

  test('rejects risk mismatch', () => {
    expect(() =>
      validateActionPlan(
        {
          version: 1,
          goal: 'x',
          nodes: [
            {
              id: 'n1',
              capability: 'browser.click',
              input: { ref: 'E1' },
              dependsOn: [],
              risk: 'destructive', // mismatch: capability says reversible_write
            },
          ],
        },
        capabilities,
      ),
    ).toThrow('Risk mismatch')
  })

  test('rejects missing confirmation for destructive capability', () => {
    expect(() =>
      validateActionPlan(
        {
          version: 1,
          goal: 'x',
          nodes: [
            {
              id: 'n1',
              capability: 'file.delete',
              input: { path: '/tmp/test' },
              dependsOn: [],
              risk: 'destructive',
              requiresConfirmation: false, // should be true
            },
          ],
        },
        capabilities,
      ),
    ).toThrow('Confirmation required')
  })

  test('rejects invalid input', () => {
    expect(() =>
      validateActionPlan(
        {
          version: 1,
          goal: 'x',
          nodes: [
            {
              id: 'n1',
              capability: 'browser.click',
              input: { ref: 'INVALID' }, // not E1, E2, etc.
              dependsOn: [],
              risk: 'reversible_write',
            },
          ],
        },
        capabilities,
      ),
    ).toThrow()
  })

  test('accepts a valid plan', () => {
    const plan = validateActionPlan(
      {
        version: 1,
        goal: 'click submit',
        nodes: [
          {
            id: 'n1',
            capability: 'browser.click',
            input: { ref: 'E1' },
            dependsOn: [],
            risk: 'reversible_write',
          },
        ],
      },
      capabilities,
    )
    expect(plan.nodes).toHaveLength(1)
    expect(plan.nodes[0].capability).toBe('browser.click')
  })

  test('accepts multi-step plan with valid dependencies', () => {
    const plan = validateActionPlan(
      {
        version: 1,
        goal: 'navigate then click',
        nodes: [
          {
            id: 'n1',
            capability: 'browser.navigate',
            input: { url: 'https://example.com' },
            dependsOn: [],
            risk: 'read',
          },
          {
            id: 'n2',
            capability: 'browser.click',
            input: { ref: 'E5' },
            dependsOn: ['n1'],
            risk: 'reversible_write',
          },
        ],
      },
      capabilities,
    )
    expect(plan.nodes).toHaveLength(2)
  })
})

// ── topologicalOrder ─────────────────────────────────────────────────────

describe('topologicalOrder', () => {
  test('returns nodes in dependency order', () => {
    const order = topologicalOrder([
      { id: 'n2', capability: 'x', input: {}, dependsOn: ['n1'], risk: 'read', requiresConfirmation: false, verify: { type: 'none' as const } },
      { id: 'n1', capability: 'x', input: {}, dependsOn: [], risk: 'read', requiresConfirmation: false, verify: { type: 'none' as const } },
    ])
    expect(order).toEqual(['n1', 'n2'])
  })

  test('handles independent nodes', () => {
    const order = topologicalOrder([
      { id: 'n1', capability: 'x', input: {}, dependsOn: [], risk: 'read', requiresConfirmation: false, verify: { type: 'none' as const } },
      { id: 'n2', capability: 'x', input: {}, dependsOn: [], risk: 'read', requiresConfirmation: false, verify: { type: 'none' as const } },
    ])
    expect(order).toContain('n1')
    expect(order).toContain('n2')
  })
})

// ── requiresConfirmation / maxRiskTier ───────────────────────────────────

describe('requiresConfirmation', () => {
  test('returns false when no nodes require confirmation', () => {
    const plan = ActionPlanSchema.parse({
      version: 1,
      goal: 'x',
      nodes: [
        { id: 'n1', capability: 'browser.navigate', input: { url: 'https://x.com' }, dependsOn: [], risk: 'read' },
      ],
    })
    expect(requiresConfirmation(plan)).toBe(false)
  })

  test('returns true when any node requires confirmation', () => {
    const plan = ActionPlanSchema.parse({
      version: 1,
      goal: 'x',
      nodes: [
        { id: 'n1', capability: 'browser.navigate', input: { url: 'https://x.com' }, dependsOn: [], risk: 'read' },
        { id: 'n2', capability: 'file.delete', input: { path: '/tmp' }, dependsOn: [], risk: 'destructive', requiresConfirmation: true },
      ],
    })
    expect(requiresConfirmation(plan)).toBe(true)
  })
})

describe('maxRiskTier', () => {
  test('returns highest risk tier', () => {
    const plan = ActionPlanSchema.parse({
      version: 1,
      goal: 'x',
      nodes: [
        { id: 'n1', capability: 'a', input: {}, dependsOn: [], risk: 'read' },
        { id: 'n2', capability: 'b', input: {}, dependsOn: [], risk: 'destructive' },
      ],
    })
    expect(maxRiskTier(plan)).toBe(RISK_TIER.destructive)
  })
})

// ── ActionPlanCompiler ───────────────────────────────────────────────────

describe('ActionPlanCompiler', () => {
  const compiler = new ActionPlanCompiler(capabilities)

  test('compiles candidates into a valid plan', () => {
    const plan = compiler.compile({
      goal: 'click submit',
      candidates: [
        { capability: 'browser.click', input: { ref: 'E1' } },
      ],
    })
    expect(plan.version).toBe(1)
    expect(plan.nodes).toHaveLength(1)
    expect(plan.nodes[0].id).toBe('n1')
  })

  test('rejects unknown capability', () => {
    expect(() =>
      compiler.compile({
        goal: 'x',
        candidates: [{ capability: 'nonexistent', input: {} }],
      }),
    ).toThrow('Unknown capability')
  })

  test('sets dependency edges correctly', () => {
    const plan = compiler.compile({
      goal: 'navigate then click',
      candidates: [
        { capability: 'browser.navigate', input: { url: 'https://x.com' } },
        { capability: 'browser.click', input: { ref: 'E1' }, dependsOn: ['n1'] },
      ],
    })
    expect(plan.nodes[0].dependsOn).toEqual([])
    expect(plan.nodes[1].dependsOn).toEqual(['n1'])
  })

  test('infers risk from capability definition', () => {
    const plan = compiler.compile({
      goal: 'click',
      candidates: [{ capability: 'browser.click', input: { ref: 'E1' } }],
    })
    expect(plan.nodes[0].risk).toBe('reversible_write')
  })
})

// ── intentToCandidates adapter ───────────────────────────────────────────

describe('ActionPlanCompiler.intentToCandidates', () => {
  const compiler = new ActionPlanCompiler(capabilities)

  test('converts a ParsedIntent to candidates', () => {
    const candidates = compiler.intentToCandidates({
      patternId: 'p1',
      intent: 'browser.click',
      input: { ref: 'E3' },
      confidence: 0.95,
      rawInput: 'click the button',
      matchedPattern: 'click the button',
      alternatives: [],
      resolvedAt: Date.now(),
      capabilityId: 'browser.click',
      classification: 'write',
    })
    expect(candidates).toHaveLength(1)
    expect(candidates[0].capability).toBe('browser.click')
    expect(candidates[0].input.ref).toBe('E3')
  })
})
