// tests/unit/storage/impl/automation-store-impl.test.ts
// AutomationStoreImpl — Prisma-backed AutomationStore tests

import { beforeEach, describe, expect, test } from 'bun:test'
import type {
  Automation,
  AutomationStore,
} from '../../../../src/storage/contracts/automation-store.js'
import type { CapStoreDb } from '../../../../src/storage/db.js'
import { AutomationStoreImpl } from '../../../../src/storage/impl/automation-store-impl.js'

function createMockDb() {
  const schedules = new Map<
    string,
    {
      id: string
      name: string
      scheduleType: string
      scheduleValue: string
      actionConfigJson: string
      isActive: number
      lastRunAt: number | null
      nextRunAt: number | null
      createdAt: number
      updatedAt: number
    }
  >()
  const prisma = {
    automationSchedule: {
      async upsert({
        where,
        create,
      }: {
        where: { id: string }
        create: Record<string, unknown>
        update: Record<string, unknown>
      }) {
        const existing = schedules.get(where.id)
        if (existing) {
          Object.assign(existing, create)
        } else {
          schedules.set(where.id, create as never)
        }
      },
      async findUnique({ where }: { where: { id: string } }) {
        return schedules.get(where.id) ?? null
      },
      async findMany({ where }: { where?: Record<string, unknown> }) {
        let rows = Array.from(schedules.values())
        if (where?.isActive !== undefined) rows = rows.filter((r) => r.isActive === where.isActive)
        return rows
      },
      async update({ where, data }: { where: { id: string }; data: Record<string, unknown> }) {
        const s = schedules.get(where.id)
        if (s) Object.assign(s, data)
      },
      async delete({ where }: { where: { id: string } }) {
        schedules.delete(where.id)
      },
    },
  }
  return { prisma } as unknown as CapStoreDb
}

describe('AutomationStoreImpl', () => {
  let db: CapStoreDb
  let store: AutomationStore

  beforeEach(() => {
    db = createMockDb()
    store = new AutomationStoreImpl(db)
  })

  test('save and findById round-trip', async () => {
    const auto: Automation = {
      id: 'auto-1',
      name: 'Test Auto',
      type: 'cron',
      schedule: '0 * * * *',
      enabled: true,
      config: { key: 'val' },
      createdAt: Date.now(),
    }
    await store.save(auto)
    const result = await store.findById('auto-1')
    expect(result).not.toBeNull()
    expect(result!.name).toBe('Test Auto')
    expect(result!.config).toEqual({ key: 'val' })
  })

  test('listEnabled returns only enabled', async () => {
    await store.save({
      id: 'a1',
      name: 'On',
      type: 'cron',
      enabled: true,
      config: {},
      createdAt: 1,
    })
    await store.save({
      id: 'a2',
      name: 'Off',
      type: 'cron',
      enabled: false,
      config: {},
      createdAt: 2,
    })
    const result = await store.listEnabled()
    expect(result).toHaveLength(1)
    expect(result[0]!.name).toBe('On')
  })

  test('updateLastRun sets timestamp', async () => {
    await store.save({
      id: 'a1',
      name: 'Test',
      type: 'cron',
      enabled: true,
      config: {},
      createdAt: 1,
    })
    await store.updateLastRun('a1', 99999)
    const result = await store.findById('a1')
    expect(result!.lastRunAt).toBe(99999)
  })

  test('delete removes automation', async () => {
    await store.save({
      id: 'a1',
      name: 'Del',
      type: 'cron',
      enabled: true,
      config: {},
      createdAt: 1,
    })
    await store.delete('a1')
    expect(await store.findById('a1')).toBeNull()
  })
})
