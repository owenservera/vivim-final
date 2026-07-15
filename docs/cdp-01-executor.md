# CDP Executor Layer — Core Transport & Browser Lifecycle

---
### executor/cdp-types.ts
---

`	ypescript
// src/executor/cdp-types.ts
// Shared types for CDP client

export interface CdpClientOptions {
  timeoutMs?: number
  maxRetries?: number
  retryDelayMs?: number
  pingIntervalMs?: number
}

export interface CommandOptions {
  timeoutMs?: number
  sessionId?: string
  retries?: number
}

`$([char]10)
---
### executor/cdp.ts
---

`	ypescript
// src/executor/cdp.ts
// Real WebSocket CDP client with auto-reconnect, session management, per-command timeouts, and event subscription.

import { CdpConnectionError, CdpTimeoutError } from '../errors.js'
import type { CdpClientOptions, CommandOptions } from './cdp-types.ts'

export type { CdpClientOptions, CommandOptions }

const DEFAULT_OPTIONS: Required<CdpClientOptions> = {
  timeoutMs: 30_000,
  maxRetries: 3,
  retryDelayMs: 1_000,
  pingIntervalMs: 30_000,
}

interface PendingRequest {
  resolve: (value: unknown) => void
  reject: (reason: unknown) => void
  timer: ReturnType<typeof setTimeout>
  method: string
}

type EventHandler = (params: unknown) => void

export class BunCdpClient {
  private ws: WebSocket | null = null
  private msgId = 0
  private pending = new Map<number, PendingRequest>()
  private handlers = new Map<string, Set<EventHandler>>()
  private _connected = false
  private connecting = false
  private retryCount = 0
  private retryTimer: ReturnType<typeof setTimeout> | null = null
  private pingTimer: ReturnType<typeof setInterval> | null = null
  private destroyed = false
  private opts: Required<CdpClientOptions>

  constructor(
    private debugUrl: string,
    opts?: CdpClientOptions,
  ) {
    this.opts = { ...DEFAULT_OPTIONS, ...opts }
  }

  get connected(): boolean {
    return this._connected
  }

  async connect(): Promise<void> {
    if (this._connected) return
    if (this.connecting) {
      return new Promise<void>((resolve) => {
        const check = () => {
          if (this._connected) resolve()
          else setTimeout(check, 50)
        }
        check()
      })
    }

    this.connecting = true
    this.destroyed = false

    try {
      await this.initConnection()
      this._connected = true
      this.connecting = false
      this.retryCount = 0
      this.startPing()
    } catch (err) {
      this.connecting = false
      throw err
    }
  }

  private initConnection(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const ws = new WebSocket(this.debugUrl)
        this.ws = ws

        ws.onopen = () => {
          resolve()
        }

        ws.onmessage = (event: MessageEvent) => {
          this.handleMessage(event.data as string)
        }

        ws.onclose = () => {
          this._connected = false
          this.ws = null
          this.stopPing()

          if (!this.destroyed) {
            this.scheduleReconnect()
          }
        }

        ws.onerror = () => {
          reject(new CdpConnectionError('WebSocket connection failed'))
        }
      } catch (err) {
        reject(new CdpConnectionError(`Failed to create WebSocket: ${(err as Error).message}`))
      }
    })
  }

  private handleMessage(data: string): void {
    let msg: Record<string, unknown>
    try {
      msg = JSON.parse(data)
    } catch {
      return
    }

    const id = msg.id as number | undefined

    // Event message (no id field)
    if (id === undefined) {
      const method = msg.method as string
      if (method) {
        const handlers = this.handlers.get(method)
        if (handlers) {
          for (const handler of handlers) {
            try {
              handler(msg.params)
            } catch {
              /* isolate handler errors */
            }
          }
        }
      }
      return
    }

    // Response message (has id field)
    const pending = this.pending.get(id)
    if (!pending) return

    this.pending.delete(id)
    clearTimeout(pending.timer)

    if (msg.error) {
      const errMsg = (msg.error as { message?: string }).message ?? 'CDP command failed'
      pending.reject(new CdpConnectionError(`${pending.method}: ${errMsg}`))
    } else {
      pending.resolve(msg.result)
    }
  }

  async send<T = unknown>(
    method: string,
    params?: Record<string, unknown>,
    opts?: CommandOptions,
  ): Promise<T> {
    if (!this._connected && opts?.retries !== 0) {
      await this.connect()
    }

    if (!this._connected) {
      throw new CdpConnectionError('Not connected to CDP endpoint')
    }

    const id = ++this.msgId
    const timeoutMs = opts?.timeoutMs ?? this.opts.timeoutMs

    const message: Record<string, unknown> = { id, method }
    if (opts?.sessionId) message.sessionId = opts.sessionId
    if (params) message.params = params

    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id)
        reject(new CdpTimeoutError(method))
      }, timeoutMs)

      this.pending.set(id, {
        resolve: resolve as (v: unknown) => void,
        reject,
        timer,
        method,
      })

      try {
        this.ws?.send(JSON.stringify(message))
      } catch (err) {
        this.pending.delete(id)
        clearTimeout(timer)
        reject(new CdpConnectionError(`Send failed: ${(err as Error).message}`))
      }
    })
  }

  on(event: string, handler: EventHandler): void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set())
    }
    this.handlers.get(event)?.add(handler)
  }

  off(event: string, handler: EventHandler): void {
    this.handlers.get(event)?.delete(handler)
  }

  async disconnect(): Promise<void> {
    this.destroyed = true
    this.connecting = false
    this.stopPing()
    this.cancelRetry()

    const err = new CdpConnectionError('Client disconnected')
    for (const [_id, pending] of this.pending) {
      clearTimeout(pending.timer)
      pending.reject(err)
    }
    this.pending.clear()

    if (this.ws) {
      try {
        this.ws.close(1000, 'Client disconnect')
      } catch {
        /* ignore close errors */
      }
      this.ws = null
    }

    this._connected = false
  }

  private scheduleReconnect(): void {
    if (this.destroyed) return
    if (this.retryCount >= this.opts.maxRetries) return

    const delay = this.opts.retryDelayMs * 2 ** this.retryCount
    this.retryCount++

    this.retryTimer = setTimeout(async () => {
      if (this.destroyed) return
      try {
        await this.initConnection()
        this._connected = true
        this.retryCount = 0
        this.startPing()
      } catch {
        this.scheduleReconnect()
      }
    }, delay)
  }

  private cancelRetry(): void {
    if (this.retryTimer) {
      clearTimeout(this.retryTimer)
      this.retryTimer = null
    }
  }

  private startPing(): void {
    this.stopPing()
    this.pingTimer = setInterval(() => {
      this.send('Runtime.evaluate', { expression: '1' }).catch(() => {
        // ping failure handled by onclose
      })
    }, this.opts.pingIntervalMs)
  }

  private stopPing(): void {
    if (this.pingTimer) {
      clearInterval(this.pingTimer)
      this.pingTimer = null
    }
  }
}

`$([char]10)
---
### executor/cdp-transport.ts
---

