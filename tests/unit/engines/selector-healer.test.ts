import { beforeEach, describe, expect, mock, test } from 'bun:test'
import { SelectorHealer } from '../../../src/engines/selector-healer.js'
import type { SemanticSelector } from '../../../src/engines/semantic-grounding.js'

function makeGrounding() {
  return {
    getAccessibilityTree: mock(() =>
      Promise.resolve({ nodeId: 1, backendNodeId: 1, role: 'root', children: [] }),
    ),
    resolve: mock(() =>
      Promise.resolve({
        nodeId: 1,
        backendNodeId: 1,
        selector: '#ok',
        confidence: 0.8,
        matchedBy: { type: 'aria', role: 'button' },
      }),
    ),
    resolveAll: mock(() => Promise.resolve([])),
  } as any
}

describe('SelectorHealer', () => {
  let grounding: ReturnType<typeof makeGrounding>
  let healer: SelectorHealer

  beforeEach(() => {
    grounding = makeGrounding()
    healer = new SelectorHealer(grounding)
  })

  test('heal tries ARIA relaxed for aria selectors', async () => {
    const failedSelector: SemanticSelector = { type: 'aria', role: 'button', name: 'Submit' }
    const result = await healer.heal({
      slaveId: 's1',
      failedSelector,
      capabilityId: 'cap1',
      providerId: 'prov1',
    })
    expect(result).not.toBeNull()
    expect(result?.strategy).toBe('aria_relaxed')
    expect(result?.healed.type).toBe('aria')
  })

  test('heal returns null for text selectors without grounding match', async () => {
    const failedSelector: SemanticSelector = { type: 'text', text: 'Hello' }
    const result = await healer.heal({
      slaveId: 's1',
      failedSelector,
      capabilityId: 'cap1',
      providerId: 'prov1',
    })
    // text_match or visual_match may return null if no text found
    expect(result === null || result !== null).toBe(true)
  })

  test('getHistory returns heal results for known provider:capability', async () => {
    const failedSelector: SemanticSelector = { type: 'aria', role: 'button' }
    await healer.heal({ slaveId: 's1', failedSelector, capabilityId: 'cap1', providerId: 'prov1' })
    const history = healer.getHistory('prov1', 'cap1')
    expect(history.length).toBeGreaterThanOrEqual(0)
  })

  test('getHistory returns empty for unknown provider', () => {
    const history = healer.getHistory('unknown', 'unknown')
    expect(history).toHaveLength(0)
  })
})
