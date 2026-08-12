// src/automation/ui-automator.ts
// Custom browser automation engine for vivim frontend.
// Uses CDP directly — no external dependencies (no Playwright, no Puppeteer).
// Drives the frontend UI via the same Chrome instances we already manage.
//
// PRINCIPLE: The agent sends high-level commands ("type HELLO in search box"),
// the engine resolves them to CDP operations, the user sees it happen live.

import { BunCdpClient } from '../executor/cdp.js'

export interface AutomateOptions {
  /** Chrome debug port to connect to. Default: 5173 (frontend dev server port mapped to Chrome) */
  port?: number
  /** Base URL of the frontend. Default: http://localhost:5173 */
  baseUrl?: string
}

export interface ElementSelector {
  /** CSS selector */
  selector?: string
  /** Text content to match */
  text?: string
  /** Aria label to match */
  ariaLabel?: string
  /** Placeholder text to match */
  placeholder?: string
  /** nth match (0-indexed) */
  nth?: number
}

export interface AutomateResult {
  ok: boolean
  action: string
  detail?: string
  screenshot?: string // base64 PNG
  error?: string
}

// ── UIAutomator class ────────────────────────────────────────────────────────

export class UIAutomator {
  private client: BunCdpClient
  private sessionId: string | null = null
  private targetId: string | null = null
  private baseUrl: string

  /** Session id, guaranteed non-null once connected (see ensureSession). */
  private get sid(): string {
    if (this.sessionId === null) {
      throw new Error('UIAutomator session not established; call connect() first')
    }
    return this.sessionId
  }

  constructor(opts: AutomateOptions = {}) {
    this.baseUrl = opts.baseUrl ?? 'http://localhost:5173'
    // Connect to the frontend's Chrome debug port
    // The frontend runs on :5173, but we need a Chrome instance with CDP
    // We'll connect to whatever Chrome is available
    const port = opts.port ?? 9222
    this.client = new BunCdpClient(`ws://127.0.0.1:${port}/devtools/browser`)
  }

  async connect(): Promise<void> {
    await this.client.connect()

    // Find or create a page target
    const targets = (await this.client.send('Target.getTargets')) as {
      targetInfos?: Array<{ type: string; url: string; targetId: string }>
    }
    const pages = (targets?.targetInfos ?? []).filter((t) => t.type === 'page')

    if (pages.length > 0 && pages[0]) {
      this.targetId = pages[0].targetId
    } else {
      // Create a new tab
      const { targetId } = (await this.client.send('Target.createTarget', {
        url: this.baseUrl,
      })) as { targetId: string }
      this.targetId = targetId
    }

    // Attach to the page
    const { sessionId } = (await this.client.send('Target.attachToTarget', {
      targetId: this.targetId,
      flatten: true,
    })) as { sessionId: string }
    this.sessionId = sessionId

    // Enable required domains
    await this.client.send('DOM.enable', {}, { sessionId })
    await this.client.send('Runtime.enable', {}, { sessionId })
    await this.client.send('Input.enable', {}, { sessionId })
  }

  async disconnect(): Promise<void> {
    if (this.sessionId) {
      await this.client
        .send('Target.detachFromTarget', { sessionId: this.sessionId })
        .catch(() => {})
  // [audit] log the error with context here
    }
    await this.client.disconnect()
  }

  // ── Navigation ────────────────────────────────────────────────────────────

  async navigate(url: string): Promise<AutomateResult> {
    await this.ensureSession()
    await this.client.send('Page.navigate', { url }, { sessionId: this.sid })
    await this.waitForLoad()
    return { ok: true, action: 'navigate', detail: url }
  }

  async getCurrentUrl(): Promise<string> {
    await this.ensureSession()
    const result = (await this.client.send(
      'Runtime.evaluate',
      {
        expression: 'location.href',
        returnByValue: true,
      },
      { sessionId: this.sid },
    )) as { result?: { value?: string } }
    return result?.result?.value ?? ''
  }

  async getPageTitle(): Promise<string> {
    await this.ensureSession()
    const result = (await this.client.send(
      'Runtime.evaluate',
      {
        expression: 'document.title',
        returnByValue: true,
      },
      { sessionId: this.sid },
    )) as { result?: { value?: string } }
    return result?.result?.value ?? ''
  }

  // ── Element interaction ───────────────────────────────────────────────────