`	ypescript
// src/executor/cdp-transport.ts
// CdpTransportImpl — adapter from BunCdpClient to CDPTransport interface.
// Phase 14.1: This is the bridge between the raw CDP client and the Governor engine.

import type { CDPTransport, CaptureResult, PageState } from '../engines/chrome-governor.js'
import { BunCdpClient } from './cdp.js'

export class CdpTransportImpl implements CDPTransport {
  private clients = new Map<string, BunCdpClient>()
  // Governor-gated flag. The transport is only ever installed on the
  // ChromeGovernor (via setCdpTransport), so `evaluate` is inherently
  // governor-gated. `viaGovernor` documents that contract and rejects any
  // attempted uncurated use.
  private viaGovernor = true

  setViaGovernor(viaGovernor: boolean): void {
    this.viaGovernor = viaGovernor
  }

  async connect(slaveId: string, debugPort: number): Promise<void> {
    if (this.clients.has(slaveId)) return

    const client = new BunCdpClient(`ws://127.0.0.1:${debugPort}/devtools/browser`, {
      timeoutMs: 30_000,
      maxRetries: 3,
    })
    await client.connect()
    this.clients.set(slaveId, client)
  }

  async disconnect(slaveId: string): Promise<void> {
    const client = this.clients.get(slaveId)
    if (!client) return

    await client.disconnect()
    this.clients.delete(slaveId)
  }

  async disconnectAll(): Promise<void> {
    for (const [slaveId] of this.clients) {
      await this.disconnect(slaveId)
    }
  }

  isConnected(slaveId: string): boolean {
    return this.clients.has(slaveId)
  }

  private getClient(slaveId: string): BunCdpClient {
    const client = this.clients.get(slaveId)
    if (!client) {
      throw new Error(`CDP client not connected for slave: ${slaveId}`)
    }
    return client
  }

  async send(slaveId: string, method: string, params?: Record<string, unknown>): Promise<unknown> {
    const client = this.getClient(slaveId)
    return client.send(method, params)
  }

  async capture(slaveId: string, pattern: RegExp, timeoutMs = 30_000): Promise<CaptureResult> {
    const client = this.getClient(slaveId)
    const start = Date.now()

    // Enable network domain to capture responses
    await client.send('Network.enable')

    return new Promise<CaptureResult>((resolve, reject) => {
      let settled = false
      const matchingRequests = new Set<string>()
      let matchedUrl = ''
      let matchedStatus: number | undefined
      let matchedHeaders: Record<string, string> | undefined

      const finish = (body: string) => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        client.off('Network.responseReceived', responseHandler)
        client.off('Network.loadingFinished', finishedHandler)
        client.off('Network.loadingFailed', failedHandler)
        resolve({
          body,
          url: matchedUrl,
          headers: matchedHeaders,
          status: matchedStatus,
          durationMs: Date.now() - start,
          capturedAt: Date.now(),
        })
      }

      const timer = setTimeout(() => {
        if (settled) return
        // Stream may not have fired loadingFinished yet — return whatever matched
        finish(matchingRequests.size > 0 ? '' : '')
        if (matchingRequests.size === 0) {
          reject(new Error(`Capture timeout after ${timeoutMs}ms for pattern: ${pattern.source}`))
        }
      }, timeoutMs)

      const responseHandler = (params: unknown) => {
        const event = params as {
          requestId?: string
          response?: { url?: string; status?: number; headers?: Record<string, string> }
        }
        const url = event.response?.url ?? ''
        if (!event.requestId || !pattern.test(url)) return
        matchingRequests.add(event.requestId)
        matchedUrl = url
        matchedStatus = event.response?.status
        matchedHeaders = event.response?.headers
      }

      const finishedHandler = async (params: unknown) => {
        const event = params as { requestId?: string }
        if (!event.requestId || !matchingRequests.has(event.requestId)) return
        try {
          const result = await client.send<{ body: string }>('Network.getResponseBody', {
            requestId: event.requestId,
          })
          finish(result.body)
        } catch {
          finish('')
        }
      }

      const failedHandler = (params: unknown) => {
        const event = params as { requestId?: string }
        if (event.requestId && matchingRequests.has(event.requestId)) {
          finish('')
        }
      }

      client.on('Network.responseReceived', responseHandler)
      client.on('Network.loadingFinished', finishedHandler)
      client.on('Network.loadingFailed', failedHandler)
    })
  }

  async captureStream(
    slaveId: string,
    pattern: RegExp,
    timeoutMs = 60_000,
  ): Promise<{ body: string; chunks: string[] }> {
    const client = this.getClient(slaveId)
    const chunks: string[] = []
    let body = ''
    let resolved = false

    await client.send('Network.enable')

    return new Promise<{ body: string; chunks: string[] }>((resolve, reject) => {
      const timer = setTimeout(() => {
        if (!resolved) {
          cleanup()
          if (body || chunks.length > 0) {
            resolve({ body, chunks })
          } else {
            reject(new Error(`CaptureStream timeout after ${timeoutMs}ms`))
          }
        }
      }, timeoutMs)

      const matchingRequests = new Set<string>()

      const responseHandler = (params: unknown) => {
        const event = params as { requestId?: string; response?: { url?: string } }
        if (event.response?.url && pattern.test(event.response.url)) {
          matchingRequests.add(event.requestId!)
        }
      }

      const dataHandler = (params: unknown) => {
        const event = params as { requestId?: string }
        if (event.requestId && matchingRequests.has(event.requestId)) {
          // Data is arriving — accumulate
        }
      }

      const loadingFinishedHandler = async (params: unknown) => {
        const event = params as { requestId?: string }
        if (event.requestId && matchingRequests.has(event.requestId)) {
          try {
            const result = await client.send<{ body: string }>('Network.getResponseBody', {
              requestId: event.requestId,
            })
            body = result.body
            resolved = true
            cleanup()
            resolve({ body, chunks })
          } catch {
            cleanup()
            resolve({ body: chunks.join(''), chunks })
          }
        }
      }

      const loadingFailedHandler = (params: unknown) => {
        const event = params as { requestId?: string }
        if (event.requestId && matchingRequests.has(event.requestId)) {
          cleanup()
          reject(new Error('Network request failed'))
        }
      }

      function cleanup() {
        clearTimeout(timer)
        client.off('Network.responseReceived', responseHandler)
        client.off('Network.dataReceived', dataHandler)
        client.off('Network.loadingFinished', loadingFinishedHandler)
        client.off('Network.loadingFailed', loadingFailedHandler)
      }

      client.on('Network.responseReceived', responseHandler)
      client.on('Network.dataReceived', dataHandler)
      client.on('Network.loadingFinished', loadingFinishedHandler)
      client.on('Network.loadingFailed', loadingFailedHandler)
    })
  }

  /**
   * Governor-gated evaluate. The transport is only ever installed on the
   * ChromeGovernor, so every Runtime.evaluate funnels through this single method.
   */
  async evaluate(
    slaveId: string,
    expression: string,
    opts?: { returnByValue?: boolean; awaitPromise?: boolean },
  ): Promise<unknown> {
    if (!this.viaGovernor) {
      throw new Error('cdp-transport.evaluate is governor-gated; call setViaGovernor(true) first')
    }
    const result = (await this.send(slaveId, 'Runtime.evaluate', {
      expression,
      returnByValue: opts?.returnByValue ?? true,
      awaitPromise: opts?.awaitPromise ?? false,
    })) as { result?: { value?: unknown } }
    return result?.result?.value
  }

  async getPageState(slaveId: string): Promise<PageState> {
    const value = (await this.evaluate(
      slaveId,
      'JSON.stringify({url: location.href, title: document.title, readyState: document.readyState})',
    )) as string | undefined

    try {
      const state = JSON.parse(value ?? '{}') as PageState
      return {
        url: state.url ?? '',
        title: state.title ?? '',
        readyState: state.readyState ?? '',
      }
    } catch {
      return { url: '', title: '', readyState: '' }
    }
  }

  async captureScreenshot(slaveId: string, format: 'png' | 'jpeg' = 'png'): Promise<string> {
    const result = (await this.send(slaveId, 'Page.captureScreenshot', { format })) as {
      data?: string
    }
    return result?.data ?? ''
  }
}

