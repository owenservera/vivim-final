// src/engines/error-tracker.ts
// Unit 9.3 — Error tracking with dedup and pluggable reporters.

import { catchDebug } from '../lib/catch-logger.js'
import type { Logger } from '../lib/logger.js'

export interface ErrorReporter {
  name: string
  report(error: TrackedError): Promise<void>
}

export interface TrackedError {
  id: string
  name: string
  message: string
  stack?: string
  level: 'error' | 'fatal'
  engine?: string
  context: Record<string, unknown>
  firstSeen: number
  lastSeen: number
  count: number
}

export interface ErrorTrackingPolicy {
  enabled: boolean
  dedupWindowMs: number
  maxContextSize: number
  sampleRate: number
  ignorePatterns: string[]
}

const DEFAULT_POLICY: ErrorTrackingPolicy = {
  enabled: true,
  dedupWindowMs: 60_000,
  maxContextSize: 1000,
  sampleRate: 1.0,
  ignorePatterns: [],
}

export const DEFAULT_ERROR_TRACKING_POLICY = DEFAULT_POLICY

export class ErrorTracker {
  private reporters: ErrorReporter[] = []
  private seen = new Map<string, TrackedError>()
  private policy: ErrorTrackingPolicy = DEFAULT_POLICY
  private flushTimer: ReturnType<typeof setInterval> | null = null

  constructor(
    policy?: Partial<ErrorTrackingPolicy>,
    private logger?: Logger,
  ) {
    if (policy) this.policy = { ...DEFAULT_POLICY, ...policy }
    this.flushTimer = setInterval(() => void this.flush(), 5000)
  }

  addReporter(reporter: ErrorReporter): void {
    this.reporters.push(reporter)
  }

  report(err: Error, context?: Record<string, unknown>, level: 'error' | 'fatal' = 'error'): void {
    if (!this.policy.enabled) return

    // Sample check
    if (this.policy.sampleRate < 1 && Math.random() > this.policy.sampleRate) return

    // Ignore patterns
    if (this.policy.ignorePatterns.some((p) => err.message.includes(p))) return

    const id = hashError(err)
    const now = Date.now()
    const existing = this.seen.get(id)

    if (existing && now - existing.lastSeen < this.policy.dedupWindowMs) {
      existing.count++
      existing.lastSeen = now
      return
    }

    const tracked: TrackedError = {
      id,
      name: err.name,
      message: err.message,
      stack: err.stack?.slice(0, this.policy.maxContextSize),
      level,
      context: context ?? {},
      firstSeen: now,
      lastSeen: now,
      count: existing ? existing.count + 1 : 1,
    }

    this.seen.set(id, tracked)

    for (const reporter of this.reporters) {
      void reporter.report(tracked).catch(() => {})
  // [audit] log the error with context here
    }
  }

  async flush(): Promise<void> {
    for (const reporter of this.reporters) {
      if (reporter.report) {
        for (const error of this.seen.values()) {
          try {
            await reporter.report(error)
          } catch (err) {
            catchDebug(err, 'engines:error-tracker:104')
            /* best-effort reporter — don't crash flush loop */
          }
        }
      }
    }
  }

  stop(): void {
    if (this.flushTimer) clearInterval(this.flushTimer)
  }
}

function hashError(err: Error): string {
  const key = `${err.name}:${err.message}`
  let hash = 0
  for (let i = 0; i < key.length; i++) {
    hash = (hash << 5) - hash + key.charCodeAt(i)
    hash |= 0
  }
  return `err_${Math.abs(hash).toString(36)}`
}
