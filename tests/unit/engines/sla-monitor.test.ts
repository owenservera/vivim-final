// tests/unit/engines/sla-monitor.test.ts
// SLA monitoring (Unit 9.5) — latency recording, violation detection, cooldown.

import { afterEach, describe, expect, it } from 'bun:test'
import { SlaMonitor } from '../../../src/engines/sla-monitor.js'

describe('SlaMonitor (Unit 9.5)', () => {
  const monitors: SlaMonitor[] = []
  afterEach(() => {
    for (const m of monitors) m.stop()
    monitors.length = 0
  })

  function make(policy?: Record<string, unknown>): SlaMonitor {
    const m = new SlaMonitor(policy as any)
    monitors.push(m)
    return m
  }

  it('records samples and forwards to the metrics histogram', () => {
    const histograms: Array<{ name: string; value: number }> = []
    const m = make({
      operations: [{ name: 'op.x', target: { p50Ms: 100, p95Ms: 200, p99Ms: 300 } }],
      evaluationWindowMs: 60_000,
    })
    ;(m as any).metrics = {
      histogram: (name: string, value: number) => histograms.push({ name, value }),
    }
    m.record('op.x', 150)
    expect(histograms.length).toBe(1)
    expect(histograms[0]?.name).toBe('sla_latency_ms')
  })

  it('emits a violation when p50 exceeds target', () => {
    const warns: unknown[] = []
    const events: unknown[] = []
    const m = make({
      operations: [{ name: 'op.slow', target: { p50Ms: 100, p95Ms: 200, p99Ms: 300 } }],
      evaluationWindowMs: 60_000,
      alertThreshold: 0.1,
      cooldownMs: 1000,
    })
    ;(m as any).logger = { warn: (_msg: string, meta: unknown) => warns.push(meta) }
    ;(m as any).eventBus = { emit: (e: unknown) => events.push(e) }
    for (let i = 0; i < 12; i++) m.record('op.slow', 5000)
    ;(m as any).evaluate()
    expect(warns.length).toBe(1)
    expect(events.length).toBe(1)
    expect((events[0] as any).type).toBe('sla:violation')
  })

  it('respects the alert cooldown (no duplicate alerts)', () => {
    const events: unknown[] = []
    const m = make({
      operations: [{ name: 'op.slow', target: { p50Ms: 100, p95Ms: 200, p99Ms: 300 } }],
      evaluationWindowMs: 60_000,
      alertThreshold: 0.1,
      cooldownMs: 60_000,
    })
    ;(m as any).eventBus = { emit: (e: unknown) => events.push(e) }
    for (let i = 0; i < 12; i++) m.record('op.slow', 5000)
    ;(m as any).evaluate()
    ;(m as any).evaluate()
    expect(events.length).toBe(1)
  })

  it('does not alert when latency is within target', () => {
    const events: unknown[] = []
    const m = make({
      operations: [{ name: 'op.ok', target: { p50Ms: 5000, p95Ms: 8000, p99Ms: 10000 } }],
      evaluationWindowMs: 60_000,
    })
    ;(m as any).eventBus = { emit: (e: unknown) => events.push(e) }
    for (let i = 0; i < 12; i++) m.record('op.ok', 50)
    ;(m as any).evaluate()
    expect(events.length).toBe(0)
  })
})
