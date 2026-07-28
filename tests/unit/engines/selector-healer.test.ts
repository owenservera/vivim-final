import { beforeEach, describe, expect, mock, test } from 'bun:test'
import { SelectorHealer } from '../../../src/engines/browser-automation/selector-healer.js'
import type { SemanticSelector } from '../../../src/engines/browser-automation/types.js'

function makeGov() {
  return {
    enableDomains: mock(() => Promise.resolve()),
    evaluate: mock((_s: string, _expr: string) => Promise.resolve('https://example.com')),
  } as any
}

function selText(sel: SemanticSelector): string {
  return (sel as any).selector ?? sel.css ?? sel.text ?? sel.role ?? ''
}

function makeGrounding() {
  return {
    resolve: mock((_s: string, sel: SemanticSelector) => {
      const s = selText(sel)
      if (!s || s.includes('missing')) return Promise.reject(new Error('not found'))
      return Promise.resolve({
        selector: s,
        mode: (sel as any).mode ?? 'css',
        box: { x: 0, y: 0, width: 5, height: 5 },
      })
    }),
    resolveBySelector: mock((_s: string, selector: string) => {
      if (selector.includes('missing')) return Promise.reject(new Error('stale'))
      return Promise.resolve({ selector, mode: 'css', box: { x: 0, y: 0, width: 5, height: 5 } })
    }),
  } as any
}

function makeStore() {
  return {
    getStrategy: mock(() => Promise.resolve(null)),
    recordUse: mock(() => Promise.resolve()),
    saveStrategy: mock(() => Promise.resolve()),
    upsertStrategy: mock(() => Promise.resolve()),
    bumpHealCount: mock(() => Promise.resolve()),
  } as any
}

const original: SemanticSelector = {
  role: 'button',
  text: 'Submit',
  css: '#submit-missing',
}

describe('SelectorHealer', () => {
  let gov: ReturnType<typeof makeGov>
  let grounding: ReturnType<typeof makeGrounding>
  let store: ReturnType<typeof makeStore>
  let healer: SelectorHealer

  beforeEach(() => {
    gov = makeGov()
    grounding = makeGrounding()
    store = makeStore()
    healer = new SelectorHealer(gov, grounding, store)
  })

  test('uses persisted strategy when still valid', async () => {
    store.getStrategy = mock(() => Promise.resolve({ selectorFormat: '#submit-live' }))
    const r = await healer.heal('s1', original, 'submit-btn')
    expect(r.healed).toBe(true)
    expect(r.selector).toBe('#submit-live')
    expect(grounding.resolveBySelector).toHaveBeenCalledWith('s1', '#submit-live')
  })

  test('falls back to rule-based alternate when persisted stale', async () => {
    store.getStrategy = mock(() => Promise.resolve({ selectorFormat: '#submit-missing' }))
    const r = await healer.heal('s1', original, 'submit-btn')
    expect(r.healed).toBe(true)
    expect(grounding.resolve).toHaveBeenCalled()
  })

  test('falls back to LLM propose when rules exhausted', async () => {
    store.getStrategy = mock(() => Promise.resolve(null))
    grounding.resolve = mock(() => Promise.reject(new Error('no rule matched')))
    const llm = mock(() => Promise.resolve('#submit-llm'))
    const r = await healer.heal('s1', original, 'submit-btn', llm)
    expect(r.selector).toBe('#submit-llm')
    expect(llm).toHaveBeenCalled()
    expect(store.upsertStrategy).toHaveBeenCalled()
  })

  test('throws when everything fails', async () => {
    store.getStrategy = mock(() => Promise.resolve(null))
    grounding.resolve = mock(() => Promise.reject(new Error('no')))
    const llm = mock(() => Promise.resolve(null))
    await expect(healer.heal('s1', original, 'submit-btn', llm)).rejects.toThrow()
  })
})
