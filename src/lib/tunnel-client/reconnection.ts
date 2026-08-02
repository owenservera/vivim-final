/**
 * VIVIM Tunnel Client — Reconnection Manager
 *
 * Exponential backoff with jitter for reconnection attempts.
 * Prevents thundering herd when multiple clients reconnect simultaneously.
 */

import { TUNNEL_DEFAULTS } from '../tunnel-shared/constants.js'
import { getLogger } from '../tunnel-shared/logger.js'

const log = getLogger('reconnection')

export interface ReconnectionConfig {
  initialDelayMs: number
  maxDelayMs: number
  jitterFactor: number
}

const DEFAULT_CONFIG: ReconnectionConfig = {
  initialDelayMs: TUNNEL_DEFAULTS.RECONNECT_INITIAL_DELAY_MS,
  maxDelayMs: TUNNEL_DEFAULTS.RECONNECT_MAX_DELAY_MS,
  jitterFactor: TUNNEL_DEFAULTS.RECONNECT_JITTER_FACTOR,
}

export class ReconnectionManager {
  private config: ReconnectionConfig
  private attempt = 0
  private timer: ReturnType<typeof setTimeout> | null = null
  private connectFn: () => Promise<void>
  private stopped = false

  constructor(connectFn: () => Promise<void>, config?: Partial<ReconnectionConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config }
    this.connectFn = connectFn
  }

  start(): void {
    this.stopped = false
    this.attempt = 0
    this.scheduleNext()
  }

  stop(): void {
    this.stopped = true
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }
    log.debug('Reconnection manager stopped')
  }

  reset(): void {
    this.attempt = 0
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }
  }

  getAttempt(): number {
    return this.attempt
  }

  private scheduleNext(): void {
    if (this.stopped) return

    const delay = this.calculateDelay()
    this.attempt++

    log.info({ attempt: this.attempt, delayMs: delay }, 'Scheduling reconnection attempt')

    this.timer = setTimeout(async () => {
      if (this.stopped) return

      try {
        await this.connectFn()
        // If connectFn succeeds, the caller will call reset()
        log.info({ attempt: this.attempt }, 'Reconnection succeeded')
      } catch (err) {
        log.warn({ attempt: this.attempt, err }, 'Reconnection failed, scheduling next attempt')
        this.scheduleNext()
      }
    }, delay)
  }

  private calculateDelay(): number {
    // Exponential backoff: initialDelay * 2^attempt
    const baseDelay = this.config.initialDelayMs * 2 ** this.attempt

    // Cap at max delay
    const cappedDelay = Math.min(baseDelay, this.config.maxDelayMs)

    // Apply jitter: ±jitterFactor
    const jitterRange = cappedDelay * this.config.jitterFactor
    const jitter = (Math.random() * 2 - 1) * jitterRange

    return Math.max(100, Math.round(cappedDelay + jitter))
  }
}
