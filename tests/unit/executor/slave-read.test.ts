// tests/unit/executor/slave-read.test.ts
// Unit tests for SlaveRead — uses a mock BunCdpClient (no browser required).

import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import type { BunCdpClient } from '../../../src/executor/cdp.js'
import { SlaveRead, SlaveReadError } from '../../../src/executor/slave-read.js'

// Minimal fake CDP client that returns scripted responses.
class FakeCdp {
  handlers: Record<string, Array<(p: unknown) => void>> = {}
  // route -> (params) => result
  routes: Record<string, (params: any) => unknown> = {}
  // queue of consoleAPICalled events to replay on connect
  pendingConsole: Array<{ type: string; args: Array<{ value: unknown }> }> = []

  async send(method: string, params: any): Promise<unknown> {
    const route = this.routes[method]
    if (!route) return undefined
    return route(params)
  }

  on(event: string, handler: (p: unknown) => void): void {
    ;(this.handlers[event] ??= []).push(handler)
  }

  off(): void {}

  async connect(): Promise<void> {}

  async disconnect(): Promise<void> {}

  emitConsole(): void {
    for (const ev of this.pendingConsole) {
      for (const h of this.handlers['Runtime.consoleAPICalled'] ?? []) h(ev)
    }
  }
}

function wrapResult(value: unknown) {
  return { result: { type: typeof value, value } }
}

describe('SlaveRead', () => {
  let fake: FakeCdp
  let read: SlaveRead

  beforeEach(() => {
    fake = new FakeCdp()
    fake.routes['Runtime.evaluate'] = (params: any) => wrapResult(params.expression)
    // The evaluate handler above is a placeholder; we override per-test below.
    read = new SlaveRead(fake as unknown as BunCdpClient)
  })

  afterEach(() => {
    fake.handlers = {}
  })

  it('getUrl() returns current href', async () => {
    fake.routes['Runtime.evaluate'] = () => wrapResult('https://chat.openai.com/c/abc')
    const url = await read.getUrl()
    expect(url).toBe('https://chat.openai.com/c/abc')
  })

  it('getTitle() returns document title', async () => {
    fake.routes['Runtime.evaluate'] = () => wrapResult('ChatGPT')
    const title = await read.getTitle()
    expect(title).toBe('ChatGPT')
  })

  it('getText() returns element text content', async () => {
    fake.routes['Runtime.evaluate'] = (params: any) => {
      const expr = String(params.expression)
      if (expr.includes('textContent')) return wrapResult('Hello world')
      return wrapResult(null)
    }
    const text = await read.getText('h1')
    expect(text).toBe('Hello world')
  })

  it('isVisible() returns true for a rendered element', async () => {
    fake.routes['Runtime.evaluate'] = () => wrapResult(true)
    const visible = await read.isVisible('body')
    expect(visible).toBe(true)
  })

  it('isVisible() returns false for a zero-size element', async () => {
    fake.routes['Runtime.evaluate'] = () => wrapResult(false)
    const visible = await read.isVisible('.hidden')
    expect(visible).toBe(false)
  })

  it('getElementCount() returns number of matches', async () => {
    fake.routes['Runtime.evaluate'] = () => wrapResult(5)
    const count = await read.getElementCount('.item')
    expect(count).toBe(5)
  })

  it('getAttribute() returns attribute value', async () => {
    fake.routes['Runtime.evaluate'] = (params: any) => {
      const expr = String(params.expression)
      if (expr.includes('getAttribute')) return wrapResult('btn-primary')
      return wrapResult(null)
    }
    const cls = await read.getAttribute('button', 'class')
    expect(cls).toBe('btn-primary')
  })

  it('getConsoleLogs() returns captured entries', async () => {
    fake.pendingConsole = [
      { type: 'log', args: [{ value: 'loaded' }] },
      { type: 'error', args: [{ value: 'boom' }] },
    ]
    fake.emitConsole()
    const logs = await read.getConsoleLogs()
    expect(logs).toEqual([
      { level: 'log', text: 'loaded' },
      { level: 'error', text: 'boom' },
    ])
  })

  it('screenshot() returns a Buffer from base64 data', async () => {
    const b64 = Buffer.from('fake-png-bytes').toString('base64')
    fake.routes['Page.captureScreenshot'] = () => ({ data: b64 })
    const buf = await read.screenshot()
    expect(Buffer.isBuffer(buf)).toBe(true)
    expect(buf.toString()).toBe('fake-png-bytes')
  })

  it('screenshot() throws SlaveReadError when no data returned', async () => {
    fake.routes['Page.captureScreenshot'] = () => ({})
    await expect(read.screenshot()).rejects.toBeInstanceOf(SlaveReadError)
  })
})
