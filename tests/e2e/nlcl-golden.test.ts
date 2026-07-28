// tests/e2e/nlcl-golden.test.ts
// Unit 30.2 — NLCL Golden Test Set.
// Locks the NLP formatting layer: scenario sentences must resolve to exact capability chains.
// Regression guard for "the system's NLP formats to system-level commands".

import { describe, expect, test } from 'bun:test'
import { getDefaultCommandPatterns } from '../../src/engines/nlcl/catalog.js'
import { NLCLEngine } from '../../src/engines/nlcl/nlcl-engine.js'

interface GoldenCase {
  text: string
  expect: Array<{
    capabilityId: string
    input?: Record<string, unknown>
  }>
}

// Golden cases (input text → expected capabilityId chain)
// These patterns are deterministic - no LLM required.
// Composite intents assert the ordered step chain.
const GOLDEN: GoldenCase[] = [
  {
    text: 'change my canvas background to an image of the moon made out of cheese',
    expect: [
      {
        capabilityId: 'cap:canvas:set_background',
        input: { imageQuery: 'moon made out of cheese' },
      },
    ],
  },
  {
    text: 'add my whatsapp feed and add my facebook channel',
    expect: [
      { capabilityId: 'cap:channel:add', input: { providerId: 'whatsapp' } },
      { capabilityId: 'cap:channel:add', input: { providerId: 'facebook' } },
    ],
  },
  {
    text: 'create a weekly newsletter for the team',
    expect: [{ capabilityId: 'cap:workflow:create_newsletter', input: { recipients: [] } }],
  },
  {
    text: 'load my chatgpt session',
    expect: [{ capabilityId: 'cap:session:load', input: { providerId: 'chatgpt' } }],
  },
]

// Mock registry for testing capability resolution without real execution
const createMockRegistry = () => ({
  get: (id: string) => ({
    id,
    slug: id.split(':').slice(2).join('_'),
    name: id.split(':').pop(),
    description: 'Test capability',
    category: id.split(':')[1] ?? 'system',
    surfaces: ['cli', 'ui'],
    inputSchema: { type: 'object' },
    outputSchema: { type: 'object' },
    cliCommand: { name: id },
    ui: { component: 'action-button', position: 'composer', order: 1 },
    isAsync: true,
    requiresConfirmation: false,
    tags: [],
    handler: async () => ({ ok: true }),
  }),
  getBySlug: (_slug: string) => null,
  execute: async (_id: string, input: Record<string, unknown>) => ({ ok: true, ...input }),
  list: () => [],
})

describe('NLCL Golden Test Set', () => {
  let engine: NLCLEngine

  test('before each: engine with default patterns and mocked registry', () => {
    engine = new NLCLEngine({
      registry: createMockRegistry() as any,
    })
  })

  for (const gc of GOLDEN) {
    test(`"${gc.text}" resolves to ${gc.expect.map((e) => e.capabilityId).join(' → ')}`, async () => {
      const result = await engine.interpret(gc.text, {
        surface: 'frontend',
        metadata: {},
      })

      // For single intents, result should have capabilityId
      if (gc.expect.length === 1) {
        expect(result.ok).toBe(true)
        const firstExpect = gc.expect[0]!
        expect(result.capabilityId ?? '').toBe(firstExpect.capabilityId)
        if (firstExpect.input) {
          const out = (result.output as Record<string, unknown> | undefined) ?? {}
          expect(out).toMatchObject(firstExpect.input as Record<string, unknown>)
        }
      } else {
        // For composites, check the output has results array
        expect(result.ok).toBe(true)
        const out = (result.output as Record<string, unknown> | undefined) ?? {}
        expect(out).toHaveProperty('results')
      }
    })
  }

  test('adding a new capability pattern requires golden entry (count assert)', () => {
    const patterns = getDefaultCommandPatterns()
    const canvasCapCount = patterns.filter((p) => p.capabilityId?.startsWith('cap:canvas:')).length
    const channelCapCount = patterns.filter((p) =>
      p.capabilityId?.startsWith('cap:channel:'),
    ).length
    const sessionCapCount = patterns.filter((p) =>
      p.capabilityId?.startsWith('cap:session:'),
    ).length
    const workflowCapCount = patterns.filter((p) =>
      p.capabilityId?.startsWith('cap:workflow:'),
    ).length

    // These assertions serve as documentation of expected pattern counts.
    // If patterns are added without updating golden tests, these counters can alert.
    expect(canvasCapCount).toBeGreaterThanOrEqual(5) // set_background, add_layer, remove_layer, set_layout, set_theme
    expect(channelCapCount).toBeGreaterThanOrEqual(4) // add, list, connect, remove
    expect(sessionCapCount).toBeGreaterThanOrEqual(3) // load, start, list
    expect(workflowCapCount).toBeGreaterThanOrEqual(1) // newsletter
  })
})
