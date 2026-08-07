/**
 * VIVIM Tunnel Client — Heartbeat
 *
 * Sends periodic ping frames and monitors for pong responses.
 * If no pong is received within the timeout, triggers reconnection.
 */

import { TUNNEL_DEFAULTS } from '../../lib/tunnel-shared/constants.js'
import { getLogger } from '../../lib/tunnel-shared/logger.js'
import { createPingFrame, encodeFrame } from './frame-protocol.js'
import type { TunnelMetrics } from './types.js'

const log = getLogger('heartbeat')

export interface HeartbeatConfig {
  intervalMs: number
  timeoutMs: number
}

const DEFAULT_CONFIG: HeartbeatConfig = {
  intervalMs: TUNNEL_DEFAULTS.HEARTBEAT_INTERVAL_MS,
  timeoutMs: TUNNEL_DEFAULTS.HEARTBEAT_TIMEOUT_MS,
}

export class Heartbeat {
  private config: HeartbeatConfig
  private intervalTimer: ReturnType<typeof setInterval> | null = null
  private timeoutTimer: ReturnType<typeof setTimeout> | null = null
  private lastPongTime = 0
  private pendingPing = false
  private sendFn: (data: string) => void
  private onTimeout: () => void
  private metrics: TunnelMetrics

  constructor(
    sendFn: (data: string) => void,
    onTimeout: () => void,
    metrics: TunnelMetrics,
    config?: Partial<HeartbeatConfig>,
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config }
    this.sendFn = sendFn
    this.onTimeout = onTimeout
    this.metrics = metrics
  }

  start(): void {
    this.stop()
    log.debug({ intervalMs: this.config.intervalMs }, 'Starting heartbeat')

    this.intervalTimer = setInterval(() => {
      this.sendPing()
    }, this.config.intervalMs)

    // Send first ping immediately
    this.sendPing()
  }

  stop(): void {
    if (this.intervalTimer) {
      clearInterval(this.intervalTimer)
      this.intervalTimer = null
    }
    if (this.timeoutTimer) {
      clearTimeout(this.timeoutTimer)
      this.timeoutTimer = null
    }
    this.pendingPing = false
  }

  onPong(): void {
    this.lastPongTime = Date.now()
    this.pendingPing = false

    if (this.timeoutTimer) {
      clearTimeout(this.timeoutTimer)
      this.timeoutTimer = null
    }

    log.trace('Pong received')
  }

  private sendPing(): void {
    if (this.pendingPing) {
      log.warn('Ping already pending, skipping')
      return
    }

    const latencyHint = this.metrics.latencyMs ?? undefined
    const frame = createPingFrame(latencyHint)
    const encoded = encodeFrame(frame)

    try {
      this.sendFn(encoded)
      this.pendingPing = true

      // Start timeout
      this.timeoutTimer = setTimeout(() => {
        log.warn({ timeoutMs: this.config.timeoutMs }, 'Heartbeat timeout — no pong received')
        this.pendingPing = false
        this.onTimeout()
      }, this.config.timeoutMs)
    } catch (err) {
      log.error({ err }, 'Failed to send ping')
      this.pendingPing = false
    }
  }

  getLastPongTime(): number {
    return this.lastPongTime
  }
}