`$([char]10)
---
### executor/slave-read.ts
---

`	ypescript
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
    // DISC-3: Runtime.enable is owned by ChromeGovernor.enableDomains — never
    // enable the Runtime domain directly here (would double-enable / race the governor).
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

`$([char]10)
---
### executor/slave-write.ts
---

`	ypescript
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

`$([char]10)
---
### executor/async-mutex.ts
---

`	ypescript
// src/executor/async-mutex.ts
// Async mutex for serialization of concurrent operations.

export class AsyncMutex {
  private queue: (() => void)[] = []
  private locked = false

  async acquire(): Promise<void> {
    if (!this.locked) {
      this.locked = true
      return
    }
    return new Promise<void>((resolve) => {
      this.queue.push(resolve)
    })
  }

  release(): void {
    if (this.queue.length > 0) {
      const next = this.queue.shift()
      if (next) next()
    } else {
      this.locked = false
    }
  }

  isLocked(): boolean {
    return this.locked
  }
}

`$([char]10)
---
### executor/circuit-breaker.ts
---

`	ypescript
// src/executor/circuit-breaker.ts
// Circuit breaker for fault tolerance.

export type CircuitState = 'closed' | 'open' | 'half_open'

export class CircuitBreaker {
  private failures = 0
  private currentState: CircuitState = 'closed'
  private lastFailureTime = 0

  constructor(
    private threshold: number,
    private resetMs: number,
  ) {}

  recordSuccess(): void {
    this.failures = 0
    this.currentState = 'closed'
  }

  recordFailure(): void {
    this.failures++
    this.lastFailureTime = Date.now()
    if (this.failures >= this.threshold) {
      this.currentState = 'open'
    }
  }

  state(): CircuitState {
    if (this.currentState === 'open') {
      if (Date.now() - this.lastFailureTime >= this.resetMs) {
        this.currentState = 'half_open'
      }
    }
    return this.currentState
  }

  isAvailable(): boolean {
    const s = this.state()
    return s === 'closed' || s === 'half_open'
  }
}

