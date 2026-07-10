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
