// tests/unit/engines/action-plan-bridge.test.ts
// Phase 2 — ActionPlanBridge unit tests.

import { describe, expect, it } from 'bun:test'
import { ActionPlanBridge } from '../../../src/engines/action-plan-bridge.js'
import type { NLCContext, ParsedIntent } from '../../../src/engines/nlcl/types.js'

const CTX: NLCContext = {
  conversationId: 'conv-bridge-test',
  surface: 'cli',
  metadata: { lastSubject: 'the report' },
}

function makeIntent(overrides: Partial<ParsedIntent>): ParsedIntent {
  return {
    patternId: 'test',
    intent: 'test_intent',
    input: { action: 'open', url: 'https://example.com' },
    confidence: 0.95,
    rawInput: 'open the report in the browser',
    matchedPattern: 'open url',
    alternatives: [],
    resolvedAt: Date.now(),
    capabilityId: 'cap:browser:open_url',
    classification: 'read' as any,
    ...overrides,
  }
}

describe('ActionPlanBridge', () => {
  const bridge = new ActionPlanBridge()

  it('should produce a plan for a valid intent', () => {
    const intent = makeIntent({})
    const result = bridge.intentToPlan(intent, CTX)

    expect(result.plan).not.toBeNull()
    expect(result.plan?.goal).toBe('open the report in the browser')
    expect(result.plan?.nodes.length).toBeGreaterThanOrEqual(1)
  })

  it('should ground entity references from the input', () => {
    const intent = makeIntent({ rawInput: 'open the report in the browser' })
    const result = bridge.intentToPlan(intent, CTX)

    expect(result.groundedRefs.length).toBeGreaterThan(0)
    // Should resolve "the report" from context
    const reportRef = result.groundedRefs.find((r) => r.raw.toLowerCase().includes('report'))
    expect(reportRef).toBeDefined()
    expect(reportRef?.resolvedValue).toBe('the report')
  })

  it('should return null plan for unresolved intent', () => {
    const intent = makeIntent({ intent: 'unresolved', patternId: 'unresolved' })
    const result = bridge.intentToPlan(intent, CTX)

    expect(result.plan).toBeNull()
    expect(result.groundedRefs).toBeArray()
  })

  it('should produce a multi-step plan for composite intents', () => {
    const intents = [
      makeIntent({ intent: 'navigate', rawInput: 'go to cnn.com' }),
      makeIntent({ intent: 'summarize', rawInput: 'summarize the news' }),
    ]
    const result = bridge.intentsToPlan(intents, CTX)

    expect(result.plan).not.toBeNull()
    expect(result.plan?.nodes.length).toBeGreaterThanOrEqual(2)
  })

  it('should resolve dependencies via the grounder', () => {
    const intent = makeIntent({})
    const refs = bridge.intentToPlan(intent, CTX).groundedRefs

    const resolved = bridge.resolveDependency('the report', CTX, refs)
    expect(resolved).not.toBeNull()
    expect(resolved?.resolvedValue).toBe('the report')
  })
})
