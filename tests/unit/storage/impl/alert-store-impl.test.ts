// tests/unit/storage/impl/alert-store-impl.test.ts
// AlertStoreImpl — Prisma-backed AlertStore tests

import { beforeEach, describe, expect, test } from 'bun:test'
import type { Alert, AlertStore } from '../../../../src/storage/contracts/alert-store.js'
import type { CapStoreDb } from '../../../../src/storage/db.js'
import { AlertStoreImpl } from '../../../../src/storage/impl/alert-store-impl.js'

function createMockDb() {
  const events: Array<{
    id: string
    conditionId: string
    firedAt: number
    acknowledged: number
    acknowledgedAt: number | null
  }> = []
  const prisma = {
    alertEvent: {
      async create({
        data,
      }: {
        data: { id: string; conditionId: string; firedAt: number; acknowledged: number }
      }) {
        events.push({ ...data, acknowledgedAt: null })
      },
      async findUnique({ where }: { where: { id: string } }) {
        return events.find((e) => e.id === where.id) ?? null
      },
      async findMany({ where, take }: { where: Record<string, unknown>; take?: number }) {
        let filtered = events
        if (where.acknowledged !== undefined)
          filtered = filtered.filter((e) => e.acknowledged === where.acknowledged)
        return filtered.slice(0, take ?? 50)
      },
      async update({ where, data }: { where: { id: string }; data: Record<string, unknown> }) {
        const e = events.find((ev) => ev.id === where.id)
        if (e) Object.assign(e, data)
      },
      async delete({ where }: { where: { id: string } }) {
        const idx = events.findIndex((e) => e.id === where.id)
        if (idx >= 0) events.splice(idx, 1)
      },
    },
  }
  return { prisma } as unknown as CapStoreDb
}

describe('AlertStoreImpl', () => {
  let db: CapStoreDb
  let store: AlertStore

  beforeEach(() => {
    db = createMockDb()
    store = new AlertStoreImpl(db)
  })

  test('save and findById round-trip', async () => {
    const alert: Alert = {
      id: 'alert-1',
      type: 'test',
      severity: 'warning',
      source: 'src',
      message: 'test alert',
      acknowledged: false,
      createdAt: Date.now(),
    }
    await store.save(alert)
    const result = await store.findById('alert-1')
    expect(result).not.toBeNull()
    expect(result?.id).toBe('alert-1')
    expect(result?.acknowledged).toBe(false)
  })

  test('findUnacknowledged returns only unacknowledged', async () => {
    await store.save({
      id: 'a1',
      type: 't',
      severity: 'info',
      source: 's',
      message: 'm',
      acknowledged: false,
      createdAt: 1,
    })
    await store.save({
      id: 'a2',
      type: 't',
      severity: 'info',
      source: 's',
      message: 'm',
      acknowledged: true,
      createdAt: 2,
    })
    const result = await store.findUnacknowledged()
    expect(result).toHaveLength(1)
    expect(result[0]?.id).toBe('a1')
  })

  test('acknowledge marks alert as acknowledged', async () => {
    await store.save({
      id: 'a1',
      type: 't',
      severity: 'info',
      source: 's',
      message: 'm',
      acknowledged: false,
      createdAt: 1,
    })
    await store.acknowledge('a1')
    const result = await store.findById('a1')
    expect(result?.acknowledged).toBe(true)
  })

  test('delete removes alert', async () => {
    await store.save({
      id: 'a1',
      type: 't',
      severity: 'info',
      source: 's',
      message: 'm',
      acknowledged: false,
      createdAt: 1,
    })
    await store.delete('a1')
    expect(await store.findById('a1')).toBeNull()
  })
})