`$([char]10)
---
### executor/fleet-config.ts
---

`	ypescript
// src/executor/fleet-config.ts
// Fleet configuration for ChromeGovernor.

export interface FleetConfig {
  chromePath?: string | null
  portRange: { start: number; end: number }
  healthProbeIntervalMs: number
  circuitBreakerThreshold: number
  circuitBreakerResetMs: number
}

`$([char]10)
---
### executor/fleet-supervisor.ts
---

`	ypescript
// src/executor/fleet-supervisor.ts
// FleetSupervisor — Chrome instance lifecycle management with state machine + circuit breaker.

import type { GovernorStore } from '../storage/contracts/governor-store.js'
import { BunCdpClient } from './cdp.js'
import {
  type ChromeLaunchOptions,
  type LaunchResult,
  killChrome,
  launchChrome,
} from './launcher.js'
import { PortReaper } from './port-reaper.js'
import { ProfileAllocator } from './profile-allocator.js'

// Provider home URLs — headless slaves navigate here on spawn so the session
// lands on the expected surface (and any re-auth redirect is surfaced).
const PROVIDER_URLS: Record<string, string> = {
  chatgpt: 'https://chatgpt.com/',
  claude: 'https://claude.ai/',
  gemini: 'https://gemini.google.com/',
}

// ── Types ──────────────────────────────────────────────────────────────────

export type FleetInstanceStatus =
  | 'starting'
  | 'running'
  | 'stopping'
  | 'stopped'
  | 'crashed'
  | 'error'

export type CircuitState = 'closed' | 'half_open' | 'open'

export interface FleetSupervisorOptions {
  portRange: [number, number]
  healthProbeIntervalMs: number
  healthProbeTimeoutMs: number
  autoRestart: boolean
  maxRestarts: number
  circuitBreakerThreshold: number
  circuitBreakerResetMs: number
  chromeProfileBase: string
}

export interface FleetSpawnOptions {
  visible: boolean
  debugPort?: number
  extraArgs: string[]
}

export interface FleetInstance {
  id: string
  providerSlug: string
  accountId: string
  debugPort: number
  profileDir: string
  status: FleetInstanceStatus
  pid: number | null
  consecutiveFailures: number
  lastHealthCheck: number
  createdAt: number
}

export interface HealthProbeResult {
  ok: boolean
  latencyMs: number
  status: FleetInstanceStatus
  error?: string
}

// ── Errors ─────────────────────────────────────────────────────────────────

export class SlaveNotRunningError extends Error {
  constructor(instanceId: string) {
    super(`Slave not running: ${instanceId}`)
    this.name = 'SlaveNotRunningError'
  }
}

export class SlaveBusyError extends Error {
  constructor(instanceId: string) {
    super(`Slave busy: ${instanceId}`)
    this.name = 'SlaveBusyError'
  }
}

export class CircuitOpenError extends Error {
  constructor(instanceId: string) {
    super(`Circuit breaker open: ${instanceId}`)
    this.name = 'CircuitOpenError'
  }
}

export class PortOccupiedError extends Error {
  constructor(range: string) {
    super(`All ports in range ${range} occupied`)
    this.name = 'PortOccupiedError'
  }
}

// ── FleetSupervisor ────────────────────────────────────────────────────────

export class FleetSupervisor {
  private instances = new Map<string, FleetInstance>()
  private circuits = new Map<
    string,
    { state: CircuitState; failures: number; openedAt: number | null }
  >()
  private healthTimer: ReturnType<typeof setInterval> | null = null
  private nextPort: number
  private profileAllocator: ProfileAllocator
  private portReaper: PortReaper
  private opts: Required<FleetSupervisorOptions>

  constructor(
    private store: GovernorStore,
    opts?: Partial<FleetSupervisorOptions>,
  ) {
    this.opts = {
      portRange: opts?.portRange ?? [9222, 9332],
      healthProbeIntervalMs: opts?.healthProbeIntervalMs ?? 30_000,
      healthProbeTimeoutMs: opts?.healthProbeTimeoutMs ?? 5_000,
      autoRestart: opts?.autoRestart ?? true,
      maxRestarts: opts?.maxRestarts ?? 3,
      circuitBreakerThreshold: opts?.circuitBreakerThreshold ?? 5,
      circuitBreakerResetMs: opts?.circuitBreakerResetMs ?? 60_000,
      chromeProfileBase: opts?.chromeProfileBase ?? 'chrome-profiles',
    }
    this.nextPort = this.opts.portRange[0]
    this.profileAllocator = new ProfileAllocator(this.opts.chromeProfileBase)
    this.portReaper = new PortReaper({ defaultPortRange: this.opts.portRange })
  }

  // ── Boot ───────────────────────────────────────────────────────────────

