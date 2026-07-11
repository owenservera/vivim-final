// src/executor/slave-write.ts
// SlaveWrite — High-level CDP operations for browser interaction.

import { BunCdpClient } from './cdp.js'

export class SlaveWriteError extends Error {
  constructor(
    message: string,
    public readonly selector?: string,
    public readonly method?: string,
  ) {
    super(message)
    this.name = 'SlaveWriteError'
  }
}

export class SlaveWrite {
  private cdp: BunCdpClient

  constructor(private debugUrl: string) {
    this.cdp = new BunCdpClient(debugUrl)
  }

  async connect(): Promise<void> {
    await this.cdp.connect()
  }

  async type(
    selector: string,
    text: string,
    opts?: { delayMs?: number; clearFirst?: boolean },
  ): Promise<void> {
    if (opts?.clearFirst) {
      await this.cdp.send('DOM.querySelector', { selector })
      await this.cdp.send('Input.focus', { selector })
      await this.cdp.send('Input.dispatchKeyEvent', {
        type: 'keyDown',
        key: 'a',
        modifiers: ['Control'],
      })
      await this.cdp.send('Input.dispatchKeyEvent', {
        type: 'keyUp',
        key: 'a',
        modifiers: ['Control'],
      })
    }
    await this.cdp.send('DOM.querySelector', { selector })
    await this.cdp.send('Input.focus', { selector })

    const chars = text.split('')
    for (const char of chars) {
      await this.cdp.send('Input.dispatchKeyEvent', {
        type: 'keyDown',
        key: char,
        text: char,
      })
      await this.cdp.send('Input.dispatchKeyEvent', {
        type: 'keyUp',
        key: char,
        text: char,
      })
      if (opts?.delayMs) await Bun.sleep(opts.delayMs)
    }
  }

  async click(selector: string): Promise<void> {
    const node = await this.cdp.send('DOM.querySelector', { selector })
    if (!node) throw new SlaveWriteError(`Element not found: ${selector}`, selector)

    // Scroll into view
    await this.cdp.send('DOM.scrollIntoViewIfNeeded', { nodeId: (node as any).nodeId })

    // Get bounding box
    const box = await this.cdp.send('DOM.getBoxModel', { nodeId: (node as any).nodeId })

    // Find center point
    const x = ((box as any).model?.content?.[0]?.[0] + (box as any).model?.content?.[1]?.[0]) / 2
    const y = ((box as any).model?.content?.[0]?.[1] + (box as any).model?.content?.[3]?.[1]) / 2

    await this.cdp.send('Input.dispatchMouseEvent', {
      type: 'mousePressed',
      x,
      y,
      button: 'left',
      clickCount: 1,
    })
    await this.cdp.send('Input.dispatchMouseEvent', {
      type: 'mouseReleased',
      x,
      y,
      button: 'left',
      clickCount: 1,
    })
  }

  async navigate(url: string): Promise<void> {
    await this.cdp.send('Page.navigate', { url })
    await this.cdp.send('Page.loadEventFired')
  }

  async evaluate(expression: string): Promise<unknown> {
    const result = await this.cdp.send('Runtime.evaluate', { expression })
    return (result as any)?.result?.value
  }

  async focus(selector: string): Promise<void> {
    const node = await this.cdp.send('DOM.querySelector', { selector })
    if (!node) throw new SlaveWriteError(`Element not found: ${selector}`, selector)
    await this.cdp.send('DOM.focus', { nodeId: (node as any).nodeId })
  }

  async select(selector: string, value: string): Promise<void> {
    const node = await this.cdp.send('DOM.querySelector', { selector })
    if (!node) throw new SlaveWriteError(`Element not found: ${selector}`, selector)
    await this.cdp.send('Runtime.evaluate', {
      expression: `document.querySelector('${selector}').value = '${value}'`,
    })
  }

  async scrollTo(selector: string): Promise<void> {
    const node = await this.cdp.send('DOM.querySelector', { selector })
    if (!node) throw new SlaveWriteError(`Element not found: ${selector}`, selector)
    await this.cdp.send('DOM.scrollIntoViewIfNeeded', { nodeId: (node as any).nodeId })
  }

  async screenshot(opts?: { format?: 'png' | 'jpeg'; quality?: number }): Promise<Buffer> {
    const result = await this.cdp.send('Page.captureScreenshot', {
      format: opts?.format ?? 'png',
      quality: opts?.quality,
    })
    const data = (result as any)?.data
    if (!data) throw new SlaveWriteError('Failed to capture screenshot')
    return Buffer.from(data, 'base64')
  }

  async disconnect(): Promise<void> {
    await this.cdp.disconnect()
  }
}
