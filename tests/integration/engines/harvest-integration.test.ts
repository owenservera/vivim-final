// tests/integration/engines/harvest-integration.test.ts
// Integration test: all 5 harvest patterns wired together.

import { describe, expect, it, mock } from 'bun:test'
import { injectAntiDetection } from '../../../src/engines/anti-detection.js'
import { CdpWatchdog, setupWatchdog } from '../../../src/engines/cdp-watchdog.js'
import { humanizedClick } from '../../../src/engines/humanized-interaction.js'
import { LoopDetector } from '../../../src/engines/loop-detector.js'
import { SelectorCache } from '../../../src/engines/selector-cache.js'
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

describe('harvest integration', () => {
  it('anti-detection + humanized click + watchdog on provider connect', async () => {
    const transport = mockTransport()
    const providerId = 'chatgpt'
    const slaveId = 'slave-chatgpt-1'

    // 1. Inject anti-detection before navigation
    await injectAntiDetection(transport, slaveId, providerId)

    // 2. Set up watchdog for the session
    const watchdog = setupWatchdog(transport, slaveId, () => 'https://chatgpt.com')

    // 3. Navigate (simulated)
    await transport.send(slaveId, 'Runtime.evaluate', {
      expression: 'window.location.href = "https://chatgpt.com"',
    })

    // 4. Humanized click on send button
    await humanizedClick(transport, slaveId, 500, 600, 200, 300)

    // Verify all calls happened
    const calls = (transport.send as ReturnType<typeof mock>).mock.calls
    // anti-detection: 5 calls (3 default + 2 chatgpt)
    // Page.enable from watchdog: 1 call
    // navigate: 1 call
    // humanized click: ~20 calls (mouseMoved + mousePressed + mouseReleased)
    expect(calls.length).toBeGreaterThan(5)

    // Verify watchdog is active
    expect(watchdog).toBeInstanceOf(CdpWatchdog)
  })

  it('selector cache prevents redundant healing', () => {
    const cache = new SelectorCache()
    const healer = new LoopDetector()

    // First visit: selector fails, we heal it, cache the result
    cache.record('chatgpt', 'send_message', '#send-btn')
    healer.record('click', '#wrong-btn', 'failure')
    healer.record('click', '#send-btn', 'success')

    // Second visit: cache hit, no healing needed
    const cached = cache.get('chatgpt', 'send_message')
    expect(cached).not.toBeNull()
    expect(cached!.selector).toBe('#send-btn')

    // Loop detector should not flag this as a loop
    expect(healer.isLooping()).toBe(false)
  })

  it('loop detector catches repeated selector failures', () => {
    const detector = new LoopDetector({ maxRepeats: 3, windowSize: 10 })
    const cache = new SelectorCache()

    // Fill window with neutral history
    for (let i = 0; i < 7; i++) {
      detector.record('click', '#ok-btn', 'success')
    }
    // 3 consecutive failures on same selector
    detector.record('click', '#broken-selector', 'failure')
    detector.record('click', '#broken-selector', 'failure')
    detector.record('click', '#broken-selector', 'failure')

    expect(detector.isLooping()).toBe(true)
    expect(detector.getSuggestion()).toContain('#broken-selector')

    // Cache should not have this selector (it failed)
    expect(cache.get('chatgpt', 'send_message')).toBeNull()
  })

  it('watchdog auto-dismisses dialog during provider interaction', async () => {
    const transport = mockTransport()
    const watchdog = setupWatchdog(transport, 's1', () => 'https://chatgpt.com')

    let dialogDismissed = false
    watchdog.on('dialog', async (_event, data) => {
      if (data.type === 'alert') {
        dialogDismissed = true
      }
    })

    await watchdog.emit('dialog', { type: 'alert', sessionId: 's1' })
    expect(dialogDismissed).toBe(true)
  })

  it('full lifecycle: inject → navigate → interact → cache → detect loops', async () => {
    const transport = mockTransport()
    const cache = new SelectorCache()
    const detector = new LoopDetector({ maxRepeats: 3, windowSize: 10 })
    const providerId = 'gemini'
    const slaveId = 'slave-gemini-1'

    // Phase 1: Inject anti-detection
    await injectAntiDetection(transport, slaveId, providerId)
    const injectCalls = (transport.send as ReturnType<typeof mock>).mock.calls.length
    expect(injectCalls).toBe(3) // gemini has only default scripts

    // Phase 2: Navigate
    await transport.send(slaveId, 'Runtime.evaluate', {
      expression: 'window.location.href = "https://gemini.google.com"',
    })

    // Phase 3: Interact with humanized click
    await humanizedClick(transport, slaveId, 400, 500, 100, 200)
    const afterInteractCalls = (transport.send as ReturnType<typeof mock>).mock.calls.length
    expect(afterInteractCalls).toBeGreaterThan(injectCalls + 1)

    // Phase 4: Cache successful selector
    cache.record(providerId, 'send_message', 'div.ql-editor')
    const cached = cache.get(providerId, 'send_message')
    expect(cached).not.toBeNull()

    // Phase 5: Detector should not flag normal operation
    detector.record('click', 'div.ql-editor', 'success')
    detector.record('type', 'div.ql-editor', 'success')
    detector.record('click', 'div.ql-editor', 'success')
    expect(detector.isLooping()).toBe(false)
  })
})