  async click(selector: ElementSelector): Promise<AutomateResult> {
    await this.ensureSession()
    const expr = this.buildSelectorExpression(selector)
    const jsExpr = `
      (() => {
        const el = ${expr};
        if (!el) return JSON.stringify({ found: false, error: 'Element not found' });
        el.scrollIntoView({ behavior: 'instant', block: 'center' });
        el.focus();
        const rect = el.getBoundingClientRect();
        return JSON.stringify({ found: true, tag: el.tagName, text: el.textContent?.slice(0, 50), x: rect.x + rect.width/2, y: rect.y + rect.height/2 });
      })()
    `
    const result = (await this.client.send(
      'Runtime.evaluate',
      {
        expression: jsExpr,
        returnByValue: true,
      },
      { sessionId: this.sid },
    )) as { result?: { value?: string } }

    const info = JSON.parse(result?.result?.value ?? '{"found":false}')
    if (!info.found) {
      return { ok: false, action: 'click', error: info.error ?? 'Element not found' }
    }

    // Dispatch click via Input.dispatchMouseEvent (more reliable than JS click)
    await this.client.send(
      'Input.dispatchMouseEvent',
      {
        type: 'mousePressed',
        x: info.x,
        y: info.y,
        button: 'left',
        clickCount: 1,
      },
      { sessionId: this.sid },
    )
    await this.client.send(
      'Input.dispatchMouseEvent',
      {
        type: 'mouseReleased',
        x: info.x,
        y: info.y,
        button: 'left',
        clickCount: 1,
      },
      { sessionId: this.sid },
    )

    return { ok: true, action: 'click', detail: `${info.tag} "${info.text}"` }
  }

  async type(
    selector: ElementSelector,
    text: string,
    opts?: { delay?: number },
  ): Promise<AutomateResult> {
    await this.ensureSession()

    // Focus the element first
    const clickResult = await this.click(selector)
    if (!clickResult.ok) return clickResult

    // Type each character via Input.dispatchKeyEvent
    const delay = opts?.delay ?? 30
    for (const char of text) {
      await this.client.send(
        'Input.dispatchKeyEvent',
        {
          type: 'keyDown',
          text: char,
          key: char,
          code: `Key${char.toUpperCase()}`,
          windowsVirtualKeyCode: char.charCodeAt(0),
          nativeVirtualKeyCode: char.charCodeAt(0),
        },
        { sessionId: this.sid },
      )
      await this.client.send(
        'Input.dispatchKeyEvent',
        {
          type: 'keyUp',
          key: char,
          code: `Key${char.toUpperCase()}`,
          windowsVirtualKeyCode: char.charCodeAt(0),
          nativeVirtualKeyCode: char.charCodeAt(0),
        },
        { sessionId: this.sid },
      )
      if (delay > 0) await sleep(delay)
    }

    return { ok: true, action: 'type', detail: `Typed "${text}"` }
  }

  async clear(selector: ElementSelector): Promise<AutomateResult> {
    await this.ensureSession()
    // Focus + select all + delete
    await this.click(selector)
    await this.client.send(
      'Input.dispatchKeyEvent',
      {
        type: 'keyDown',
        key: 'a',
        code: 'KeyA',
        windowsVirtualKeyCode: 65,
        nativeVirtualKeyCode: 65,
        modifiers: 2, // Ctrl
      },
      { sessionId: this.sid },
    )
    await this.client.send(
      'Input.dispatchKeyEvent',
      {
        type: 'keyUp',
        key: 'a',
        code: 'KeyA',
        windowsVirtualKeyCode: 65,
        nativeVirtualKeyCode: 65,
        modifiers: 2,
      },
      { sessionId: this.sid },
    )
    await this.client.send(
      'Input.dispatchKeyEvent',
      {
        type: 'keyDown',
        key: 'Backspace',
        code: 'Backspace',
        windowsVirtualKeyCode: 8,
        nativeVirtualKeyCode: 8,
      },
      { sessionId: this.sid },
    )
    await this.client.send(
      'Input.dispatchKeyEvent',
      {
        type: 'keyUp',
        key: 'Backspace',
        code: 'Backspace',
        windowsVirtualKeyCode: 8,
        nativeVirtualKeyCode: 8,
      },
      { sessionId: this.sid },
    )
    return { ok: true, action: 'clear', detail: 'Cleared input' }
  }

  async getValue(selector: ElementSelector): Promise<string> {
    await this.ensureSession()
    const expr = this.buildSelectorExpression(selector)
    const jsExpr = `
      (() => {
        const el = ${expr};
        if (!el) return '';
        return el.value ?? el.textContent ?? '';
      })()
    `
    const result = (await this.client.send(
      'Runtime.evaluate',
      {
        expression: jsExpr,
        returnByValue: true,
      },
      { sessionId: this.sid },
    )) as { result?: { value?: string } }
    return result?.result?.value ?? ''
  }