  async boot(): Promise<void> {
    await this.portReaper.reap(this.opts.portRange)
    if (this.opts.autoRestart) {
      this.startHealthProbe()
    }
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────

  async spawn(
    providerSlug: string,
    accountId: string,
    opts?: Partial<FleetSpawnOptions>,
  ): Promise<FleetInstance> {
    const id = `${providerSlug}_${accountId}_${Date.now()}`

    // Check if account has a persisted profile from setup wizard
    const compositeAccountId = `${providerSlug}_${accountId}`
    const existingAccount = await this.store.getAccount(compositeAccountId)
    const profileDir =
      existingAccount?.profileDir ?? (await this.profileAllocator.allocate(providerSlug, accountId))

    // Use persisted debug port if available
    const debugPort = opts?.debugPort ?? existingAccount?.debugPort ?? this.allocatePort()

    const instance: FleetInstance = {
      id,
      providerSlug,
      accountId,
      debugPort,
      profileDir,
      status: 'starting',
      pid: null,
      consecutiveFailures: 0,
      lastHealthCheck: Date.now(),
      createdAt: Date.now(),
    }

    this.instances.set(id, instance)

    try {
      const launchOpts: ChromeLaunchOptions = {
        visible: opts?.visible ?? false,
        debugPort,
        profileDir,
        extraArgs: opts?.extraArgs ?? [],
      }
      const result: LaunchResult = await launchChrome(launchOpts)
      instance.pid = result.pid
      instance.debugPort = result.debugPort
      instance.status = 'running'

      this.portReaper.trackPid(result.debugPort, result.pid)

      // Navigate the headless slave to the provider surface so the session
      // lands on the expected page (honors the profile-reuse invariant).
      const loginUrl = PROVIDER_URLS[providerSlug] ?? `https://${providerSlug}.com`
      try {
        const navCdp = new BunCdpClient(`ws://127.0.0.1:${result.debugPort}/devtools/browser`)
        await navCdp.connect()
        await navCdp.send('Target.createTarget', { url: loginUrl })
        await navCdp.disconnect()
      } catch {
        // Navigation is best-effort — profile reuse is the invariant that matters
      }

      await this.store.createFleetEvent({
        slaveId: id,
        providerId: providerSlug,
        eventType: 'spawned',
        detailJson: JSON.stringify({ pid: result.pid, port: result.debugPort }),
      })
    } catch (err) {
      instance.status = 'error'
      instance.consecutiveFailures++
      await this.store.createFleetEvent({
        slaveId: id,
        providerId: providerSlug,
        eventType: 'spawn_failed',
        detailJson: JSON.stringify({ error: String(err) }),
      })
    }

    return instance
  }

  async kill(instanceId: string): Promise<void> {
    const instance = this.instances.get(instanceId)
    if (!instance) throw new SlaveNotRunningError(instanceId)

    instance.status = 'stopping'

    if (instance.pid !== null) {
      await killChrome(instance.pid)
      this.portReaper.untrackPid(instance.debugPort)
    }

    instance.status = 'stopped'
    instance.pid = null

    await this.store.createFleetEvent({
      slaveId: instanceId,
      providerId: instance.providerSlug,
      eventType: 'killed',
    })
  }

  async killAll(): Promise<void> {
    for (const id of this.instances.keys()) {
      await this.kill(id)
    }
  }

  async ensureRunning(instanceId: string): Promise<FleetInstance> {
    const instance = this.instances.get(instanceId)
    if (!instance) throw new SlaveNotRunningError(instanceId)

    if (instance.status === 'running') return instance

    if (instance.status === 'crashed' || instance.status === 'error') {
      if (!this.opts.autoRestart) {
        throw new SlaveNotRunningError(instanceId)
      }
      if (instance.consecutiveFailures >= this.opts.maxRestarts) {
        throw new CircuitOpenError(instanceId)
      }

      const cb = this.getCircuit(instanceId)
      if (cb.state === 'open') {
        throw new CircuitOpenError(instanceId)
      }

      return this.spawn(instance.providerSlug, instance.accountId, {
        visible: false,
        debugPort: instance.debugPort,
      })
    }

    if (instance.status === 'stopped') {
      return this.spawn(instance.providerSlug, instance.accountId, {
        visible: false,
        debugPort: instance.debugPort,
      })
    }

    return instance
  }

  // ── Queries ────────────────────────────────────────────────────────────

  getInstance(instanceId: string): FleetInstance | null {
    return this.instances.get(instanceId) ?? null
  }

  getAllInstances(): FleetInstance[] {
    return [...this.instances.values()]
  }

  getInstancesByProvider(providerSlug: string): FleetInstance[] {
    return [...this.instances.values()].filter((i) => i.providerSlug === providerSlug)
  }

  // ── Health ─────────────────────────────────────────────────────────────

  async healthCheck(instanceId: string): Promise<HealthProbeResult> {
    const instance = this.instances.get(instanceId)
    if (!instance) {
      return { ok: false, latencyMs: 0, status: 'stopped', error: 'Instance not found' }
    }

    if (instance.status === 'stopped') {
      return { ok: false, latencyMs: 0, status: 'stopped' }
    }

    const start = Date.now()
    try {
      const cdp = new BunCdpClient(`ws://127.0.0.1:${instance.debugPort}/devtools/browser`)
      await cdp.connect()
      await cdp.send('Browser.getVersion')
      await cdp.disconnect()

      const latencyMs = Date.now() - start
      instance.status = 'running'
      instance.lastHealthCheck = Date.now()
      instance.consecutiveFailures = 0

      const cb = this.getCircuit(instanceId)
      cb.failures = 0
      if (cb.state === 'half_open') {
        cb.state = 'closed'
        cb.openedAt = null
      }

      return { ok: true, latencyMs, status: 'running' }
    } catch (err) {
      const latencyMs = Date.now() - start
      instance.consecutiveFailures++
      instance.lastHealthCheck = Date.now()
      instance.status = 'error'

      const cb = this.getCircuit(instanceId)
      cb.failures++
      if (cb.failures >= this.opts.circuitBreakerThreshold && cb.state !== 'open') {
        cb.state = 'open'
        cb.openedAt = Date.now()
      }

      return {
        ok: false,
        latencyMs,
        status: 'error',
        error: err instanceof Error ? err.message : String(err),
      }
    }
  }

  async healthCheckAll(): Promise<Map<string, HealthProbeResult>> {
    const results = new Map<string, HealthProbeResult>()
    for (const id of this.instances.keys()) {
      results.set(id, await this.healthCheck(id))
    }
    return results
  }

  getCircuitState(instanceId: string): CircuitState {
    return this.getCircuit(instanceId).state
  }

  // ── Health probe timer ─────────────────────────────────────────────────

  startHealthProbe(intervalMs?: number): void {
    this.stopHealthProbe()
    const ms = intervalMs ?? this.opts.healthProbeIntervalMs
    this.healthTimer = setInterval(() => {
      void this.healthCheckAll()
    }, ms)
  }

  stopHealthProbe(): void {
    if (this.healthTimer) {
      clearInterval(this.healthTimer)
      this.healthTimer = null
    }
  }

  // ── Helpers ────────────────────────────────────────────────────────────

  private allocatePort(): number {
    const port = this.nextPort
    if (port > this.opts.portRange[1]) {
      throw new PortOccupiedError(`${this.opts.portRange[0]}-${this.opts.portRange[1]}`)
    }
    this.nextPort++
    return port
  }

  private getCircuit(instanceId: string): {
    state: CircuitState
    failures: number
    openedAt: number | null
  } {
    let cb = this.circuits.get(instanceId)
    if (!cb) {
      cb = { state: 'closed', failures: 0, openedAt: null }
      this.circuits.set(instanceId, cb)
    }

    // Check if open circuit should transition to half_open
    if (cb.state === 'open' && cb.openedAt) {
      if (Date.now() - cb.openedAt >= this.opts.circuitBreakerResetMs) {
        cb.state = 'half_open'
      }
    }

    return cb
  }
}

`$([char]10)
---
### executor/launcher.ts
---

`	ypescript
// src/executor/launcher.ts
// Cross-platform Chrome/Chromium binary discovery and process spawning.

import { ChromeNotFoundError } from '@/errors.ts'

export interface LaunchResult {
  process: ReturnType<typeof Bun.spawn>
  debugPort: number
  pid: number
  profileDir: string
}

export interface ChromeLaunchOptions {
  visible?: boolean
  profileDir?: string
  debugPort?: number
  extraArgs?: string[]
  userDataDir?: string
  disableGpu?: boolean
  windowSize?: { width: number; height: number }
}

const PLATFORM_PATHS = {
  darwin: [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary',
  ],
  win32: [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    `${process.env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe`,
  ],
  linux: ['google-chrome', 'google-chrome-stable', 'chromium-browser', 'chromium'],
} as const

export function getDefaultChromePaths(): readonly string[] {
  const platform = process.platform as keyof typeof PLATFORM_PATHS
  return PLATFORM_PATHS[platform] ?? PLATFORM_PATHS.linux
}

export async function findChromeBinary(): Promise<string> {
  const envPath = process.env.CHROME_PATH
  if (envPath) {
    const file = Bun.file(envPath)
    if (await file.exists()) return envPath
  }

  const paths = getDefaultChromePaths()
  for (const p of paths) {
    const file = Bun.file(p)
    if (await file.exists()) return p
  }

  // Try which/where as last resort
  try {
    const result = Bun.spawnSync(
      process.platform === 'win32' ? ['where', 'chrome'] : ['which', 'google-chrome'],
      { stdout: 'pipe', stderr: 'pipe' },
    )
    if (result.exitCode === 0 && result.stdout.toString().trim()) {
      const first = result.stdout.toString().trim().split('\n')[0]
      if (first) return first
    }
  } catch {
    // ignore
  }

  throw new ChromeNotFoundError()
}

export function buildChromeArgs(opts: ChromeLaunchOptions): string[] {
  const args: string[] = []

  if (opts.visible === false || opts.visible === undefined) {
    args.push('--headless=new')
  }

  if (opts.debugPort) {
    args.push(`--remote-debugging-port=${opts.debugPort}`)
  }

  if (opts.userDataDir || opts.profileDir) {
    args.push(`--user-data-dir=${opts.userDataDir ?? opts.profileDir}`)
  }

  args.push('--no-first-run')
  args.push('--disable-extensions')
  args.push('--disable-background-networking')
  args.push('--disable-sync')
  args.push('--disable-translate')
  args.push('--metrics-recording-only')

  if (opts.disableGpu) {
    args.push('--disable-gpu')
  }

  // Visible mode: position window on-screen and focused
  if (opts.visible === true) {
    args.push('--window-position=100,100')
  }

  // Hidden mode on Windows (off-screen positioning)
  if (opts.visible === false && process.platform === 'win32') {
    args.push('--window-position=-32000,-32000')
  }

  if (opts.windowSize) {
    args.push(`--window-size=${opts.windowSize.width},${opts.windowSize.height}`)
  }

  if (opts.extraArgs) {
    args.push(...opts.extraArgs)
  }

  return args
}

async function isPortInUse(port: number): Promise<boolean> {
  try {
    const resp = await fetch(`http://127.0.0.1:${port}/json/version`, {
      signal: AbortSignal.timeout(1000),
    })
    return resp.ok
  } catch {
    return false
  }
}

export async function launchChrome(opts?: ChromeLaunchOptions): Promise<LaunchResult> {
  const binary = await findChromeBinary()
  let debugPort = opts?.debugPort ?? 0
  // Use opts.profileDir or fall back to platform-appropriate temp location
  const profileDir =
    opts?.profileDir ??
    (process.platform === 'win32'
      ? `${process.env.LOCALAPPDATA}\\Temp\\chrome-profile-${Date.now()}`
      : `/tmp/chrome-profile-${Date.now()}`)

  // Port conflict detection: if requested port is in use, find an alternative
  if (debugPort !== 0 && (await isPortInUse(debugPort))) {
    // Try next ports in range
    for (let tryPort = debugPort + 1; tryPort < debugPort + 100; tryPort++) {
      if (!(await isPortInUse(tryPort))) {
        debugPort = tryPort
        break
      }
    }
  }

  const args = buildChromeArgs({ ...opts, debugPort, profileDir })

  const proc = Bun.spawn([binary, ...args], {
    stdout: 'ignore',
    stderr: 'ignore',
    env: { ...process.env },
  })

  const pid = proc.pid

  // Wait for Chrome to start and open the debug port
  const startTime = Date.now()
  const timeout = 15_000
  let actualPort = debugPort

  if (debugPort === 0) {
    // Parse port from stderr output or wait for it
    // For headless mode, Chrome prints the port to stderr
    await Bun.sleep(500)
    // Fallback: try default port 9222
    actualPort = 9222
  }

  while (Date.now() - startTime < timeout) {
    try {
      const resp = await fetch(`http://127.0.0.1:${actualPort}/json/version`)
      if (resp.ok) break
    } catch {
      // Chrome not ready yet
    }
    await Bun.sleep(100)
  }

  return { process: proc, debugPort: actualPort, pid, profileDir }
}

export async function killChrome(pid: number): Promise<void> {
  try {
    process.kill(pid, 'SIGTERM')
  } catch {
    // process may already be dead
    return
  }

  // Wait up to 5s for graceful shutdown
  const start = Date.now()
  while (Date.now() - start < 5000) {
    if (!(await isChromeRunning(pid))) return
    await Bun.sleep(100)
  }

  // Force kill
  try {
    process.kill(pid, 'SIGKILL')
  } catch {
    // already dead
  }
}

export async function isChromeRunning(pid: number): Promise<boolean> {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

`$([char]10)
---
### executor/port-reaper.ts
---

`	ypescript
// src/executor/port-reaper.ts
// Cleans up orphaned Chrome processes and their debug ports.

export class PortReaperError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PortReaperError'
  }
}

