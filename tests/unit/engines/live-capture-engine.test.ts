// tests/unit/engines/live-capture-engine.test.ts
// LiveCaptureEngine — unit tests with mock CdpSender (no real Chrome needed).
import { describe, expect, it, mock } from 'bun:test'
import { LiveCaptureEngine } from '../../../src/engines/live-capture-engine.js'
import type { CdpSender } from '../../../src/engines/protocol-discovery.js'

function createMockCdpSender(overrides: Partial<CdpSender> = {}): CdpSender {
  return {
    send: mock(() => Promise.resolve({})),
    on: mock(() => {}),
    off: mock(() => {}),
    ...overrides,
  }
}

const PROBE_RESULT = JSON.stringify({
  tag: 'textarea',
  isContentEditable: false,
  isQuill: false,
  isProseMirror: false,
})

describe('LiveCaptureEngine', () => {
  it('registers Network.enable and event listeners', async () => {
    const sender = createMockCdpSender({
      send: mock(async (method: string) => {
        if (method === 'Runtime.evaluate') return { result: { value: PROBE_RESULT } }
        return {}
      }),
    })
    const engine = new LiveCaptureEngine(sender, 'test-session')
    const result = await engine.captureResponse({
      composerSelector: '#prompt-textarea',
      testMessage: 'Hello',
      captureTimeoutMs: 200,
    })
    // Network.enable is called
    expect(sender.send).toHaveBeenCalledWith('Network.enable', {}, { sessionId: 'test-session' })
    // Network listeners are registered
    expect(sender.on).toHaveBeenCalledWith('Network.requestWillBeSent', expect.any(Function))
    expect(sender.on).toHaveBeenCalledWith('Network.responseReceived', expect.any(Function))
    expect(sender.on).toHaveBeenCalledWith('Network.dataReceived', expect.any(Function))
    // Result shape
    expect(typeof result.rawBody).toBe('string')
    expect(typeof result.captureDurationMs).toBe('number')
    expect(typeof result.bytesCaptured).toBe('number')
    // ok depends on whether rawBody is non-empty — with mock data it's empty
    expect(result.ok).toBe(false) // No data received, so rawBody is ''
  })

  it('uses Runtime.evaluate for composer probing and typing', async () => {
    let sentMethods: string[] = []
    const sender = createMockCdpSender({
      send: mock(async (method: string) => {
        sentMethods.push(method)
        if (method === 'Runtime.evaluate') return { result: { value: PROBE_RESULT } }
        return {}
      }),
    })
    const engine = new LiveCaptureEngine(sender, 'test-session')
    await engine.captureResponse({
      composerSelector: '#prompt-textarea',
      testMessage: 'Hi',
      captureTimeoutMs: 200,
    })
    // Should have: probe + set value + press enter = 3 Runtime.evaluate calls
    const runtimeEvalCalls = sentMethods.filter(m => m === 'Runtime.evaluate')
    expect(runtimeEvalCalls.length).toBeGreaterThanOrEqual(3)
  })

  it('uses click when sendButtonSelector provided', async () => {
    let sentMethods: string[] = []
    const sender = createMockCdpSender({
      send: mock(async (method: string) => {
        sentMethods.push(method)
        if (method === 'Runtime.evaluate') return { result: { value: PROBE_RESULT } }
        return {}
      }),
    })
    const engine = new LiveCaptureEngine(sender, 'test-session')
    await engine.captureResponse({
      composerSelector: '#prompt-textarea',
      sendButtonSelector: '#send-button',
      sendMethod: 'click',
      testMessage: 'Hi',
      captureTimeoutMs: 200,
    })
    // Should have Runtime.evaluate calls for probe + set value + click button
    const runtimeEvalCalls = sentMethods.filter(m => m === 'Runtime.evaluate')
    expect(runtimeEvalCalls.length).toBeGreaterThanOrEqual(3)
  })

  it('returns rawBody empty when no data received', async () => {
    const sender = createMockCdpSender({
      send: mock(async (method: string) => {
        if (method === 'Runtime.evaluate') return { result: { value: PROBE_RESULT } }
        return {}
      }),
    })
    const engine = new LiveCaptureEngine(sender, 'test-session')
    const result = await engine.captureResponse({
      composerSelector: '#prompt-textarea',
      testMessage: 'Hello',
      captureTimeoutMs: 200,
    })
    expect(result.rawBody).toBe('')
    expect(result.completionDetected).toBe(false)
  })

  it('off listeners are cleaned up after capture', async () => {
    const sender = createMockCdpSender({
      send: mock(async (method: string) => {
        if (method === 'Runtime.evaluate') return { result: { value: PROBE_RESULT } }
        return {}
      }),
    })
    const engine = new LiveCaptureEngine(sender, 'test-session')
    await engine.captureResponse({
      composerSelector: '#prompt-textarea',
      testMessage: 'Hello',
      captureTimeoutMs: 200,
    })
    // off should have been called for each listener
    expect(sender.off).toHaveBeenCalledWith('Network.requestWillBeSent', expect.any(Function))
    expect(sender.off).toHaveBeenCalledWith('Network.responseReceived', expect.any(Function))
    expect(sender.off).toHaveBeenCalledWith('Network.dataReceived', expect.any(Function))
  })

  it('returns error when probe returns selector_not_found', async () => {
    const errorProbe = JSON.stringify({ error: 'selector_not_found', selector: '#missing' })
    const sender = createMockCdpSender({
      send: mock(async (method: string) => {
        if (method === 'Runtime.evaluate') return { result: { value: errorProbe } }
        return {}
      }),
    })
    const engine = new LiveCaptureEngine(sender, 'test-session')
    const result = await engine.captureResponse({
      composerSelector: '#missing',
      testMessage: 'Hello',
      captureTimeoutMs: 200,
    })
    expect(result.ok).toBe(false)
    // EngineError message is 'LiveCaptureError', details contains the real error
    expect(result.error).toContain('LiveCaptureError')
  })
})
