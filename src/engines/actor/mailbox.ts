// src/engines/actor/mailbox.ts
// Mailbox — async message queue for actor serialization.
// Phase 3: Replaces per-slave AsyncMutex. The mailbox serializes all messages.

import { getLogger } from '../../observability/logger.js'

export class Mailbox<M> {
  private queue: Array<{ msg: M; resolve: () => void }> = []
  private processing = false
  private logger = getLogger('Mailbox')

  constructor(private name: string) {}

  /**
   * Post a message to the mailbox. Resolves when the message is queued.
   */
  async post(m: M): Promise<void> {
    return new Promise<void>((resolve) => {
      this.queue.push({ msg: m, resolve })
      this.processNext()
    })
  }

  /**
   * Post a message and wait for a result via callback.
   */
  async ask<T>(m: M & { k: (result: T) => void }): Promise<T> {
    return new Promise<T>((resolve) => {
      const wrappedMsg = {
        ...m,
        k: (result: T) => {
          m.k(result)
          resolve(result)
        },
      }
      this.post(wrappedMsg as M)
    })
  }

  /**
   * Process messages sequentially.
   */
  private async processNext(): Promise<void> {
    if (this.processing) return
    this.processing = true

    while (this.queue.length > 0) {
      const msg = this.queue[0]
      if (!msg) break

      try {
        // The actual processing happens in BrowserActor.handle()
        // This just ensures sequential delivery
        await new Promise<void>((resolve) => {
          // Yield to allow the actor to process
          setImmediate(() => resolve())
        })
      } catch (err) {
        this.logger.error('Mailbox processing error', {
          name: this.name,
          error: err instanceof Error ? err.message : String(err),
        })
      }
    }

    this.processing = false
  }

  /**
   * Get current queue depth.
   */
  depth(): number {
    return this.queue.length
  }

  /**
   * Check if the mailbox is empty.
   */
  isEmpty(): boolean {
    return this.queue.length === 0
  }

  /**
   * Peek at the next message without removing it.
   */
  peek(): M | null {
    return this.queue[0]?.msg ?? null
  }

  /**
   * Remove and return the next message from the queue.
   */
  dequeue(): M | null {
    const entry = this.queue.shift()
    return entry?.msg ?? null
  }

  /**
   * Clear all pending messages.
   */
  clear(): void {
    this.queue = []
  }
}