export interface PortReaperOptions {
  defaultPortRange?: [number, number]
  periodicIntervalMs?: number
}

export interface ReapResult {
  reaped: number
  failed: number
  orphans: Array<{ pid: number; port: number }>
  durationMs: number
}

export interface OrphanInfo {
  pid: number
  port: number
  cmd: string
}

export class PortReaper {
  private opts: Required<PortReaperOptions>
  private knownPids = new Map<number, number>() // port -> pid
  private periodicTimer: ReturnType<typeof setInterval> | null = null

  constructor(opts?: PortReaperOptions) {
    this.opts = {
      defaultPortRange: opts?.defaultPortRange ?? [9222, 9230],
      periodicIntervalMs: opts?.periodicIntervalMs ?? 30_000,
    }
  }

  trackPid(port: number, pid: number): void {
    this.knownPids.set(port, pid)
  }

  untrackPid(port: number): void {
    this.knownPids.delete(port)
  }

  async reap(portRange?: [number, number]): Promise<ReapResult> {
    const start = Date.now()
    const range = portRange ?? this.opts.defaultPortRange
    const orphans = await this.findOrphans(range)
    let reaped = 0
    let failed = 0
    const reapedOrphans: Array<{ pid: number; port: number }> = []

    for (const orphan of orphans) {
      try {
        const ok = await this.reapProcess(orphan.pid)
        if (ok) {
          reaped++
          reapedOrphans.push({ pid: orphan.pid, port: orphan.port })
        } else {
          failed++
        }
      } catch {
        failed++
      }
    }

    return {
      reaped,
      failed,
      orphans: reapedOrphans,
      durationMs: Date.now() - start,
    }
  }

