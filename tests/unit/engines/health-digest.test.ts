import { describe, expect, it } from 'bun:test'
import {
  HealthDigestEngine,
  type HealthDigestMetrics,
  type HealthDigestMetricsProvider,
  type HealthDigestRow,
  type HealthDigestStore,
  renderDigest,
} from '../../../src/engines/health-digest.js'

const FIXTURE: HealthDigestMetrics = {
  providerHealth: [
    { provider: 'openai', status: 'healthy' },
    { provider: 'anthropic', status: 'degraded' },
  ],
  tokenCostCents: 1234,
  errorRate: 0.042,
  selectorHealCount: 7,
  taskCompletions: 53,
}

class FakeProvider implements HealthDigestMetricsProvider {
  async gather(): Promise<HealthDigestMetrics> {
    return FIXTURE
  }
}

class FakeStore implements HealthDigestStore {
  private rows = new Map<string, HealthDigestRow>()
  async getByDay(day: string): Promise<HealthDigestRow | null> {
    return this.rows.get(day) ?? null
  }
  async save(row: HealthDigestRow): Promise<void> {
    this.rows.set(row.day, row)
  }
  async listRecent(limit = 30): Promise<HealthDigestRow[]> {
    return [...this.rows.values()].slice(0, limit)
  }
  get size() {
    return this.rows.size
  }
}

describe('health-digest', () => {
  it('digest covers all metric categories', () => {
    const md = renderDigest('2026-07-13', FIXTURE)
    expect(md).toContain('Provider Health')
    expect(md).toContain('openai: healthy')
    expect(md).toContain('anthropic: degraded')
    expect(md).toContain('Token spend (24h): $12.34')
    expect(md).toContain('Error rate (24h): 4.20%')
    expect(md).toContain('Selector heals (24h): 7')
    expect(md).toContain('Task completions (24h): 53')
  })

  it('generates a digest from 24h of fixtures', async () => {
    const store = new FakeStore()
    const engine = new HealthDigestEngine(store, new FakeProvider())
    const row = await engine.generateForDay('2026-07-13')
    expect(row.day).toBe('2026-07-13')
    expect(store.size).toBe(1)
    expect(row.markdown).toContain('System Health Digest — 2026-07-13')
    expect(JSON.parse(row.metricsJson).errorRate).toBe(0.042)
  })

  it('same-day re-run is idempotent', async () => {
    const store = new FakeStore()
    const engine = new HealthDigestEngine(store, new FakeProvider())
    const first = await engine.generateForDay('2026-07-13')
    const second = await engine.generateForDay('2026-07-13')
    expect(second.id).toBe(first.id)
    expect(second.markdown).toBe(first.markdown)
    expect(store.size).toBe(1)
  })
})
