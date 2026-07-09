// tests/unit/storage/impl/health-store-impl.test.ts
// Unit 3.13 — HealthStoreImpl: circuit states, drift queries, provider health, active providers.

import { beforeEach, describe, expect, it } from 'bun:test'
import { HealthStoreImpl } from '../../../../src/storage/impl/health-store-impl.js'
import { makeTable } from '../../../helpers/prisma-mock.js'

function mockDb() {
  const prisma = {
    circuitBreakerState: makeTable(),
    driftEvent: makeTable(),
    providerHealth: makeTable(),
    providerHealthHistory: makeTable(),
  }
  return { prisma }
}

describe('HealthStoreImpl', () => {
  let db: ReturnType<typeof mockDb>
  let store: HealthStoreImpl

  beforeEach(() => {
    db = mockDb()
    store = new HealthStoreImpl(db as never)
  })

  it('getCircuitStates matches slaves that encode the provider', async () => {
    await db.prisma.circuitBreakerState.create({
      data: {
        id: 'cb1',
        slaveId: 'slave:claude:default',
        state: 'open',
        failCount: 2,
        lastFailAt: 1,
        lastSuccessAt: null,
        openedAt: 3,
      },
    })
    await db.prisma.circuitBreakerState.create({
      data: {
        id: 'cb2',
        slaveId: 'slave:gemini:default',
        state: 'closed',
        failCount: 0,
        lastFailAt: null,
        lastSuccessAt: null,
        openedAt: null,
      },
    })
    const states = await store.getCircuitStates('claude')
    expect(states).toHaveLength(1)
    expect(states[0]?.failureCount).toBe(2)
    expect(states[0]?.openedAt).toBe(3)
  })

  it('getRecentDrifts returns only events within the window', async () => {
    const now = Date.now()
    await db.prisma.driftEvent.create({
      data: {
        id: 'd1',
        providerId: 'claude',
        capabilityId: null,
        bindingId: null,
        driftType: 'selector',
        severity: 'warning',
        description: null,
        resolved: 0,
        detectedAt: now - 1000,
        resolvedAt: null,
      },
    })
    await db.prisma.driftEvent.create({
      data: {
        id: 'd2',
        providerId: 'claude',
        capabilityId: null,
        bindingId: null,
        driftType: 'selector',
        severity: 'warning',
        description: null,
        resolved: 0,
        detectedAt: now - 999999,
        resolvedAt: null,
      },
    })
    const drifts = await store.getRecentDrifts('claude', 5000)
    expect(drifts).toHaveLength(1)
    expect(drifts[0]?.id).toBe('d1')
  })

  it('upsertProviderHealth + getProviderHealth round-trips report', async () => {
    await store.upsertProviderHealth({
      id: 'ph_claude',
      providerId: 'claude',
      overallStatus: 'healthy',
      overallScore: 0.95,
      signalsJson: '{"parser":1}',
      ts: 1234,
    })
    const report = await store.getProviderHealth('claude')
    expect(report?.overallStatus).toBe('healthy')
    expect(report?.overallScore).toBe(0.95)
    expect(report?.ts).toBe(1234)
  })

  it('upsertProviderHealth updates the same provider row (unique providerId)', async () => {
    await store.upsertProviderHealth({
      id: 'ph_x',
      providerId: 'x',
      overallStatus: 'degraded',
      overallScore: 0.5,
      signalsJson: '{}',
      ts: 1,
    })
    await store.upsertProviderHealth({
      id: 'ph_x',
      providerId: 'x',
      overallStatus: 'healthy',
      overallScore: 0.9,
      signalsJson: '{}',
      ts: 2,
    })
    expect(db.prisma.providerHealth.rows).toHaveLength(1)
    expect((await store.getProviderHealth('x'))?.overallStatus).toBe('healthy')
  })

  it('getHealthHistory maps history rows newest-first', async () => {
    await db.prisma.providerHealthHistory.create({
      data: {
        id: 'h1',
        providerId: 'claude',
        runtimeState: 'running',
        selectorHitRateAvg: 0.8,
        snapshotTs: 100,
      },
    })
    await db.prisma.providerHealthHistory.create({
      data: {
        id: 'h2',
        providerId: 'claude',
        runtimeState: 'degraded',
        selectorHitRateAvg: 0.4,
        snapshotTs: 200,
      },
    })
    const history = await store.getHealthHistory('claude')
    expect(history).toHaveLength(2)
    expect(history[0]?.ts).toBe(200)
    expect(history[0]?.overall_status).toBe('degraded')
    expect(history[0]?.overall_score).toBe(0.4)
  })

  it('getActiveProviders excludes unknown-status providers', async () => {
    await store.upsertProviderHealth({
      id: 'a',
      providerId: 'claude',
      overallStatus: 'healthy',
      overallScore: 1,
      signalsJson: '{}',
      ts: 1,
    })
    await db.prisma.providerHealth.create({
      data: {
        id: 'b',
        providerId: 'idle',
        overallStatus: 'unknown',
        overallScore: 0,
        signalsJson: '{}',
        lastCheckAt: null,
        updatedAt: 1,
      },
    })
    const active = await store.getActiveProviders()
    expect(active).toEqual(['claude'])
  })
})
