// Regression tests for the 2026-08-08 browser-automation fix plan (F1–F6):
// F1 no-silent-default target, F2 composite grounding, F3 iframe-aware
// resolution, F4 AX-tree root selection, F6 no data-vivim-text mutation.

import { beforeEach, describe, expect, mock, test } from 'bun:test'
import {
  BrowserCapabilityRegistry,
  parseSelector,
} from '../../../src/engines/browser-automation/registry.js'
import { SemanticGroundingEngine } from '../../../src/engines/browser-automation/semantic-grounding.js'
import type { ResolvedElement } from '../../../src/engines/browser-automation/types.js'

function makeGov() {
  const calls: string[] = []
  const gov = {
    calls,
    enableDomains: mock(() => Promise.resolve()),
    evaluate: mock((_slaveId: string, expr: string) => {
      calls.push(expr)
      return Promise.resolve(null)
    }),
    cdp: {
      send: mock(() => Promise.resolve({})),
    },
  } as any
  return gov
}

/** Governor that simulates: main-frame miss, one same-origin iframe hit. */
function frameGov() {
  const calls: string[] = []
  const gov = {
    calls,
    enableDomains: mock(() => Promise.resolve()),
    evaluate: mock((_s: string, expr: string) => {
      calls.push(expr)
      if (expr.includes("querySelectorAll('iframe').length")) return Promise.resolve(1)
      if (expr.includes('getBoundingClientRect')) {
        if (expr.includes('contentDocument')) return Promise.resolve({ x: 5, y: 6, w: 30, h: 8 })
        return Promise.resolve(null)
      }
      if (expr.includes('querySelector("#in-frame")')) return Promise.resolve(true)
      return Promise.resolve(null)
    }),
    cdp: {
      send: mock(() => Promise.resolve({})),
    },
  } as any
  return gov
}

describe('F1 — no silent default target', () => {
  let _reg: BrowserCapabilityRegistry

  beforeEach(() => {
    const gov = makeGov()
    const grounding = {
      resolve: mock((_s: string, _sel: any) => Promise.resolve({} as ResolvedElement)),
    } as any
    _reg = new BrowserCapabilityRegistry(gov, grounding)
  })

  test('click without any target params resolves nothing and throws (no silent button)', async () => {
    const gov = makeGov()
    const grounding = {
      resolve: mock((_s: string, _sel: any) => Promise.resolve({} as ResolvedElement)),
    } as any
    const reg = new BrowserCapabilityRegistry(gov, grounding)
    await expect(reg.invoke('auto:input:click', {}, { slaveId: 's1' })).rejects.toThrow()
    expect(gov.calls.length).toBe(0) // no DOM was touched — target missing before any dispatch
  })

  test('click with only a text param auto-resolves via grounding (semantic path)', async () => {
    const gov = makeGov()
    gov.evaluate = mock((_s: string, expr: string) =>
      expr.includes('querySelector("#accept-btn")') ? Promise.resolve(true) : Promise.resolve(null),
    )
    const grounding = {
      resolve: mock((_s: string, _sel: any) =>
        Promise.resolve({
          selector: '#accept-btn',
          mode: 'text',
          box: { x: 1, y: 2, w: 10, h: 4 },
        }),
      ),
    } as any
    const reg2 = new BrowserCapabilityRegistry(gov, grounding)
    const r = await reg2.invoke(
      'auto:input:click',
      { text: 'Aceptar todas las cookies' },
      { slaveId: 's1' },
    )
    expect(r.ok).toBe(true)
    expect(r.detail).toContain('#accept-btn')
  })
})

describe('F2 — composite grounding from multiple params', () => {
  test('single param stays single-mode (backward compatible)', () => {
    expect(parseSelector({ text: 'Go' })).toEqual({ text: 'Go' })
    expect(parseSelector({ selector: '#x' })).toEqual({ css: '#x' })
  })

  test('multiple params build a composite list', () => {
    const sel = parseSelector({ selector: '#x', text: 'Go' })
    expect(sel).toEqual({ composite: [{ text: 'Go' }, { css: '#x' }] })
  })

  test('no target params -> null', () => {
    expect(parseSelector({})).toBeNull()
  })

  test('groundingExclude drops value params (type: text is the value, not target)', () => {
    const exclude = new Set(['text'])
    const sel = parseSelector({ selector: '#field', text: 'hello' }, exclude)
    expect(sel).toEqual({ css: '#field' })
  })
})

