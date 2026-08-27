/**
 * VIVIM Tunnel Client — Connection Manager
 *
 * Manages the WebSocket connection lifecycle: connect, reconnect, disconnect.
 * Coordinates heartbeat, request handler, and reconnection manager.
 */

import { EventEmitter } from 'node:events'
import { TUNNEL_CLOSE_CODES } from '../tunnel-shared/constants.js'
import { TunnelAuthError, TunnelConnectionError } from '../tunnel-shared/errors.js'
import { getLogger } from '../tunnel-shared/logger.js'
import type { VivimConfig } from '../tunnel-shared/types.js'
import { createStatusFrame, decodeFrame, encodeFrame } from './frame-protocol.js'
import { Heartbeat } from './heartbeat.js'
import { ReconnectionManager } from './reconnection.js'
import { RequestHandler } from './request-handler.js'
import type {
  AssignedFrame,
  ErrorFrame,
  HttpRequestFrame,
  TunnelConfig,
  TunnelConnectionState,
  TunnelMetrics,
} from './types.js'

const log = getLogger('connection-manager')

export interface ConnectionManagerEvents {
  connected: (subdomain: string) => void
  disconnected: (reason: string, code: number) => void
  stateChanged: (state: TunnelConnectionState) => void
  error: (error: Error) => void
}

export class ConnectionManager extends EventEmitter {
  private config: TunnelConfig
  private ws: WebSocket | null = null
  private state: TunnelConnectionState = 'disconnected'
  private assignedSubdomain: string | null = null
  private metrics: TunnelMetrics
  private heartbeat: Heartbeat | null = null
  private reconnection: ReconnectionManager | null = null
  private requestHandler: RequestHandler | null = null
  private statusTimer: ReturnType<typeof setInterval> | null = null
  private startedAt = 0

  constructor(config: VivimConfig) {
    super()
    this.config = config.tunnel

    this.metrics = {
      totalRequests: 0,
      totalResponses: 0,
      totalBytesIn: 0,
      totalBytesOut: 0,
      averageLatencyMs: 0,
      reconnectCount: 0,
      uptimeSeconds: 0,
      lastPingLatencyMs: null,
    }
  }

  async connect(): Promise<void> {
    if (this.state === 'connected' || this.state === 'connecting') {
      log.warn({ state: this.state }, 'Already connected or connecting')
      return
    }

    this.setState('connecting')

    try {
      const url = this.config.serverUrl
      log.info({ url, subdomain: this.config.subdomain }, 'Connecting to tunnel server')

      // Build upgrade headers — gateway expects Authorization + X-Subdomain
      const headers: Record<string, string> = {}
      if (this.config.authToken) {
        headers.Authorization = `Bearer ${this.config.authToken}`
      }
      if (this.config.subdomain) {
        headers['X-Subdomain'] = this.config.subdomain
      }

      // Bun's WebSocket constructor types only expose subprotocols; headers are
      // supported at runtime (used by the tunnel gateway for auth/subdomain).
      const ws = new WebSocket(url, { headers } as unknown as string | string[])

      await new Promise<void>((resolve, reject) => {
        const connectTimeout = setTimeout(() => {
          reject(new TunnelConnectionError('Connection timeout'))
        }, 10_000)

        ws.addEventListener('open', () => {
          clearTimeout(connectTimeout)
          resolve()
        })

        ws.addEventListener('error', (event) => {
          clearTimeout(connectTimeout)
          reject(new TunnelConnectionError(`WebSocket error: ${String(event)}`))
        })
      })

      this.ws = ws
      this.setupEventHandlers()
      this.startedAt = Date.now()

      log.info('WebSocket connection established, waiting for assignment')
    } catch (err) {
      this.setState('disconnected')
      const error = err instanceof Error ? err : new Error(String(err))
      this.emit('error', error)

      // Start reconnection if not auth error
      if (!(error instanceof TunnelAuthError)) {
        this.startReconnection()
      }

      throw error
    }
  }

  private setupEventHandlers(): void {
    if (!this.ws) return

    this.ws.addEventListener('message', (event) => {
      try {
        const frame = decodeFrame(event.data as string)
        this.handleFrame(frame)
      } catch (err) {
        log.error({ err }, 'Failed to handle incoming frame')
      }
    })

    this.ws.addEventListener('close', (event) => {
      const { code, reason } = event
      log.info({ code, reason: String(reason) }, 'WebSocket closed')

      this.handleDisconnect(String(reason), code)
    })

    this.ws.addEventListener('error', (event) => {
      log.error({ event: String(event) }, 'WebSocket error')
    })
  }

  private handleFrame(frame: unknown): void {
    const frameType = (frame as Record<string, string>).type

    switch (frameType) {
      case 'assigned':
        this.handleAssigned(frame as AssignedFrame)
        break
      case 'http.request':
        this.handleHttpRequest(frame as HttpRequestFrame)
        break
      case 'pong':
        this.heartbeat?.onPong()
        break
      case 'error':
        this.handleErrorFrame(frame as ErrorFrame)
        break
      default:
        log.debug({ type: frameType }, 'Ignoring unknown frame type')
    }
  }

