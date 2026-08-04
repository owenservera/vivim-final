// src/engines/metrics.ts
// Unit 9.2 — Metrics export pipeline (Prometheus/OTLP).

import type { StructuredLogger } from './logger.js'

export interface MetricsExporter {
  name: string
  export(metrics: MetricSnapshot[]): Promise<void>
}

export interface MetricSnapshot {
  name: string
  type: 'counter' | 'gauge' | 'histogram' | 'summary'
  value: number
  labels: Record<string, string>
  ts: number
}

export interface MetricsPolicy {
  enabled: boolean
  defaultHistogramBuckets: number[]
  scrapeIntervalMs: number
  prefix: string
}

interface MetricEntry {
  name: string
  value: number
  labels: Record<string, string>
}

interface HistogramEntry {
  name: string
  buckets: { le: number; count: number }[]
  sum: number
  count: number
  labels: Record<string, string>
}

export const DEFAULT_POLICY: MetricsPolicy = {
  enabled: true,
  defaultHistogramBuckets: [50, 100, 250, 500, 1000, 2500, 5000, 10000],
  scrapeIntervalMs: 15_000,
  prefix: 'vivim_',
}

export const DEFAULT_METRICS_POLICY = DEFAULT_POLICY

export class MetricsRegistry {
  private counters = new Map<string, MetricEntry>()
  private gauges = new Map<string, MetricEntry>()
  private histograms = new Map<string, HistogramEntry>()
  private exporters: MetricsExporter[] = []
  private policy: MetricsPolicy = DEFAULT_POLICY
  private timer: ReturnType<typeof setInterval> | null = null

  constructor(
    policy?: Partial<MetricsPolicy>,
    private logger?: StructuredLogger,
  ) {
    if (policy) this.policy = { ...DEFAULT_POLICY, ...policy }
  }

  addExporter(exporter: MetricsExporter): void {
    this.exporters.push(exporter)
  }

  start(): void {
    this.stop()
    this.timer = setInterval(() => void this.flush(), this.policy.scrapeIntervalMs)
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer)
    this.timer = null
  }

  increment(name: string, value = 1, labels?: Record<string, string>): void {
    const key = this.key(name, labels)
    const entry = this.counters.get(key) ?? { name, value: 0, labels: labels ?? {} }
    entry.value += value
    this.counters.set(key, entry)
  }

  gauge(name: string, value: number, labels?: Record<string, string>): void {
    const key = this.key(name, labels)
    this.gauges.set(key, { name, value, labels: labels ?? {} })
  }

  histogram(name: string, value: number, labels?: Record<string, string>): void {
    const key = this.key(name, labels)
    const entry = this.histograms.get(key) ?? {
      name,
      buckets: this.policy.defaultHistogramBuckets.map((le) => ({ le, count: 0 })),
      sum: 0,
      count: 0,
      labels: labels ?? {},
    }
    entry.sum += value
    entry.count++
    for (const bucket of entry.buckets) {
      if (value <= bucket.le) bucket.count++
    }
    this.histograms.set(key, entry)
  }

  async flush(): Promise<void> {
    const snapshots = this.collect()
    for (const exporter of this.exporters) {
      try {
        await exporter.export(snapshots)
      } catch (err) {
        this.logger?.error(`Metrics export failed: ${exporter.name}`, {
          error: err instanceof Error ? { message: err.message, stack: err.stack, name: err.name } : { message: String(err), name: 'UnknownError' },
        })
      }
    }
  }

  collect(): MetricSnapshot[] {
    const now = Date.now()
    const snapshots: MetricSnapshot[] = []

    for (const entry of this.counters.values()) {
      snapshots.push({
        name: `${this.policy.prefix}${entry.name}`,
        type: 'counter',
        value: entry.value,
        labels: entry.labels,
        ts: now,
      })
    }

    for (const entry of this.gauges.values()) {
      snapshots.push({
        name: `${this.policy.prefix}${entry.name}`,
        type: 'gauge',
        value: entry.value,
        labels: entry.labels,
        ts: now,
      })
    }

    for (const entry of this.histograms.values()) {
      for (const bucket of entry.buckets) {
        snapshots.push({
          name: `${this.policy.prefix}${entry.name}_bucket`,
          type: 'histogram',
          value: bucket.count,
          labels: { ...entry.labels, le: String(bucket.le) },
          ts: now,
        })
      }
      snapshots.push({
        name: `${this.policy.prefix}${entry.name}_sum`,
        type: 'histogram',
        value: entry.sum,
        labels: entry.labels,
        ts: now,
      })
      snapshots.push({
        name: `${this.policy.prefix}${entry.name}_count`,
        type: 'histogram',
        value: entry.count,
        labels: entry.labels,
        ts: now,
      })
    }

    return snapshots
  }

  private key(name: string, labels?: Record<string, string>): string {
    if (!labels) return name
    const sorted = Object.entries(labels)
      .sort()
      .map(([k, v]) => `${k}=${v}`)
      .join(',')
    return `${name}{${sorted}}`
  }
}
