// src/engines/actor/browser-actor.ts
// BrowserActor — autonomous actor for a single Chrome slave.
// Phase 3: Each browser becomes an autonomous actor with lifecycle, health,
// and recovery ownership. State isolation enforced — actors never reference
// each other's BrowserSession.

import type { SlaveLifecycle } from '../../executor/slave-states.js'
import type { BrowserSession } from '../runtime/browser-runtime.js'
import { BrowserRuntime } from '../runtime/browser-runtime.js'
import { Mailbox } from './mailbox.js'
import type { ActorMsg, FailureClass, RecoveryStrategy } from './messages.js'
import { getLogger } from '../../observability/logger.js'
import { getMetrics } from '../../observability/metrics.js'

export class BrowserActor {
  private mailbox: Mailbox<ActorMsg>
  private _state: SlaveLifecycle = 'starting'
  private processing = false
  private logger: ReturnType<typeof getLogger>
  private metrics = getMetrics()
  private crashHandler?: (slaveId: string, cause: FailureClass) => void
  private recoverHandler?: (slaveId: string, strategy: RecoveryStrategy) => void

  constructor(
    private slaveId: string,
    private runtime: BrowserRuntime,
    private debugPort: number,
  ) {
    this.mailbox = new Mailbox<ActorMsg>(`actor:${slaveId}`)
    this.logger = getLogger(`BrowserActor:${slaveId}`)
  }

  /**
   * Start the actor's message processing loop.
   */
  start(): void {
    this.logger.info('Actor starting', { slaveId: this.slaveId })
    this.processMessages()
  }

  /**
   * Get the current actor state.
   */
  state(): SlaveLifecycle {
    return this._state
  }

  /**
   * Post a message and wait for result (ask pattern).
   */
  async ask<T>(msg: ActorMsg & { k: (result: T) => void }): Promise<T> {
    return this.mailbox.ask(msg)
  }

  /**
   * Post a message (fire-and-forget).
   */
  async tell(msg: ActorMsg): Promise<void> {
    return this.mailbox.post(msg)
  }

  /**
   * Register crash handler.
   */
  onCrash(handler: (slaveId: string, cause: FailureClass) => void): void {
    this.crashHandler = handler
  }

  /**
   * Register recovery handler.
   */
  onRecover(handler: (slaveId: string, strategy: RecoveryStrategy) => void): void {
    this.recoverHandler = handler
  }

  /**
   * Handle a message (dispatch to appropriate handler).
   */
  async handle(msg: ActorMsg): Promise<void> {
    switch (msg.t) {
      case 'EnsureRunning':
        await this.handleEnsureRunning()
        break

      case 'Evaluate':
        try {
          const session = this.runtime.for(this.slaveId)
          const result = await session.cdp.send('Runtime.evaluate', { expression: msg.expr })
          msg.k(result)
        } catch (err) {
          this.logger.error('Evaluate failed', { error: err instanceof Error ? err.message : String(err) })
          msg.k(null)
        }
        break

      case 'CdpMethod':
        try {
          const session = this.runtime.for(this.slaveId)
          const result = await session.cdp.send(msg.method, msg.params)
          msg.k(result)
        } catch (err) {
          this.logger.error('CDP method failed', { method: msg.method, error: err instanceof Error ? err.message : String(err) })
          msg.k(null)
        }
        break

      case 'Screenshot':
        try {
          const session = this.runtime.for(this.slaveId)
          const result = await session.cdp.captureScreenshot(msg.format)
          msg.k(result)
        } catch (err) {
          this.logger.error('Screenshot failed', { error: err instanceof Error ? err.message : String(err) })
          msg.k('')
        }
        break

      case 'HealthProbe':
        try {
          const session = this.runtime.for(this.slaveId)
          const result = await session.health.check(session.cdp)
          msg.k(result.ok)
        } catch (err) {
          msg.k(false)
        }
        break

      case 'Shutdown':
        await this.handleShutdown()
        break

      case 'Crash':
        await this.handleCrash(msg.cause)
        break

      case 'Recover':
        await this.handleRecover(msg.strategy)
        break
    }
  }

  private async handleEnsureRunning(): Promise<void> {
    if (this._state === 'running') return

    try {
      this._state = 'starting'
      await this.runtime.acquire(this.slaveId, this.debugPort)
      this._state = 'running'
      this.logger.info('Slave running', { slaveId: this.slaveId })
      this.metrics.incCounter('chrome_spawn_total', { result: 'success' })
    } catch (err) {
      this._state = 'error'
      this.logger.error('Failed to start slave', { slaveId: this.slaveId, error: err instanceof Error ? err.message : String(err) })
      this.metrics.incCounter('chrome_spawn_total', { result: 'failure' })
    }
  }

  private async handleShutdown(): Promise<void> {
    this.logger.info('Actor shutting down', { slaveId: this.slaveId })
    this._state = 'stopped'
    this.runtime.release(this.slaveId)
    this.mailbox.clear()
  }

  private async handleCrash(cause: FailureClass): Promise<void> {
    this.logger.warn('Actor crash', { slaveId: this.slaveId, cause })
    this._state = 'error'
    this.crashHandler?.(this.slaveId, cause)
  }

  private async handleRecover(strategy: RecoveryStrategy): Promise<void> {
    this.logger.info('Actor recovering', { slaveId: this.slaveId, strategy })
    this._state = 'restarting'
    this.recoverHandler?.(this.slaveId, strategy)
  }

  private async processMessages(): Promise<void> {
    if (this.processing) return
    this.processing = true

    while (true) {
      const msg = await this.getNextMessage()
      if (!msg) break

      try {
        await this.handle(msg)
      } catch (err) {
        this.logger.error('Message handling error', {
          slaveId: this.slaveId,
          message: msg.t,
          error: err instanceof Error ? err.message : String(err),
        })
      }
    }

    this.processing = false
  }

  private async getNextMessage(): Promise<ActorMsg | null> {
    return new Promise((resolve) => {
      const check = () => {
        if (!this.mailbox.isEmpty()) {
          // Peek at the message without removing it
          const msg = (this.mailbox as any).queue[0]?.msg
          if (msg) {
            ;(this.mailbox as any).queue.shift()
            resolve(msg)
          } else {
            resolve(null)
          }
        } else if (this._state === 'stopped') {
          resolve(null)
        } else {
          setTimeout(check, 10)
        }
      }
      check()
    })
  }

  /**
   * Get mailbox depth.
   */
  getMailboxDepth(): number {
    return this.mailbox.depth()
  }
}
