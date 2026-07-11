// src/executor/slave-read.ts
// SlaveRead — High-level CDP operations for reading browser state.

import type { BunCdpClient } from './cdp.js'

export class SlaveReadError extends Error {
  constructor(
    message: string,
    public readonly selector?: string,
    public readonly method?: string,
  ) {
    super(message)
    this.name = 'SlaveReadError'
  }
}

interface ConsoleLogEntry {
  level: string
  text: string
}

export class SlaveRead {
  private cdp: BunCdpClient
  private consoleLogs: ConsoleLogEntry[] = []

  constructor(cdp: BunCdpClient) {
    this.cdp = cdp
    // Capture console output emitted by the page.
    this.cdp.on('Runtime.consoleAPICalled', (params: unknown) => {
      const p = params as { type?: string; args?: Array<{ value?: unknown }> }
      const text = (p.args ?? [])
        .map((a) => (a.value === undefined ? '' : String(a.value)))
        .join(' ')
      this.consoleLogs.push({ level: p.type ?? 'log', text })
    })
  }

  async connect(): Promise<void> {
    await this.cdp.connect()
    await this.cdp.send('Runtime.enable')
    await this.cdp.send('Page.enable').catch(() => {
      // Page domain optional for pure read operations
    })
  }

  private async evalExpr<T = unknown>(expression: string): Promise<T> {
    const result = await this.cdp.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
    })
    const value = (result as { result?: { value?: unknown } })?.result?.value
    return value as T
  }

  async getText(selector: string): Promise<string> {
    const sel = JSON.stringify(selector)
    const text = await this.evalExpr<string>(
      `(() => { const el = document.querySelector(${sel}); return el ? el.textContent : ''; })()`,
    )
    return text ?? ''
  }

  async getHtml(selector?: string): Promise<string> {
    if (selector) {
      const sel = JSON.stringify(selector)
      const html = await this.evalExpr<string>(
        `(() => { const el = document.querySelector(${sel}); return el ? el.innerHTML : ''; })()`,
      )
      return html ?? ''
    }
    const html = await this.evalExpr<string>('document.documentElement.innerHTML')
    return html ?? ''
  }

  async getAttribute(selector: string, attr: string): Promise<string | null> {
    const sel = JSON.stringify(selector)
    const a = JSON.stringify(attr)
    const value = await this.evalExpr<string | null>(
      `(() => { const el = document.querySelector(${sel}); return el ? el.getAttribute(${a}) : null; })()`,
    )
    return value ?? null
  }

  async getUrl(): Promise<string> {
    const url = await this.evalExpr<string>('window.location.href')
    return url ?? ''
  }

  async getTitle(): Promise<string> {
    const title = await this.evalExpr<string>('document.title')
    return title ?? ''
  }

  async isVisible(selector: string): Promise<boolean> {
    const sel = JSON.stringify(selector)
    const visible = await this.evalExpr<boolean>(
      `(() => { const el = document.querySelector(${sel}); if (!el) return false; const r = el.getBoundingClientRect(); if (r.width === 0 || r.height === 0) return false; const s = getComputedStyle(el); return s.visibility !== 'hidden' && s.display !== 'none' && s.opacity !== '0'; })()`,
    )
    return visible === true
  }

  async getElementCount(selector: string): Promise<number> {
    const sel = JSON.stringify(selector)
    const count = await this.evalExpr<number>(`document.querySelectorAll(${sel}).length`)
    return count ?? 0
  }

  async getConsoleLogs(): Promise<ConsoleLogEntry[]> {
    return [...this.consoleLogs]
  }

  async screenshot(
    selector?: string,
    opts?: { format?: 'png' | 'jpeg'; quality?: number },
  ): Promise<Buffer> {
    const captureOpts: Record<string, unknown> = {
      format: opts?.format ?? 'png',
    }
    if (opts?.quality !== undefined) captureOpts.quality = opts.quality

    if (selector) {
      // Clip to the element's bounding box.
      const sel = JSON.stringify(selector)
      const clip = await this.evalExpr<{
        x: number
        y: number
        width: number
        height: number
      } | null>(
        `(() => { const el = document.querySelector(${sel}); if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; })()`,
      )
      if (!clip) throw new SlaveReadError(`Element not found: ${selector}`, selector)
      captureOpts.clip = clip
    }

    const result = await this.cdp.send('Page.captureScreenshot', captureOpts)
    const data = (result as { data?: string })?.data
    if (!data) throw new SlaveReadError('Failed to capture screenshot')
    return Buffer.from(data, 'base64')
  }

  async disconnect(): Promise<void> {
    await this.cdp.disconnect()
  }
}