describe('F3 — iframe-aware resolution', () => {
  test('resolveBySelector falls back into same-origin iframe and reports frameIndex', async () => {
    const gov = frameGov()
    const eng = new SemanticGroundingEngine(gov)
    const r = await eng.resolveBySelector('s1', '#in-frame')
    expect(r.selector).toBe('#in-frame')
    expect(r.frameIndex).toBe(0)
    expect(r.box?.w).toBe(30)
  })

  test('registry propagates frameIndex into __frame', async () => {
    const gov = frameGov()
    const grounding = new SemanticGroundingEngine(gov)
    const reg = new BrowserCapabilityRegistry(gov, grounding)
    const r = await reg.invoke('auto:input:click', { selector: '#in-frame' }, { slaveId: 's1' })
    expect(r.ok).toBe(true)
    const evalCalls = gov.calls
    const frameExpr = evalCalls.find(
      (e: string) => e.includes('contentDocument') && e.includes('.click()'),
    )
    expect(frameExpr).toBeDefined()
    expect(frameExpr).toContain("querySelectorAll('iframe')[0]")
  })
})

describe('F4 — accessibility tree root selection', () => {
  test('root picks RootWebArea over first node', async () => {
    const gov = makeGov()
    gov.cdp.send = mock((_s: string, method: string) => {
      if (method === 'Accessibility.getFullAXTree') {
        return Promise.resolve({
          nodes: {
            // deliberately out-of-order: a button first, root doc second
            b: { role: { value: 'button' }, name: { value: 'OK' }, childIds: [] },
            doc: { role: { value: 'RootWebArea' }, childIds: ['b'] },
          },
        })
      }
      return Promise.resolve({})
    })
    const eng = new SemanticGroundingEngine(gov)
    const tree = await eng.getAccessibilityTree('s1')
    expect(tree.role).toBe('RootWebArea')
    expect(tree.children?.[0]?.role).toBe('button')
  })

  test('ignored containers with children are retained', async () => {
    const gov = makeGov()
    gov.cdp.send = mock((_s: string, method: string) => {
      if (method === 'Accessibility.getFullAXTree') {
        return Promise.resolve({
          nodes: {
            root: { role: { value: 'root' }, childIds: ['w'] },
            w: { role: { value: 'generic' }, ignored: true, childIds: ['b'] },
            b: { role: { value: 'button' }, name: { value: 'OK' }, childIds: [] },
          },
        })
      }
      return Promise.resolve({})
    })
    const eng = new SemanticGroundingEngine(gov)
    const tree = await eng.getAccessibilityTree('s1')
    expect(tree.role).toBe('root')
    const kids = tree.children ?? []
    expect(kids.length).toBe(1)
    expect(kids[0]?.children?.[0]?.role).toBe('button')
  })
})

describe('F6 — resolveByText produces no DOM mutation', () => {
  test('no data-vivim-text attribute is ever set', async () => {
    const gov = makeGov()
    gov.evaluate = mock((_s: string, expr: string) => {
      if (expr.includes('setAttribute')) throw new Error('DOM mutation detected')
      // text search in main frame returns a css path
      if (expr.includes('textContent') && expr.includes('path.join')) {
        return Promise.resolve('button#accept')
      }
      if (expr.includes('getBoundingClientRect')) {
        return Promise.resolve({ x: 1, y: 2, w: 10, h: 4 })
      }
      return Promise.resolve(null)
    })
    const eng = new SemanticGroundingEngine(gov)
    const r = await eng.resolve('s1', { text: 'Aceptar todas las cookies' })
    expect(r.selector).toBe('button#accept')
    expect(r.mode).toBe('text')
  })
})
