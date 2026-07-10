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
