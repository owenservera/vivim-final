// tests/unit/engines/cost-optimizer.test.ts
// Unit tests for CostOptimizer — uses mocked CostStore.

import { beforeEach, describe, expect, it } from 'bun:test'
import { CostOptimizer } from '../../../src/engines/cost-optimizer.js'
import type {
  CostLogInput,
  CostStore,
  LatencyLogInput,
} from '../../../src/storage/contracts/cost-store.js'

// ── Mock store ──────────────────────────────────────────────────────────────

function createMockCostStore(): CostStore & {
  costLogs: CostLogInput[]
  latencyLogs: LatencyLogInput[]
} {
  const costLogs: CostLogInput[] = []
  const latencyLogs: LatencyLogInput[] = []

  return {
    costLogs,
    latencyLogs,

    async createCostLog(input: CostLogInput): Promise<void> {
      costLogs.push({ ...input })
    },
    async getCostLogs(providerId: string, from: number, to: number): Promise<CostLogInput[]> {
      return costLogs.filter((l) => l.providerId === providerId && l.ts >= from && l.ts <= to)
    },
    async createLatencyLog(input: LatencyLogInput): Promise<void> {
      latencyLogs.push({ ...input })
    },
    async getLatencyLogs(providerId: string, from: number, to: number): Promise<LatencyLogInput[]> {
      return latencyLogs.filter((l) => l.providerId === providerId && l.ts >= from && l.ts <= to)
    },
    async getAllCostLogs(from: number, to: number): Promise<CostLogInput[]> {
      return costLogs.filter((l) => l.ts >= from && l.ts <= to)
    },
  }
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('CostOptimizer', () => {
  let optimizer: CostOptimizer
  let store: ReturnType<typeof createMockCostStore>

  beforeEach(() => {
    store = createMockCostStore()
    optimizer = new CostOptimizer(store)
  })

  // ── recordCost ───────────────────────────────────────────────────────────

  it('recordCost stores a cost log', async () => {
    await optimizer.recordCost('claude', 5, 1000, 500, 'claude-3')
    expect(store.costLogs).toHaveLength(1)
    expect(store.costLogs[0]?.providerId).toBe('claude')
    expect(store.costLogs[0]?.costCents).toBe(5)
    expect(store.costLogs[0]?.tokensInput).toBe(1000)
    expect(store.costLogs[0]?.tokensOutput).toBe(500)
    expect(store.costLogs[0]?.model).toBe('claude-3')
  })

  it('recordCost defaults model to null', async () => {
    await optimizer.recordCost('chatgpt', 3, 800, 200)
    expect(store.costLogs[0]?.model).toBeNull()
  })

  // ── getCostReport ────────────────────────────────────────────────────────

  it('getCostReport aggregates costs correctly', async () => {
    const now = Date.now()
    store.costLogs.push(
      {
        id: '1',
        providerId: 'claude',
        costCents: 5,
        tokensInput: 1000,
        tokensOutput: 500,
        model: null,
        ts: now,
      },
      {
        id: '2',
        providerId: 'claude',
        costCents: 3,
        tokensInput: 800,
        tokensOutput: 300,
        model: null,
        ts: now,
      },
      {
        id: '3',
        providerId: 'chatgpt',
        costCents: 2,
        tokensInput: 600,
        tokensOutput: 200,
        model: null,
        ts: now,
      },
    )

    const report = await optimizer.getCostReport('claude', now - 10000, now + 10000)
    expect(report.providerId).toBe('claude')
    expect(report.totalCostCents).toBe(8)
    expect(report.totalTokensInput).toBe(1800)
    expect(report.totalTokensOutput).toBe(800)
    expect(report.requestCount).toBe(2)
    expect(report.avgCostPerRequest).toBe(4)
  })

  it('getCostReport groups by day', async () => {
    const today = new Date().toISOString().slice(0, 10)
    const now = Date.now()
    store.costLogs.push(
      {
        id: '1',
        providerId: 'claude',
        costCents: 5,
        tokensInput: 1000,
        tokensOutput: 500,
        model: null,
        ts: now,
      },
      {
        id: '2',
        providerId: 'claude',
        costCents: 3,
        tokensInput: 800,
        tokensOutput: 300,
        model: null,
        ts: now,
      },
    )

    const report = await optimizer.getCostReport('claude', now - 10000, now + 10000)
    const dayEntry = report.byDay[today]
    expect(dayEntry).toBeDefined()
    expect(dayEntry?.costCents).toBe(8)
    expect(dayEntry?.requests).toBe(2)
  })

  it('getCostReport returns empty for no data', async () => {
    const report = await optimizer.getCostReport('unknown', 0, Date.now())
    expect(report.totalCostCents).toBe(0)
    expect(report.requestCount).toBe(0)
    expect(report.avgCostPerRequest).toBe(0)
  })

  // ── estimateCost ─────────────────────────────────────────────────────────

  it('estimateCost returns minimum 1 cent', async () => {
    const cost = await optimizer.estimateCost('claude', 1)
    expect(cost).toBeGreaterThanOrEqual(1)
  })

  it('estimateCost scales with message length', async () => {
    const short = await optimizer.estimateCost('claude', 100)
    const long = await optimizer.estimateCost('claude', 10000)
    expect(long).toBeGreaterThan(short)
  })

  // ── getCheapestProvider ──────────────────────────────────────────────────

  it('getCheapestProvider returns null when no data', async () => {
    const cheapest = await optimizer.getCheapestProvider()
    expect(cheapest).toBeNull()
  })

  it('getCheapestProvider returns provider with lowest avg cost', async () => {
    const now = Date.now()
    const _thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000
    store.costLogs.push(
      // claude: avg 10 cents
      {
        id: '1',
        providerId: 'claude',
        costCents: 10,
        tokensInput: 1000,
        tokensOutput: 500,
        model: null,
        ts: now,
      },
      // chatgpt: avg 2 cents
      {
        id: '2',
        providerId: 'chatgpt',
        costCents: 2,
        tokensInput: 800,
        tokensOutput: 200,
        model: null,
        ts: now,
      },
      {
        id: '3',
        providerId: 'chatgpt',
        costCents: 2,
        tokensInput: 800,
        tokensOutput: 200,
        model: null,
        ts: now,
      },
    )

    // Override to return filtered data
    store.getAllCostLogs = async (from: number, to: number) =>
      store.costLogs.filter((l) => l.ts >= from && l.ts <= to)

    const cheapest = await optimizer.getCheapestProvider()
    expect(cheapest).toBe('chatgpt')
  })

  // ── getProviderSummaries ─────────────────────────────────────────────────

  it('getProviderSummaries aggregates by provider', async () => {
    const now = Date.now()
    store.costLogs.push(
      {
        id: '1',
        providerId: 'claude',
        costCents: 10,
        tokensInput: 1000,
        tokensOutput: 500,
        model: null,
        ts: now,
      },
      {
        id: '2',
        providerId: 'chatgpt',
        costCents: 2,
        tokensInput: 800,
        tokensOutput: 200,
        model: null,
        ts: now,
      },
      {
        id: '3',
        providerId: 'chatgpt',
        costCents: 3,
        tokensInput: 800,
        tokensOutput: 200,
        model: null,
        ts: now,
      },
    )

    store.getAllCostLogs = async (from: number, to: number) =>
      store.costLogs.filter((l) => l.ts >= from && l.ts <= to)

    const summaries = await optimizer.getProviderSummaries(now - 10000, now + 10000)
    expect(summaries).toHaveLength(2)

    const claude = summaries.find((s) => s.providerId === 'claude')
    expect(claude).toBeDefined()
    expect(claude?.totalCostCents).toBe(10)
    expect(claude?.requestCount).toBe(1)

    const chatgpt = summaries.find((s) => s.providerId === 'chatgpt')
    expect(chatgpt).toBeDefined()
    expect(chatgpt?.totalCostCents).toBe(5)
    expect(chatgpt?.requestCount).toBe(2)
    expect(chatgpt?.avgCostPerRequest).toBe(3)
  })
})
