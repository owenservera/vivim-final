import { beforeEach, describe, expect, mock, test } from 'bun:test'
import {
  SemanticGroundingEngine,
  type SemanticSelector,
} from '../../../src/engines/semantic-grounding.js'

function makeTransport() {
  return {
    send: mock(() =>
      Promise.resolve({
        result: { root: { nodeId: 1, backendNodeId: 1, role: 'root', children: [] } },
      }),
    ),
  } as any
}

describe('SemanticGroundingEngine', () => {
  let transport: ReturnType<typeof makeTransport>
  let engine: SemanticGroundingEngine

  beforeEach(() => {
    transport = makeTransport()
    engine = new SemanticGroundingEngine(transport)
  })

  test('resolve returns null when transport returns no tree', async () => {
    transport.send.mockResolvedValue({ result: null })
    const sel: SemanticSelector = { type: 'aria', role: 'button' }
    const result = await engine.resolve('s1', sel)
    expect(result).toBeNull()
  })

  test('resolve css selector returns null when transport fails', async () => {
    transport.send.mockRejectedValue(new Error('no element'))
    const sel: SemanticSelector = { type: 'css', selector: '#missing' }
    const result = await engine.resolve('s1', sel)
    expect(result).toBeNull()
  })

  test('resolveAll returns empty array when tree is empty', async () => {
    transport.send.mockResolvedValue({
      result: { root: { nodeId: 1, backendNodeId: 1, role: 'root', children: [] } },
    })
    const sel: SemanticSelector = { type: 'aria', role: 'button' }
    const results = await engine.resolveAll('s1', sel)
    expect(results).toHaveLength(0)
  })

  test('resolveAll css returns empty on failure', async () => {
    transport.send.mockRejectedValue(new Error('fail'))
    const sel: SemanticSelector = { type: 'css', selector: '.x' }
    const results = await engine.resolveAll('s1', sel)
    expect(results).toHaveLength(0)
  })
})