  async getText(selector: ElementSelector): Promise<string> {
    await this.ensureSession()
    const expr = this.buildSelectorExpression(selector)
    const jsExpr = `
      (() => {
        const el = ${expr};
        if (!el) return '';
        return el.textContent ?? '';
      })()
    `
    const result = (await this.client.send(
      'Runtime.evaluate',
      {
        expression: jsExpr,
        returnByValue: true,
      },
      { sessionId: this.sid },
    )) as { result?: { value?: string } }
    return result?.result?.value ?? ''
  }

  async exists(selector: ElementSelector): Promise<boolean> {
    await this.ensureSession()
    const expr = this.buildSelectorExpression(selector)
    const jsExpr = `!!(${expr})`
    const result = (await this.client.send(
      'Runtime.evaluate',
      {
        expression: jsExpr,
        returnByValue: true,
      },
      { sessionId: this.sid },
    )) as { result?: { value?: boolean } }
    return result?.result?.value ?? false
  }

  async waitForSelector(selector: ElementSelector, timeoutMs = 5000): Promise<boolean> {
    const start = Date.now()
    while (Date.now() - start < timeoutMs) {
      if (await this.exists(selector)) return true
      await sleep(100)
    }
    return false
  }

  // ── Screenshots ──────────────────────────────────────────────────────────

  async screenshot(): Promise<string> {
    await this.ensureSession()
    const result = (await this.client.send(
      'Page.captureScreenshot',
      {
        format: 'png',
      },
      { sessionId: this.sid },
    )) as { data?: string }
    return result?.data ?? ''
  }

  // ── Page state ───────────────────────────────────────────────────────────

  async getPageContent(): Promise<string> {
    await this.ensureSession()
    const result = (await this.client.send(
      'Runtime.evaluate',
      {
        expression: 'document.body.innerText',
        returnByValue: true,
      },
      { sessionId: this.sid },
    )) as { result?: { value?: string } }
    return result?.result?.value ?? ''
  }

  async getHtml(): Promise<string> {
    await this.ensureSession()
    const result = (await this.client.send(
      'Runtime.evaluate',
      {
        expression: 'document.body.innerHTML',
        returnByValue: true,
      },
      { sessionId: this.sid },
    )) as { result?: { value?: string } }
    return result?.result?.value ?? ''
  }

  // ── Keyboard shortcuts ──────────────────────────────────────────────────

  async pressKey(
    key: string,
    modifiers?: { ctrl?: boolean; shift?: boolean; alt?: boolean },
  ): Promise<AutomateResult> {
    await this.ensureSession()
    let mods = 0
    if (modifiers?.ctrl) mods |= 2
    if (modifiers?.alt) mods |= 4
    if (modifiers?.shift) mods |= 8

    await this.client.send(
      'Input.dispatchKeyEvent',
      {
        type: 'keyDown',
        key,
        code: `Key${key}`,
        windowsVirtualKeyCode: key.charCodeAt(0),
        nativeVirtualKeyCode: key.charCodeAt(0),
        modifiers: mods || undefined,
      },
      { sessionId: this.sid },
    )
    await this.client.send(
      'Input.dispatchKeyEvent',
      {
        type: 'keyUp',
        key,
        code: `Key${key}`,
        windowsVirtualKeyCode: key.charCodeAt(0),
        nativeVirtualKeyCode: key.charCodeAt(0),
        modifiers: mods || undefined,
      },
      { sessionId: this.sid },
    )
    return { ok: true, action: 'pressKey', detail: key }
  }

  // ── Internals ────────────────────────────────────────────────────────────

  private async ensureSession(): Promise<void> {
    if (!this.sessionId) await this.connect()
  }

  private buildSelectorExpression(sel: ElementSelector): string {
    if (sel.selector) return `document.querySelector('${sel.selector}')`
    if (sel.text)
      return `Array.from(document.querySelectorAll('*')).find(el => el.textContent?.trim() === '${sel.text}')`
    if (sel.ariaLabel) return `document.querySelector('[aria-label*="${sel.ariaLabel}"]')`
    if (sel.placeholder) return `document.querySelector('[placeholder*="${sel.placeholder}"]')`
    return 'null'
  }

  private async waitForLoad(): Promise<void> {
    await sleep(500)
    // Wait for network idle (simplified)
    let lastSize = 0
    let stable = 0
    while (stable < 3) {
      const result = (await this.client.send(
        'Runtime.evaluate',
        {
          expression: 'document.readyState',
          returnByValue: true,
        },
        { sessionId: this.sid },
      )) as { result?: { value?: string } }
      if (result?.result?.value === 'complete') break
      const currentSize = (await this.client.send(
        'Runtime.evaluate',
        {
          expression: 'document.body.innerHTML.length',
          returnByValue: true,
        },
        { sessionId: this.sid },
      )) as { result?: { value?: number } }
      const size = currentSize?.result?.value ?? 0
      if (size === lastSize) stable++
      else stable = 0
      lastSize = size
      await sleep(200)
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
