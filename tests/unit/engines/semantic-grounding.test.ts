import { beforeEach, describe, expect, mock, test } from 'bun:test'
import { SemanticGroundingEngine } from '../../../src/engines/browser-automation/semantic-grounding.js'

const BOX = { x: 1, y: 2, width: 10, height: 4 }

function makeGov() {
  return {
    enableDomains: mock(() => Promise.resolve()),
    evaluate: mock((_slaveId: string, expr: string) =>
      Promise.resolve(expr.includes('missing') ? null : BOX),
    ),
    cdp: {
      send: mock((_slaveId: string, method: string, params: any) => {
        if (method === 'DOM.getBoxModel' && params?.nodeId) {
          return Promise.resolve({ model: { content: BOX } })
        }
        if (method === 'DOM.getDocument') {
          return Promise.resolve({ root: { nodeId: 7, backendNodeId: 1, nodeType: 1 } })
        }
        if (method === 'DOM.querySelector') {
          return Promise.resolve({ nodeId: 42 })
        }
        if (method === 'Accessibility.getFullAXTree') {
          return Promise.resolve({
            nodes: {
              root: { role: { value: 'root' }, childIds: ['a'] },
              a: { role: { value: 'button' }, name: { value: 'OK' }, childIds: [] },
            },
          })
        }
        return Promise.resolve({})
      }),
    },
  } as any
}

describe('SemanticGroundingEngine', () => {
  let gov: ReturnType<typeof makeGov>
  let eng: SemanticGroundingEngine

  beforeEach(() => {
    gov = makeGov()
    eng = new SemanticGroundingEngine(gov)
  })

  test('resolveBySelector returns box when present', async () => {
    const r = await eng.resolveBySelector('s1', '#ok')
    expect(r.selector).toBe('#ok')
    expect(r.mode).toBe('css')
    expect(r.box!.w).toBe(10)
  })

  test('resolveBySelector throws when node absent', async () => {
    gov.evaluate = mock(() => Promise.resolve(null))
    await expect(eng.resolveBySelector('s1', '#missing')).rejects.toThrow()
  })

  test('getAccessibilityTree rebuilds a tree', async () => {
    const tree = await eng.getAccessibilityTree('s1')
    expect(tree.role).toBe('root')
    expect(tree.children?.[0]?.name).toBe('OK')
  })

  test('composite selector falls through to a working candidate', async () => {
    const r = await eng.resolve('s1', {
      css: '#ok',
    })
    expect(r.selector).toBe('#ok')
  })
})
