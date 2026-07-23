// tests/unit/engines/cdp-watchdog.test.ts
// Watchdog system for CDP session resilience.

import { describe, expect, it, mock } from 'bun:test'
import {
  CdpWatchdog,
  setupCrashWatchdog,
  setupDialogWatchdog,
  setupWatchdog,
} from '../../../src/engines/cdp-watchdog.js'
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

describe('CdpWatchdog', () => {
  it('emits events to registered handlers', async () => {
    const watchdog = new CdpWatchdog()
    const handler = mock(() => Promise.resolve())
    watchdog.on('dialog', handler)

    await watchdog.emit('dialog', { type: 'alert', sessionId: 's1' })

    expect(handler).toHaveBeenCalledTimes(1)
    expect(handler).toHaveBeenCalledWith('dialog', { type: 'alert', sessionId: 's1' })
  })

  it('emits to multiple handlers', async () => {
    const watchdog = new CdpWatchdog()
    const h1 = mock(() => Promise.resolve())
    const h2 = mock(() => Promise.resolve())
    watchdog.on('crash', h1)
    watchdog.on('crash', h2)

    await watchdog.emit('crash', { reason: 'oom' })

    expect(h1).toHaveBeenCalledTimes(1)
    expect(h2).toHaveBeenCalledTimes(1)
  })

  it('handler errors do not prevent other handlers from running', async () => {
    const watchdog = new CdpWatchdog()
    const h1 = mock(() => {
      throw new Error('handler error')
    })
    const h2 = mock(() => Promise.resolve())
    watchdog.on('timeout', h1)
    watchdog.on('timeout', h2)

    // Should not throw
    await watchdog.emit('timeout', {})

    expect(h1).toHaveBeenCalledTimes(1)
    expect(h2).toHaveBeenCalledTimes(1)
  })

  it('ignores events with no handlers', async () => {
    const watchdog = new CdpWatchdog()
    // Should not throw
    await watchdog.emit('navigate', { url: 'https://example.com' })
  })
})

describe('setupDialogWatchdog', () => {
  it('enables Page domain on transport', () => {
    const transport = mockTransport()
    const watchdog = new CdpWatchdog()
    setupDialogWatchdog(transport, 's1', watchdog)

    expect(transport.send).toHaveBeenCalledWith('s1', 'Page.enable')
  })
})

describe('setupCrashWatchdog', () => {
  it('re-navigates to last URL on crash', async () => {
    const transport = mockTransport()
    const watchdog = new CdpWatchdog()
    let lastUrl = 'https://chatgpt.com'
    setupCrashWatchdog(transport, 's1', watchdog, () => lastUrl)

    await watchdog.emit('crash', { reason: 'oom' })

    expect(transport.send).toHaveBeenCalledWith(
      's1',
      'Runtime.evaluate',
      expect.objectContaining({
        expression: expect.stringContaining('chatgpt.com'),
      }),
    )
  })

  it('does not navigate if lastUrl is empty', async () => {
    const transport = mockTransport()
    const watchdog = new CdpWatchdog()
    setupCrashWatchdog(transport, 's1', watchdog, () => '')

    await watchdog.emit('crash', { reason: 'oom' })

    // Should not call Runtime.evaluate for navigation
    const evalCalls = (transport.send as ReturnType<typeof mock>).mock.calls.filter(
      (c) => c[1] === 'Runtime.evaluate',
    )
    expect(evalCalls.length).toBe(0)
  })
})

describe('setupWatchdog', () => {
  it('creates and returns a configured watchdog', () => {
    const transport = mockTransport()
    const watchdog = setupWatchdog(transport, 's1', () => 'https://example.com')

    expect(watchdog).toBeInstanceOf(CdpWatchdog)
  })

  it('sets up both dialog and crash handlers', async () => {
    const transport = mockTransport()
    const watchdog = setupWatchdog(transport, 's1', () => 'https://example.com')

    // Dialog handler should call Page.enable
    await watchdog.emit('dialog', { type: 'alert', sessionId: 's1' })
    expect(transport.send).toHaveBeenCalledWith('s1', 'Page.enable')

    // Crash handler should navigate
    await watchdog.emit('crash', { reason: 'oom' })
    expect(transport.send).toHaveBeenCalledWith(
      's1',
      'Runtime.evaluate',
      expect.objectContaining({
        expression: expect.stringContaining('example.com'),
      }),
    )
  })
})
