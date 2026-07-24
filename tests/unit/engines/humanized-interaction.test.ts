// tests/unit/engines/humanized-interaction.test.ts
// Humanized mouse/keyboard interaction to reduce bot detection.

import { describe, expect, it, mock } from 'bun:test'
import type { CDPTransport } from '../../../src/engines/chrome-governor.js'
import {
  humanizedClick,
  humanizedMouseMove,
  jitterViewport,
} from '../../../src/engines/humanized-interaction.js'

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

describe('humanized-interaction', () => {
  describe('humanizedMouseMove', () => {
    it('sends multiple mouseMoved events along a bezier curve', async () => {
      const transport = mockTransport()
      await humanizedMouseMove(transport, 's1', 100, 100, 500, 500)

      const calls = (transport.send as ReturnType<typeof mock>).mock.calls
      const mouseMovedCalls = calls.filter((c) => {
        const params = c[2] as { type?: string }
        return params?.type === 'mouseMoved'
      })
      // Should have 15-25 steps
      expect(mouseMovedCalls.length).toBeGreaterThanOrEqual(15)
      expect(mouseMovedCalls.length).toBeLessThanOrEqual(25)
    })

    it('each mouseMoved has x and y coordinates', async () => {
      const transport = mockTransport()
      await humanizedMouseMove(transport, 's1', 0, 0, 100, 100)

      const calls = (transport.send as ReturnType<typeof mock>).mock.calls
      const mouseMovedCalls = calls.filter((c) => {
        const params = c[2] as { type?: string }
        return params?.type === 'mouseMoved'
      })
      for (const call of mouseMovedCalls) {
        const params = call[2] as { x: number; y: number }
        expect(typeof params.x).toBe('number')
        expect(typeof params.y).toBe('number')
      }
    })
  })

  describe('humanizedClick', () => {
    it('sends mouseMoved + mousePressed + mouseReleased', async () => {
      const transport = mockTransport()
      await humanizedClick(transport, 's1', 200, 300, 100, 100)

      const calls = (transport.send as ReturnType<typeof mock>).mock.calls
      const types = calls.map((c) => (c[2] as { type: string }).type)

      expect(types).toContain('mouseMoved')
      expect(types).toContain('mousePressed')
      expect(types).toContain('mouseReleased')
    })

    it('mousePressed uses left button', async () => {
      const transport = mockTransport()
      await humanizedClick(transport, 's1', 200, 300, 100, 100)

      const calls = (transport.send as ReturnType<typeof mock>).mock.calls
      const pressed = calls.find((c) => (c[2] as { type: string }).type === 'mousePressed')
      expect(pressed).toBeDefined()
      expect((pressed?.[2] as { button: string }).button).toBe('left')
    })

    it('mousePressed and mouseReleased use same coordinates', async () => {
      const transport = mockTransport()
      await humanizedClick(transport, 's1', 250, 350, 100, 100)

      const calls = (transport.send as ReturnType<typeof mock>).mock.calls
      const pressed = calls.find((c) => (c[2] as { type: string }).type === 'mousePressed')
      const released = calls.find((c) => (c[2] as { type: string }).type === 'mouseReleased')

      expect(pressed).toBeDefined()
      expect(released).toBeDefined()
      expect((pressed?.[2] as { x: number }).x).toBe(250)
      expect((pressed?.[2] as { y: number }).y).toBe(350)
      expect((released?.[2] as { x: number }).x).toBe(250)
      expect((released?.[2] as { y: number }).y).toBe(350)
    })
  })

  describe('jitterViewport', () => {
    it('sets device metrics with jittered dimensions', async () => {
      const transport = mockTransport()
      await jitterViewport(transport, 's1')

      const calls = (transport.send as ReturnType<typeof mock>).mock.calls
      const setMetrics = calls.find((c) => c[1] === 'Emulation.setDeviceMetricsOverride')
      expect(setMetrics).toBeDefined()
      const params = setMetrics?.[2] as { width: number; height: number; mobile: boolean }
      // Width should be around 1280 ± 15
      expect(params.width).toBeGreaterThanOrEqual(1265)
      expect(params.width).toBeLessThanOrEqual(1295)
      expect(params.height).toBeGreaterThanOrEqual(705)
      expect(params.height).toBeLessThanOrEqual(735)
      expect(params.mobile).toBe(false)
    })
  })
})