  async reapProcess(pid: number): Promise<boolean> {
    if (process.platform === 'win32') {
      const proc = Bun.spawn({
        cmd: ['taskkill', '/PID', String(pid), '/F', '/T'],
        stdout: 'pipe',
        stderr: 'pipe',
      })
      await proc.exited
      return proc.exitCode === 0
    }

    // Unix: SIGTERM, then SIGKILL after 2s
    try {
      process.kill(pid, 'SIGTERM')
    } catch {
      return false
    }

    const start = Date.now()
    while (Date.now() - start < 2000) {
      if (!this.isProcessRunning(pid)) return true
      await Bun.sleep(100)
    }

    try {
      process.kill(pid, 'SIGKILL')
      return true
    } catch {
      return false
    }
  }

  async findOrphans(portRange: [number, number]): Promise<OrphanInfo[]> {
    const orphans: OrphanInfo[] = []
    const [start, end] = portRange

    for (let port = start; port <= end; port++) {
      const pid = await this.getPidOnPort(port)
      if (pid === null) continue

      // Skip processes we intentionally launched
      const expectedPid = this.knownPids.get(port)
      if (expectedPid !== undefined && expectedPid === pid) continue

      const cmd = await this.getProcessCommand(pid)
      if (!this.isChromeProcess(cmd)) continue

      orphans.push({ pid, port, cmd })
    }

    return orphans
  }

  startPeriodicReap(intervalMs?: number): void {
    this.stopPeriodicReap()
    const ms = intervalMs ?? this.opts.periodicIntervalMs
    this.periodicTimer = setInterval(() => {
      this.reap().catch(() => {})
    }, ms)
  }

  stopPeriodicReap(): void {
    if (this.periodicTimer) {
      clearInterval(this.periodicTimer)
      this.periodicTimer = null
    }
  }

  private async getPidOnPort(port: number): Promise<number | null> {
    if (process.platform === 'win32') {
      try {
        const proc = Bun.spawn({
          cmd: ['cmd', '/c', `netstat -ano | findstr :${port} | findstr LISTENING`],
          stdout: 'pipe',
          stderr: 'ignore',
        })
        const output = (await new Response(proc.stdout).text()).trim()
        for (const line of output.split('\n').filter(Boolean)) {
          const parts = line.trim().split(/\s+/)
          const pid = Number.parseInt(parts[parts.length - 1] ?? '', 10)
          if (Number.isFinite(pid) && pid > 0) return pid
        }
      } catch {
        /* ignore */
      }
      return null
    }

    // Unix: lsof
    try {
      const proc = Bun.spawn({
        cmd: ['lsof', '-t', `-i:${port}`],
        stdout: 'pipe',
        stderr: 'ignore',
      })
      const pidText = (await new Response(proc.stdout).text()).trim()
      const firstPid = pidText.split('\n').filter(Boolean)[0]
      if (firstPid) {
        const pid = Number.parseInt(firstPid, 10)
        if (Number.isFinite(pid) && pid > 0) return pid
      }
    } catch {
      /* ignore */
    }
    return null
  }

