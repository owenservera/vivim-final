// src/engines/loop-detector.ts
// Detects agent loops (repeated failed actions, oscillation).
// Adapted from dao-ai/cdp-browser (MIT) for vivim-final.

interface ActionRecord {
  action: string
  target: string
  result: 'success' | 'failure'
  ts: number
}

export interface LoopDetectorConfig {
  /** Max consecutive identical failures before declaring loop */
  maxRepeats: number
  /** Window size (number of recent actions to examine) */
  windowSize: number
}

const DEFAULT_CONFIG: LoopDetectorConfig = {
  maxRepeats: 3,
  windowSize: 10,
}

/**
 * Detects agent loops: repeated failed actions on the same target,
 * and oscillation patterns (A→B→A→B).
 */
export class LoopDetector {
  private history: ActionRecord[] = []
  private config: LoopDetectorConfig

  constructor(config?: Partial<LoopDetectorConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  /**
   * Record an action result for loop analysis.
   */
  record(action: string, target: string, result: 'success' | 'failure'): void {
    this.history.push({ action, target, result, ts: Date.now() })
    // Keep bounded history
    if (this.history.length > this.config.windowSize * 2) {
      this.history = this.history.slice(-this.config.windowSize * 2)
    }
  }

  /**
   * Check if the agent is currently in a loop.
   * Detects two patterns:
   * 1. Repeated failed actions on the same target
   * 2. Oscillation between two actions (A→B→A→B)
   */
  isLooping(): boolean {
    if (this.history.length < this.config.windowSize) return false

    const recent = this.history.slice(-this.config.windowSize)

    // Pattern 1: Repeated failed actions
    const failed = recent.filter((r) => r.result === 'failure')
    if (failed.length >= this.config.maxRepeats) {
      const lastN = failed.slice(-this.config.maxRepeats)
      const firstAction = lastN[0]?.action
      if (firstAction !== undefined && lastN.every((r) => r.action === firstAction)) {
        return true
      }
    }

    // Pattern 2: Oscillation (A→B→A→B) using action+target
    if (recent.length >= 4) {
      const p = recent.slice(-4)
      const key0 = `${p[0]?.action}:${p[0]?.target}`
      const key1 = `${p[1]?.action}:${p[1]?.target}`
      const key2 = `${p[2]?.action}:${p[2]?.target}`
      const key3 = `${p[3]?.action}:${p[3]?.target}`
      if (
        key0 !== 'undefined:undefined' &&
        key1 !== 'undefined:undefined' &&
        key2 !== 'undefined:undefined' &&
        key3 !== 'undefined:undefined' &&
        key0 === key2 &&
        key1 === key3 &&
        key0 !== key1
      ) {
        return true
      }
    }

    return false
  }

  /**
   * Get a human-readable suggestion for breaking the loop.
   */
  getSuggestion(): string {
    const failed = this.history.filter((r) => r.result === 'failure').slice(-1)[0]
    if (failed) {
      return `Loop detected on "${failed.action}" → "${failed.target}". Try different selector or approach.`
    }
    return 'Agent looping. Reset context or escalate.'
  }

  /**
   * Reset detector state (e.g. after successful loop break).
   */
  reset(): void {
    this.history = []
  }
}
