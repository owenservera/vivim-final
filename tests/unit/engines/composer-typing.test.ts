// tests/unit/engines/composer-typing.test.ts
// Composer typing strategies (Unit 2.3) — verify CDP transport calls.

import { describe, expect, it } from 'bun:test'
import { submitMessage, typeMessage } from '../../../src/engines/composer-typing.js'

function mockTransport() {
  const calls: Array<{ slaveId: string; method: string; params: unknown }> = []
  return {
    calls,
    transport: {
      send: async (slaveId: string, method: string, params: unknown) => {
        calls.push({ slaveId, method, params })
      },
    } as any,
  }
}

describe('composer-typing', () => {
  it('types into a textarea with the value setter + input/change events', async () => {
    const { calls, transport } = mockTransport()
    await typeMessage(transport, 'slave1', '#prompt', 'hello', 'textarea')
    expect(calls.length).toBe(1)
    expect(calls[0].method).toBe('Runtime.evaluate')
    const expr = (calls[0].params as any).expression as string
    expect(expr).toContain('"hello"')
    expect(expr).toContain('HTMLTextAreaElement')
    expect(expr).toContain("dispatchEvent(new Event('input'")
  })

  it('types into contenteditable via execCommand insertText', async () => {
    const { calls, transport } = mockTransport()
    await typeMessage(transport, 's', '#ce', 'yo', 'contenteditable')
    const expr = (calls[0].params as any).expression as string
    expect(expr).toContain('execCommand')
    expect(expr).toContain('"yo"')
  })

  it('types into quill via the quill instance when present', async () => {
    const { calls, transport } = mockTransport()
    await typeMessage(transport, 's', '#q', 'hi', 'quill')
    const expr = (calls[0].params as any).expression as string
    expect(expr).toContain('__quill')
    expect(expr).toContain('insertText')
  })

  it('types into codemirror via setValue when present', async () => {
    const { calls, transport } = mockTransport()
    await typeMessage(transport, 's', '#cm', 'x', 'codemirror')
    const expr = (calls[0].params as any).expression as string
    expect(expr).toContain('CodeMirror')
    expect(expr).toContain('setValue')
  })

  it('submitMessage clicks the provided send selector', async () => {
    const { calls, transport } = mockTransport()
    await submitMessage(transport, 's', '[data-testid="send-button"]')
    expect(calls.length).toBe(1)
    expect(calls[0].method).toBe('Runtime.evaluate')
    expect(((calls[0].params as any).expression as string)).toContain('click()')
  })

  it('submitMessage dispatches Enter key events when no selector given', async () => {
    const { calls, transport } = mockTransport()
    await submitMessage(transport, 's')
    expect(calls.length).toBe(2)
    expect(calls[0].method).toBe('Input.dispatchKeyEvent')
    expect((calls[0].params as any).type).toBe('keyDown')
    expect((calls[0].params as any).key).toBe('Enter')
    expect((calls[1].params as any).type).toBe('keyUp')
  })
})
