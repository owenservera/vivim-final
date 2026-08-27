// tests/unit/engines/provider-selectors.test.ts
// Unit 3.2 — Provider-specific selector fallback lists + helpers.

import { describe, expect, it } from 'bun:test'
import {
  COMPOSER_SELECTORS,
  findComposerHeuristic,
  findWorkingSelector,
  PROVIDER_URL_PATTERNS,
  PROVIDER_URLS,
  SEND_BUTTON_SELECTORS,
  waitForSelector,
} from '../../../src/engines/provider-selectors.js'

const PROVIDERS = ['chatgpt', 'claude', 'gemini'] as const

describe('provider-selectors (Unit 3.2)', () => {
  it('exposes non-empty fallback selector lists per provider', () => {
    for (const p of PROVIDERS) {
      expect(COMPOSER_SELECTORS[p]?.length).toBeGreaterThan(0)
      expect(SEND_BUTTON_SELECTORS[p]?.length).toBeGreaterThan(0)
      expect(typeof PROVIDER_URLS[p]).toBe('string')
    }
  })

  it('matches provider URL patterns', () => {
    expect(PROVIDER_URL_PATTERNS.chatgpt?.test('https://chatgpt.com/c/abc')).toBe(true)
    expect(PROVIDER_URL_PATTERNS.claude?.test('https://claude.ai/chat')).toBe(true)
    expect(PROVIDER_URL_PATTERNS.gemini?.test('https://gemini.google.com/app')).toBe(true)
    expect(PROVIDER_URL_PATTERNS.chatgpt?.test('https://claude.ai')).toBe(false)
  })

  it('findWorkingSelector returns the first matching selector', async () => {
    const cdpSend = async (_method: string, params: Record<string, unknown>) => {
      const sel = JSON.parse(String(params.expression).match(/querySelector\((.+)\)/)?.[1] ?? '')
      return { result: { value: sel === '#prompt-textarea' } }
    }
    const found = await findWorkingSelector(cdpSend as any, [
      '#nope',
      '#prompt-textarea',
      'textarea',
    ])
    expect(found).toBe('#prompt-textarea')
  })

  it('findWorkingSelector returns null when none match', async () => {
    const cdpSend = async () => ({ result: { value: false } })
    expect(await findWorkingSelector(cdpSend, ['#a', '#b'])).toBeNull()
  })

  it('waitForSelector polls until a selector appears', async () => {
    let calls = 0
    const cdpSend = async () => {
      calls++
      return { result: { value: calls >= 2 } }
    }
    const found = await waitForSelector(cdpSend, ['#x'], 1000)
    expect(found).toBe('#x')
  })

  it('findComposerHeuristic returns the detected element', async () => {
    const cdpSend = async () => ({ result: { value: 'textarea' } })
    expect(await findComposerHeuristic(cdpSend)).toBe('textarea')
  })
})
