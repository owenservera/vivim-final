// src/observability/metrics.ts
// Prometheus-compatible metrics for Chrome fleet monitoring.
// Phase 1: Expose /metrics endpoint for Grafana dashboards.

export type MetricType = 'gauge' | 'counter' | 'histogram'

export interface MetricDefinition {
  name: string
  help: string
  type: MetricType
  labels?: string[]
}

export interface MetricValue {
  name: string
  labels: Record<string, string>
  value: number
  timestamp: number
}

/**
 * In-memory metrics store with Prometheus text format export.
 */
export class MetricsStore {
  private gauges = new Map<string, Map<string, number>>()
  private counters = new Map<string, Map<string, number>>()
  private histograms = new Map<string, { buckets: Map<number, number>; sum: number; count: number }>()
  private definitions = new Map<string, MetricDefinition>()

  register(def: MetricDefinition): void {
    this.definitions.set(def.name, def)
  }

  setGauge(name: string, labels: Record<string, string>, value: number): void {
    const key = this.labelKey(labels)
    if (!this.gauges.has(name)) this.gauges.set(name, new Map())
    this.gauges.get(name)!.set(key, value)
  }

  incCounter(name: string, labels: Record<string, string>, delta = 1): void {
    const key = this.labelKey(labels)
    if (!this.counters.has(name)) this.counters.set(name, new Map())
    const current = this.counters.get(name)!.get(key) ?? 0
    this.counters.get(name)!.set(key, current + delta)
  }

  observeHistogram(name: string, labels: Record<string, string>, value: number): void {
    const key = this.labelKey(labels)
    if (!this.histograms.has(name)) {
      this.histograms.set(name, { buckets: new Map(), sum: 0, count: 0 })
    }
    const hist = this.histograms.get(name)!
    hist.sum += value
    hist.count += 1

    // Default buckets: 1, 5, 10, 25, 50, 100, 250, 500, 1000ms
    const bucketBounds = [1, 5, 10, 25, 50, 100, 250, 500, 1000]
    for (const bound of bucketBounds) {
      if (value <= bound) {
        hist.buckets.set(bound, (hist.buckets.get(bound) ?? 0) + 1)
      }
    }
  }

  /**
   * Export metrics in Prometheus text format.
   */
  toPrometheus(): string {
    const lines: string[] = []

    // Gauges
    for (const [name, values] of this.gauges) {
      const def = this.definitions.get(name)
      if (def?.help) lines.push(`# HELP ${name} ${def.help}`)
      if (def?.type) lines.push(`# TYPE ${name} ${def.type}`)
      for (const [labelKey, value] of values) {
        const labels = labelKey ? `{${labelKey}}` : ''
        lines.push(`${name}${labels} ${value}`)
      }
    }

    // Counters
    for (const [name, values] of this.counters) {
      const def = this.definitions.get(name)
      if (def?.help) lines.push(`# HELP ${name} ${def.help}`)
      lines.push(`# TYPE ${name} counter`)
      for (const [labelKey, value] of values) {
        const labels = labelKey ? `{${labelKey}}` : ''
        lines.push(`${name}${labels} ${value}`)
      }
    }

    // Histograms
    for (const [name, hist] of this.histograms) {
      const def = this.definitions.get(name)
      if (def?.help) lines.push(`# HELP ${name} ${def.help}`)
      lines.push(`# TYPE ${name} histogram`)
      for (const [bound, count] of hist.buckets) {
        lines.push(`${name}_bucket{le="${bound}"} ${count}`)
      }
      lines.push(`${name}_bucket{le="+Inf"} ${hist.count}`)
      lines.push(`${name}_sum ${hist.sum}`)
      lines.push(`${name}_count ${hist.count}`)
    }

    return lines.join('\n')
  }

  private labelKey(labels: Record<string, string>): string {
    return Object.entries(labels)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}="${v}"`)
      .join(',')
  }
}

// Singleton metrics store
let globalMetrics: MetricsStore | null = null

export function getMetrics(): MetricsStore {
  if (!globalMetrics) {
    globalMetrics = new MetricsStore()
    registerDefaultMetrics(globalMetrics)
  }
  return globalMetrics
}

function registerDefaultMetrics(store: MetricsStore): void {
  // Fleet metrics
  store.register({ name: 'chrome_fleet_size', help: 'Number of Chrome slaves by state', type: 'gauge', labels: ['state'] })
  store.register({ name: 'chrome_slave_cdp_roundtrip_ms', help: 'CDP command round-trip latency', type: 'histogram' })
  store.register({ name: 'chrome_circuit_state', help: 'Circuit breaker state (0=closed, 1=half, 2=open)', type: 'gauge', labels: ['slaveId'] })
  store.register({ name: 'chrome_pool_leases', help: 'Active pool leases by provider', type: 'gauge', labels: ['provider'] })
  store.register({ name: 'chrome_scheduler_queue_depth', help: 'Scheduler queue depth', type: 'gauge', labels: ['slaveId', 'queue'] })
  store.register({ name: 'chrome_spawn_total', help: 'Total spawn attempts', type: 'counter', labels: ['result'] })
  store.register({ name: 'chrome_health_probe_total', help: 'Total health probes', type: 'counter', labels: ['result'] })
  store.register({ name: 'chrome_resource_pressure', help: 'Host resource pressure', type: 'gauge', labels: ['resource'] })
  store.register({ name: 'chrome_concurrency_limit', help: 'Current concurrency limit', type: 'gauge' })
  store.register({ name: 'chrome_evictions_total', help: 'Total slave evictions', type: 'counter' })
}
