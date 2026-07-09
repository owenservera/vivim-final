// tests/unit/storage/impl/governor-store-impl.test.ts
// Unit 3.13 — GovernorStoreImpl: accounts, fleet events, circuit state, health ticks, trace.

import { beforeEach, describe, expect, it } from 'bun:test'
import { GovernorStoreImpl } from '../../../../src/storage/impl/governor-store-impl.js'
import { makeTable } from '../../../helpers/prisma-mock.js'

function mockDb() {
  const prisma = {
    providerAccount: makeTable(),
    fleetEvent: makeTable(),
    circuitBreakerState: makeTable(),
    healthTick: makeTable(),
    traceEntry: makeTable(),
  }
  return { prisma }
}

describe('GovernorStoreImpl', () => {
  let db: ReturnType<typeof mockDb>
  let store: GovernorStoreImpl

  beforeEach(() => {
    db = mockDb()
    store = new GovernorStoreImpl(db as never)
  })

  it('upsertAccount + getAccount round-trips core fields', async () => {
    await store.upsertAccount({
      id: 'acc_1',
      providerId: 'claude',
      accountSlug: 'a@example.com',
      displayName: 'a@example.com',
      planTier: 'pro',
      apiKeyRef: null,
      isActive: 1,
      createdAt: 0,
      updatedAt: 0,
    })
    const acc = await store.getAccount('acc_1')
    expect(acc?.id).toBe('acc_1')
    expect(acc?.providerId).toBe('claude')
    expect(acc?.accountSlug).toBe('a@example.com')
    expect(acc?.planTier).toBe('pro')
  })

  it('getAccountsByProvider filters by provider', async () => {
    const base = { apiKeyRef: null, isActive: 1, createdAt: 0, updatedAt: 0 }
    await store.upsertAccount({
      id: 'a1',
      providerId: 'claude',
      accountSlug: 'x',
      displayName: 'x',
      planTier: 'free',
      ...base,
    })
    await store.upsertAccount({
      id: 'a2',
      providerId: 'gemini',
      accountSlug: 'y',
      displayName: 'y',
      planTier: 'free',
      ...base,
    })
    const claude = await store.getAccountsByProvider('claude')
    expect(claude).toHaveLength(1)
    expect(claude[0]?.id).toBe('a1')
  })

  it('deleteAccount removes the account', async () => {
    await store.upsertAccount({
      id: 'acc_del',
      providerId: 'claude',
      accountSlug: 'z',
      displayName: 'z',
      planTier: 'free',
      apiKeyRef: null,
      isActive: 1,
      createdAt: 0,
      updatedAt: 0,
    })
    await store.deleteAccount('acc_del')
    expect(await store.getAccount('acc_del')).toBeNull()
  })

  it('createFleetEvent + getFleetEvents returns newest-first', async () => {
    await store.createFleetEvent({ slaveId: 's1', providerId: 'claude', eventType: 'spawned' })
    await store.createFleetEvent({ slaveId: 's1', providerId: 'claude', eventType: 'killed' })
    const events = await store.getFleetEvents('s1')
    expect(events).toHaveLength(2)
    expect(events[0]?.eventType).toBe('killed')
    expect(events[0]?.detailJson).toBe('{}')
  })

  it('upsertCircuitState + getCircuitState maps failureCount', async () => {
    await store.upsertCircuitState({
      id: 'cb_s1',
      slaveId: 's1',
      state: 'open',
      failureCount: 3,
      lastFailureAt: 111,
      lastSuccessAt: null,
      openedAt: 222,
    })
    const cb = await store.getCircuitState('s1')
    expect(cb?.state).toBe('open')
    expect(cb?.failureCount).toBe(3)
    expect(cb?.lastFailureAt).toBe(111)
    expect(cb?.openedAt).toBe(222)
  })

  it('upsertCircuitState updates existing row (unique slaveId)', async () => {
    const row = {
      id: 'cb_s2',
      slaveId: 's2',
      lastSuccessAt: null,
      openedAt: null,
    }
    await store.upsertCircuitState({
      ...row,
      state: 'closed',
      failureCount: 0,
      lastFailureAt: null,
    })
    await store.upsertCircuitState({ ...row, state: 'open', failureCount: 5, lastFailureAt: 999 })
    const cb = await store.getCircuitState('s2')
    expect(cb?.state).toBe('open')
    expect(cb?.failureCount).toBe(5)
    expect(db.prisma.circuitBreakerState.rows).toHaveLength(1)
  })

  it('createHealthTick persists provider + status', async () => {
    const tick = await store.createHealthTick({
      slaveId: 's1',
      providerId: 'claude',
      status: 'running',
      responseMs: 42,
      error: null,
      ts: 1000,
    })
    expect(tick.id).toBeString()
    expect(tick.providerId).toBe('claude')
    expect(tick.status).toBe('running')
    expect(tick.responseMs).toBe(42)
  })

  it('createTraceEntry maps params/result + ok flag, getTrace filters slave', async () => {
    await store.createTraceEntry({
      slaveId: 's1',
      conversationId: 'conv_1',
      method: 'send',
      paramsJson: '{"a":1}',
      resultJson: '{"b":2}',
      durationMs: 10,
    })
    await store.createTraceEntry({ slaveId: 's2', method: 'capture', error: 'boom' })
    const trace = await store.getTrace('s1')
    expect(trace).toHaveLength(1)
    expect(trace[0]?.method).toBe('send')
    expect(trace[0]?.paramsJson).toBe('{"a":1}')
    expect(trace[0]?.conversationId).toBe('conv_1')
  })

  it('getTrace("*") returns entries across all slaves', async () => {
    await store.createTraceEntry({ slaveId: 's1', method: 'send' })
    await store.createTraceEntry({ slaveId: 's2', method: 'capture' })
    const all = await store.getTrace('*')
    expect(all).toHaveLength(2)
  })
})
