// src/engines/chrome/async-mutex.ts
// Simplified async mutex for serializing CDP commands per slave.
//
// Session 6 (2026-08-07): Extracted from chrome-governor.ts.

/**
 * A simple async mutex that serializes access to a shared resource.
 * Used by CDPProxy to ensure only one CDP command is in-flight per slave
 * at a time (CDP is not safe for concurrent commands on the same target).
 */
export class AsyncMutex {
  private locked = false
  private queue: Array<() => void> = []

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
    const next = this.queue.shift()
    if (next) {
      next()
    } else {
      this.locked = false
    }
  }
}