  private handleAssigned(frame: AssignedFrame): void {
    this.assignedSubdomain = frame.subdomain
    this.setState('connected')

    log.info(
      { subdomain: frame.subdomain, relayUrl: frame.relayUrl },
      'Subdomain assigned, tunnel active',
    )

    // Initialize subsystems
    this.heartbeat = new Heartbeat(
      (data) => this.send(data),
      () => this.onHeartbeatTimeout(),
      this.metrics,
      {
        intervalMs: this.config.heartbeatIntervalMs,
        timeoutMs: this.config.heartbeatTimeoutMs,
      },
    )
    this.heartbeat.start()

    this.requestHandler = new RequestHandler((data) => this.send(data), this.metrics, {
      localServerUrl: `http://127.0.0.1:${8080}`,
      requestTimeoutMs: this.config.requestTimeoutMs,
      maxConcurrentRequests: this.config.maxConcurrentRequests,
    })

    // Start status reporting
    this.startStatusReporting()

    this.emit('connected', frame.subdomain)
  }

  private handleHttpRequest(frame: HttpRequestFrame): void {
    if (!this.requestHandler) {
      log.warn('Request received before assignment, ignoring')
      return
    }
    this.requestHandler.handleRequest(frame)
  }

  private handleErrorFrame(frame: ErrorFrame): void {
    log.error(
      { code: frame.code, message: frame.message, fatal: frame.fatal },
      'Error frame received from server',
    )

    if (frame.fatal) {
      this.disconnect('Server sent fatal error', 1000)
    }
  }

  private handleDisconnect(reason: string, code: number): void {
    const wasConnected = this.state === 'connected'
    this.setState('disconnected')

    // Clean up subsystems
    this.heartbeat?.stop()
    this.heartbeat = null
    this.requestHandler?.cancelAll('Tunnel disconnected')
    this.requestHandler = null
    this.stopStatusReporting()

    this.ws = null
    this.assignedSubdomain = null

    this.emit('disconnected', reason, code)

    // Auto-reconnect for abnormal close codes
    if (
      wasConnected &&
      code !== TUNNEL_CLOSE_CODES.NORMAL &&
      code !== TUNNEL_CLOSE_CODES.GOING_AWAY
    ) {
      this.metrics.reconnectCount++
      this.startReconnection()
    }
  }

  private onHeartbeatTimeout(): void {
    log.warn('Heartbeat timeout, closing connection')
    this.ws?.close(TUNNEL_CLOSE_CODES.ABNORMAL, 'Heartbeat timeout')
  }

  private startReconnection(): void {
    if (this.reconnection) {
      this.reconnection.stop()
    }

    this.setState('reconnecting')

    this.reconnection = new ReconnectionManager(
      async () => {
        await this.connect()
        this.reconnection?.reset()
      },
      {
        initialDelayMs: this.config.reconnectInitialDelayMs,
        maxDelayMs: this.config.reconnectMaxDelayMs,
        jitterFactor: this.config.reconnectJitterFactor,
      },
    )
    this.reconnection.start()
  }

  private send(data: string): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(data)
    } else {
      log.warn('Attempted to send on closed WebSocket')
    }
  }

  private setState(state: TunnelConnectionState): void {
    this.state = state
    this.emit('stateChanged', state)
  }

  private startStatusReporting(): void {
    this.statusTimer = setInterval(() => {
      const frame = createStatusFrame(
        { running: true, port: 8080, requestCount: this.metrics.totalRequests },
        { running: false, peerCount: 0, relayed: false },
        {
          cpu: 0,
          memory: process.memoryUsage().heapUsed / 1024 / 1024,
          uptime: Math.floor((Date.now() - this.startedAt) / 1000),
        },
      )
      this.send(encodeFrame(frame))
    }, 60_000)
  }

  private stopStatusReporting(): void {
    if (this.statusTimer) {
      clearInterval(this.statusTimer)
      this.statusTimer = null
    }
  }

  // ─── Public API ────────────────────────────────────────────────

  async disconnect(
    reason = 'Client shutdown',
    code: number = TUNNEL_CLOSE_CODES.NORMAL,
  ): Promise<void> {
    log.info({ reason, code }, 'Disconnecting')

    this.reconnection?.stop()
    this.reconnection = null
    this.heartbeat?.stop()
    this.requestHandler?.cancelAll(reason)
    this.stopStatusReporting()

    if (this.ws) {
      this.ws.close(code, reason)
      this.ws = null
    }

    this.assignedSubdomain = null
    this.setState('disconnected')
  }

  getState(): TunnelConnectionState {
    return this.state
  }

  getSubdomain(): string | null {
    return this.assignedSubdomain
  }

  getMetrics(): TunnelMetrics {
    return { ...this.metrics }
  }
}
