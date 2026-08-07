// src/engines/sla-monitor.ts
// Unit 9.5 — Latency SLA monitoring + alerting.

import type { Logger } from '../lib/logger.js'
import type { CapabilityEventBus } from './capability-event-bus.js'
import type { MetricsRegistry } from './metrics.js'

export interface SlaTarget {
  p50Ms: number
  p95Ms: number
  p99Ms: number
}

export interface SlaOperation {
  name: string
  target: SlaTarget
}

export interface SlaPolicy {
  operations: SlaOperation[]
  evaluationWindowMs: number
  alertThreshold: number
  cooldownMs: number
}

const DEFAULT_POLICY: SlaPolicy = {
  operations: [{ name: 'conversation.send', target: { p50Ms: 500, p95Ms: 2000, p99Ms: 5000 } }],
  evaluationWindowMs: 60_000,
  alertThreshold: 0.1,
  cooldownMs: 300_000,
}

export const DEFAULT_SLA_POLICY = DEFAULT_POLICY

export class SlaMonitor {
  private samples = new Map<string, number[]>()
  private alertCooldowns = new Map<string, number>()
  private policy: SlaPolicy = DEFAULT_POLICY
  private timer: ReturnType<typeof setInterval> | null = null

  constructor(
    policy?: Partial<SlaPolicy>,
    private metrics?: MetricsRegistry,
    private logger?: Logger,
    private eventBus?: CapabilityEventBus,
  ) {
    if (policy) this.policy = { ...DEFAULT_POLICY, ...policy }
  }

  start(): void {
    this.stop()
    this.timer = setInterval(() => void this.evaluate(), this.policy.evaluationWindowMs / 2)
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer)
    this.timer = null
  }

  record(operation: string, latencyMs: number): void {
    let samples = this.samples.get(operation)
    if (!samples) {
      samples = []
      this.samples.set(operation, samples)
    }
    samples.push(latencyMs)

    // Keep only window
    const _cutoff = Date.now() - this.policy.evaluationWindowMs
    while (samples.length > 0 && samples.length > 10000) {
      samples.shift()
    }

    this.metrics?.histogram('sla_latency_ms', latencyMs, { operation })
  }

  private evaluate(): void {
    for (const op of this.policy.operations) {
      const samples = this.samples.get(op.name)
      if (!samples || samples.length < 10) continue

      const sorted = [...samples].sort((a, b) => a - b)
      const p50 = sorted[Math.floor(sorted.length * 0.5)] ?? 0
      const p95 = sorted[Math.floor(sorted.length * 0.95)] ?? 0
      const p99 = sorted[Math.floor(sorted.length * 0.99)] ?? 0

      const violations: string[] = []
      if (p50 > op.target.p50Ms) violations.push(`p50=${p50}ms > ${op.target.p50Ms}ms`)
      if (p95 > op.target.p95Ms) violations.push(`p95=${p95}ms > ${op.target.p95Ms}ms`)
      if (p99 > op.target.p99Ms) violations.push(`p99=${p99}ms > ${op.target.p99Ms}ms`)

      if (violations.length > 0) {
        const now = Date.now()
        const lastAlert = this.alertCooldowns.get(op.name) ?? 0
        if (now - lastAlert > this.policy.cooldownMs) {
          this.alertCooldowns.set(op.name, now)
          this.logger?.warn(`SLA violation: ${op.name}`, { violations, p50, p95, p99 })
          this.eventBus?.emit({
            type: 'sla:violation',
            operation: op.name,
            violations,
            p50,
            p95,
            p99,
          })
        }
      }
    }
  }
}
