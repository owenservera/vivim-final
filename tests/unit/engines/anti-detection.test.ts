// tests/unit/engines/anti-detection.test.ts
// Anti-detection script injection for provider pages.

import { describe, expect, it, mock } from 'bun:test'
import { injectAntiDetection } from '../../../src/engines/anti-detection.js'
import type { CDPTransport } from '../../../src/engines/chrome-governor.js'

function mockTransport(): CDPTransport {
  return {
    send: mock(() => Promise.resolve({})),
    connect: mock(() => Promise.resolve()),
    isConnected: mock(() => true),
    capture: mock(() => Promise.resolve({ body: '', chunks: [] })),
    captureScreenshot: mock(() => Promise.resolve('')),
    getPageState: mock(() => Promise.resolve({ url: '', title: '', readyState: 'complete' })),
  } as unknown as CDPTransport
}

describe('anti-detection', () => {
  it('injects default scripts for unknown providers', async () => {
    const transport = mockTransport()
    await injectAntiDetection(transport, 'slave-1', 'unknown')

    const calls = (transport.send as ReturnType<typeof mock>).mock.calls
    // 7 default scripts (webdriver, automation artifacts, chrome.runtime, plugins, languages, permissions, CDP vars)
    expect(calls.length).toBe(7)
    for (const call of calls) {
      expect(call[1]).toBe('Page.addScriptToEvaluateOnNewDocument')
      expect(call[2]).toHaveProperty('source')
    }
  })

  it('injects default + provider-specific scripts for chatgpt', async () => {
    const transport = mockTransport()
    await injectAntiDetection(transport, 'slave-1', 'chatgpt')

    const calls = (transport.send as ReturnType<typeof mock>).mock.calls
    // 7 default + 0 chatgpt-specific (plugins/languages moved to _default)
    expect(calls.length).toBe(7)
  })

  it('injects only default scripts for gemini (no extra)', async () => {
    const transport = mockTransport()
    await injectAntiDetection(transport, 'slave-1', 'gemini')

    const calls = (transport.send as ReturnType<typeof mock>).mock.calls
    expect(calls.length).toBe(7) // only defaults
  })

  it('scripts hide webdriver flag', async () => {
    const transport = mockTransport()
    await injectAntiDetection(transport, 's1', 'chatgpt')

    const calls = (transport.send as ReturnType<typeof mock>).mock.calls
    const sources = calls.map((c) => (c[2] as { source: string }).source)
    expect(sources.some((s) => s.includes('webdriver'))).toBe(true)
  })

  it('scripts remove automation artifacts', async () => {
    const transport = mockTransport()
    await injectAntiDetection(transport, 's1', 'chatgpt')

    const calls = (transport.send as ReturnType<typeof mock>).mock.calls
    const sources = calls.map((c) => (c[2] as { source: string }).source)
    expect(sources.some((s) => s.includes('__playwright'))).toBe(true)
    expect(sources.some((s) => s.includes('__puppeteer'))).toBe(true)
    expect(sources.some((s) => s.includes('__selenium'))).toBe(true)
  })
})