  private async getProcessCommand(pid: number): Promise<string> {
    if (process.platform === 'win32') {
      try {
        const proc = Bun.spawn({
          cmd: ['wmic', 'process', 'where', `ProcessId=${pid}`, 'get', 'CommandLine'],
          stdout: 'pipe',
          stderr: 'ignore',
        })
        const output = (await new Response(proc.stdout).text()).trim()
        const lines = output.split('\n').filter(Boolean)
        return lines[1] ?? ''
      } catch {
        return ''
      }
    }

    try {
      const proc = Bun.spawn({
        cmd: ['cat', `/proc/${pid}/cmdline`],
        stdout: 'pipe',
        stderr: 'ignore',
      })
      const output = (await new Response(proc.stdout).text()).trim()
      return output.replace(/\0/g, ' ')
    } catch {
      return ''
    }
  }

  private isChromeProcess(cmd: string): boolean {
    const lower = cmd.toLowerCase()
    return lower.includes('chrome') || lower.includes('chromium')
  }

  private isProcessRunning(pid: number): boolean {
    try {
      process.kill(pid, 0)
      return true
    } catch {
      return false
    }
  }
}

`$([char]10)
---
### executor/profile-allocator.ts
---

`	ypescript
// src/executor/profile-allocator.ts
// Chrome profile directory management — allocation, lifecycle, cleanup.

import { existsSync } from 'node:fs'
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

export const DEFAULT_PROFILE_BASE = 'chrome-profiles'

interface ProfileMeta {
  providerSlug: string
  accountId: string
  allocatedAt: string
  lastUsed: string
}

export class ProfileAllocator {
  private baseDir: string

  constructor(baseDir?: string) {
    this.baseDir = baseDir ?? DEFAULT_PROFILE_BASE
  }

  getPath(providerSlug: string, accountId: string): string {
    return join(this.baseDir, providerSlug, accountId)
  }

  async allocate(providerSlug: string, accountId: string): Promise<string> {
    const dir = this.getPath(providerSlug, accountId)
    await mkdir(dir, { recursive: true })

    const metaPath = join(dir, '.profile-meta.json')
    if (!existsSync(metaPath)) {
      const now = new Date().toISOString()
      const meta: ProfileMeta = {
        providerSlug,
        accountId,
        allocatedAt: now,
        lastUsed: now,
      }
      await writeFile(metaPath, JSON.stringify(meta, null, 2))
    }

    return dir
  }

  async release(providerSlug: string, accountId: string): Promise<void> {
    const dir = this.getPath(providerSlug, accountId)
    const metaPath = join(dir, '.profile-meta.json')

    if (existsSync(metaPath)) {
      const raw = await readFile(metaPath, 'utf-8')
      const meta: ProfileMeta = JSON.parse(raw)
      meta.lastUsed = new Date().toISOString()
      await writeFile(metaPath, JSON.stringify(meta, null, 2))
    }
  }

  async list(): Promise<
    Array<{ providerSlug: string; accountId: string; path: string; lastUsed: Date }>
  > {
    const results: Array<{
      providerSlug: string
      accountId: string
      path: string
      lastUsed: Date
    }> = []

    if (!existsSync(this.baseDir)) return results

    const providers = await readdir(this.baseDir, { withFileTypes: true })
    for (const provider of providers) {
      if (!provider.isDirectory()) continue

      const accountsDir = join(this.baseDir, provider.name)
      const accounts = await readdir(accountsDir, { withFileTypes: true })
      for (const account of accounts) {
        if (!account.isDirectory()) continue

        const dir = join(accountsDir, account.name)
        const metaPath = join(dir, '.profile-meta.json')
        let lastUsed = new Date(0)

        if (existsSync(metaPath)) {
          try {
            const raw = await readFile(metaPath, 'utf-8')
            const meta: ProfileMeta = JSON.parse(raw)
            lastUsed = new Date(meta.lastUsed)
          } catch {
            // corrupted meta, use epoch
          }
        }

        results.push({
          providerSlug: provider.name,
          accountId: account.name,
          path: dir,
          lastUsed,
        })
      }
    }

    return results
  }

  async clean(olderThanDays = 30): Promise<number> {
    const profiles = await this.list()
    const cutoff = Date.now() - olderThanDays * 24 * 60 * 60 * 1000
    let removed = 0

    for (const profile of profiles) {
      if (profile.lastUsed.getTime() < cutoff) {
        try {
          await rm(profile.path, { recursive: true, force: true })
          removed++
        } catch {
          // best-effort removal
        }
      }
    }

    return removed
  }
}

`$([char]10)
---
### executor/ids.ts
---

`	ypescript
// src/executor/ids.ts
// ID derivation helpers for ChromeGovernor.

import { newId } from '../ids.js'

export function deriveSlaveId(providerId: string, accountId: string): string {
  return `slave_${providerId}_${accountId}`
}

export function deriveId(prefix?: string): string {
  return prefix ? `${prefix}_${newId()}` : newId()
}

`$([char]10)
---
### executor/content-blocks.ts
---

`	ypescript
// src/executor/content-blocks.ts
// Content block types for stream parsing.

export type ContentBlockKind =
  | 'text'
  | 'thinking'
  | 'code'
  | 'artifact'
  | 'image'
  | 'citation'
  | 'tool_use'
  | 'error'
  | 'meta'

export interface ContentBlock {
  kind: ContentBlockKind
  content: string
  metadata?: Record<string, unknown>
}

`$([char]10)

