// src/executor/cdp.ts
// Real WebSocket CDP client with auto-reconnect, session management, per-command timeouts, and event subscription.

import { CdpConnectionError, CdpTimeoutError } from '../errors.js'
import { catchDebug } from '../lib/catch-logger.js'
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
    } catch (e) {
      catchDebug(e, 'cdp: message parse failed')
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
            } catch (e) {
              catchDebug(e, 'cdp: event handler error')
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
      } catch (e) {
        catchDebug(e, 'cdp: WS close failed')
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
      } catch (e) {
        catchDebug(e, 'cdp: connect failed, scheduling reconnect')
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
        // [audit] log the error with context here
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
