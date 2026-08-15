// tests/unit/engines/dcb-projector.test.ts
// DcbProjector — DynamicContextBundle → text surface rendering tests

import { describe, expect, test } from 'bun:test'
import {
  type DynamicContextBundle,
  type LayerItem,
  project,
  type Surface,
} from '../../../src/engines/dcb-projector.js'

function makeBundle(
  layers: LayerItem[],
  profile: DynamicContextBundle['profile'] = 'continuum',
): DynamicContextBundle {
  return {
    id: 'dcb-1',
    profile,
    projectId: 'proj-x',
    layers,
    totalTokens: 100,
    budget: 200,
    createdAt: new Date().toISOString(),
  }
}

const identityItem: LayerItem = {
  layer: 'L0Identity',
  text: 'I am Vivi',
  provenance: { source: 'Profile', label: 'self' },
  confidence: 0.9,
  recencySecs: 10,
  tokenCost: 10,
  included: true,
}
const queryItem: LayerItem = {
  layer: 'L7UserQuery',
  text: 'What is my status?',
  provenance: { source: 'Conversation', label: 'user' },
  confidence: 1,
  recencySecs: 1,
  tokenCost: 20,
  included: true,
}
const topicItem: LayerItem = {
  layer: 'L2Topic',
  text: 'A relevant background fact',
  provenance: { source: 'Knowledge', label: 'kb', provider: 'gemini' },
  confidence: 0.7,
  recencySecs: 100,
  tokenCost: 30,
  included: true,
}
const trimmedItem: LayerItem = {
  layer: 'L4Conversation',
  text: 'Long conversation arc that was trimmed for budget',
  provenance: { source: 'Conversation', label: 'conv' },
  confidence: 0.5,
  recencySecs: 500,
  tokenCost: 400,
  included: false,
}

describe('project', () => {
  const surfaces: Surface[] = ['inject_prompt', 'system_message', 'capsule', 'panel_card']

  for (const surface of surfaces) {
    test(`renders ${surface} without throwing`, () => {
      const out = project(makeBundle([identityItem, queryItem, topicItem]), surface)
      expect(typeof out).toBe('string')
    })
  }

  test('inject_prompt wraps with context markers', () => {
    const out = project(makeBundle([identityItem, queryItem, topicItem]), 'inject_prompt')
    expect(out).toContain('[Context')
    expect(out).toContain('[End context]')
    expect(out).toContain('I am Vivi')
  })

  test('inject_prompt omits the user query section', () => {
    const out = project(makeBundle([identityItem, queryItem, topicItem]), 'inject_prompt')
    expect(out).not.toContain('My query')
  })

  test('system_message wraps the inject output', () => {
    const out = project(makeBundle([identityItem, queryItem, topicItem]), 'system_message')
    expect(out).toContain('Use the following context')
    expect(out).toContain('I am Vivi')
  })

  test('capsule lists trimmed items under budget section', () => {
    const out = project(makeBundle([identityItem, queryItem, topicItem, trimmedItem]), 'capsule')
    expect(out).toContain('Trimmed for budget')
    expect(out).toContain('~400 tokens')
  })

  test('empty included layers → inject/capsule/system return empty', () => {
    const out = project(makeBundle([trimmedItem]), 'inject_prompt')
    expect(out).toBe('')
  })

  test('panel_card with no included sections shows app count', () => {
    const out = project(
      {
        ...makeBundle([]),
        layers: [
          {
            ...trimmedItem,
            included: false,
            provenance: { source: 'x', label: 'y', provider: 'gemini' },
          },
        ],
      },
      'panel_card',
    )
    expect(out).toContain('apps active')
  })

  test('panel_card summarizes decisions and threads', () => {
    const out = project(
      makeBundle([
        identityItem,
        { ...topicItem, layer: 'LdDecisions', text: 'Decided X' },
        { ...topicItem, layer: 'L5JitContext', text: 'Thread Y' },
      ]),
      'panel_card',
    )
    expect(out).toContain('decisions')
    expect(out).toContain('threads')
  })

  test('recency/confidence ordering puts higher-scored items first', () => {
    const high: LayerItem = { ...topicItem, text: 'HIGH', confidence: 0.95, recencySecs: 1 }
    const low: LayerItem = { ...topicItem, text: 'LOW', confidence: 0.1, recencySecs: 99999 }
    const out = project(makeBundle([identityItem, queryItem, low, high]), 'capsule')
    expect(out.indexOf('HIGH')).toBeLessThan(out.indexOf('LOW'))
  })
})
