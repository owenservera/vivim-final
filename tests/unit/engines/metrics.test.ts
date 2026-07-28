// tests/unit/engines/metrics.test.ts
// MetricsRegistry — counters, gauges, histograms, flush, exporters.
import { beforeEach, describe, expect, it, mock } from 'bun:test'
import {
  DEFAULT_POLICY,
  type MetricsExporter,
  MetricsRegistry,
} from '../../../src/engines/metrics.js'

function makeExporter(): MetricsExporter & { snapshots: Parameters<MetricsExporter['export']>[0] } {
  let snapshots: any[] = []
  return {
    name: 'test-exporter',
    get snapshots() {
      return snapshots
    },
    export: mock(async (s: any[]) => {
      snapshots = s
    }),
  }
}

describe('MetricsRegistry', () => {
  let registry: MetricsRegistry
  let exporter: ReturnType<typeof makeExporter>

  beforeEach(() => {
    registry = new MetricsRegistry({ scrapeIntervalMs: 0 })
    exporter = makeExporter()
    registry.addExporter(exporter)
  })

  it('increment counters', () => {
    registry.increment('requests')
    registry.increment('requests')
    registry.increment('requests', 3)
    const snapshots = registry.collect()
    const req = snapshots.find((s) => s.name === 'vivim_requests')
    expect(req).toBeDefined()
    expect(req!.value).toBe(5)
    expect(req!.type).toBe('counter')
  })

  it('gauge sets value', () => {
    registry.gauge('connections', 42)
    const snapshots = registry.collect()
    const g = snapshots.find((s) => s.name === 'vivim_connections')
    expect(g).toBeDefined()
    expect(g!.value).toBe(42)
    expect(g!.type).toBe('gauge')
  })

  it('histogram tracks buckets', () => {
    registry.histogram('latency', 50)
    registry.histogram('latency', 200)
    registry.histogram('latency', 2000)
    const snapshots = registry.collect()
    const bucket50 = snapshots.find(
      (s) => s.name === 'vivim_latency_bucket' && s.labels.le === '50',
    )
    expect(bucket50?.value).toBe(1)
    const bucket250 = snapshots.find(
      (s) => s.name === 'vivim_latency_bucket' && s.labels.le === '250',
    )
    expect(bucket250?.value).toBe(2)
    const sum = snapshots.find((s) => s.name === 'vivim_latency_sum')
    expect(sum?.value).toBe(2250)
    const count = snapshots.find((s) => s.name === 'vivim_latency_count')
    expect(count?.value).toBe(3)
  })

  it('flush calls exporters', async () => {
    registry.increment('test')
    await registry.flush()
    expect(exporter.export).toHaveBeenCalled()
  })

  it('flush handles exporter errors gracefully', async () => {
    const badExporter = { name: 'bad', export: mock(() => Promise.reject(new Error('fail'))) }
    registry.addExporter(badExporter)
    registry.increment('test')
    await registry.flush()
    expect(badExporter.export).toHaveBeenCalled()
  })

  it('collect prefixes metric names', () => {
    registry.increment('my_counter')
    const snapshots = registry.collect()
    expect(snapshots[0]?.name).toBe('vivim_my_counter')
  })

  it('custom prefix overrides default', () => {
    const custom = new MetricsRegistry({ prefix: 'app_' })
    custom.increment('req')
    const snapshots = custom.collect()
    expect(snapshots[0]?.name).toBe('app_req')
  })

  it('labels are included in snapshots', () => {
    registry.increment('hits', 1, { path: '/api' })
    const snapshots = registry.collect()
    expect(snapshots[0]?.labels).toEqual({ path: '/api' })
  })

  it('DEFAULT_POLICY has correct shape', () => {
    expect(DEFAULT_POLICY.enabled).toBe(true)
    expect(DEFAULT_POLICY.prefix).toBe('vivim_')
    expect(DEFAULT_POLICY.defaultHistogramBuckets.length).toBeGreaterThan(0)
  })
})
