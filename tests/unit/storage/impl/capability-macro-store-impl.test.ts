// tests/unit/storage/impl/capability-macro-store-impl.test.ts
// CapabilityMacroStoreImpl — Prisma-backed CapabilityMacroStore tests

import { beforeEach, describe, expect, test } from 'bun:test'
import type {
  CapabilityMacroRow,
  CapabilityMacroStore,
} from '../../../../src/engines/capability-macro.js'
import type { CapStoreDb } from '../../../../src/storage/db.js'
import { CapabilityMacroStoreImpl } from '../../../../src/storage/impl/capability-macro-store-impl.js'

function createMockDb() {
  const macros = new Map<string, CapabilityMacroRow>()
  const prisma = {
    capabilityMacro: {
      async findMany({ where }: { where?: Record<string, unknown> }) {
        let rows = Array.from(macros.values())
        if (where?.isActive !== undefined)
          rows = rows.filter((r) => Boolean(r.isActive) === Boolean(where.isActive))
        if (where?.providerId) rows = rows.filter((r) => r.providerId === where.providerId)
        return rows
      },
      async findUnique({ where }: { where: { id: string } }) {
        return macros.get(where.id) ?? null
      },
      async create({ data }: { data: CapabilityMacroRow }) {
        macros.set(data.id, data)
      },
      async update({ where, data }: { where: { id: string }; data: Record<string, unknown> }) {
        const m = macros.get(where.id)
        if (m) Object.assign(m, data)
      },
      async delete({ where }: { where: { id: string } }) {
        macros.delete(where.id)
      },
    },
  }
  return { prisma } as unknown as CapStoreDb
}

describe('CapabilityMacroStoreImpl', () => {
  let db: CapStoreDb
  let store: CapabilityMacroStore

  beforeEach(() => {
    db = createMockDb()
    store = new CapabilityMacroStoreImpl(db)
  })

  test('create and get round-trip', async () => {
    const row: CapabilityMacroRow = {
      id: 'cm-1',
      name: 'Test Macro',
      description: 'desc',
      providerId: null,
      dagJson: '{}',
      isActive: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    await store.create(row)
    const result = await store.get('cm-1')
    expect(result).not.toBeNull()
    expect(result!.name).toBe('Test Macro')
    expect(result!.isActive).toBe(true)
  })

  test('list returns all macros', async () => {
    await store.create({
      id: 'cm-a',
      name: 'A',
      description: null,
      providerId: null,
      dagJson: '{}',
      isActive: true,
      createdAt: 1,
      updatedAt: 1,
    })
    await store.create({
      id: 'cm-b',
      name: 'B',
      description: null,
      providerId: null,
      dagJson: '{}',
      isActive: false,
      createdAt: 2,
      updatedAt: 2,
    })
    const all = await store.list()
    expect(all).toHaveLength(2)
    const active = await store.list({ activeOnly: true })
    expect(active).toHaveLength(1)
  })

  test('update patches fields', async () => {
    await store.create({
      id: 'cm-1',
      name: 'Old',
      description: null,
      providerId: null,
      dagJson: '{}',
      isActive: true,
      createdAt: 1,
      updatedAt: 1,
    })
    await store.update('cm-1', { name: 'New' })
    const result = await store.get('cm-1')
    expect(result!.name).toBe('New')
  })

  test('delete removes macro', async () => {
    await store.create({
      id: 'cm-1',
      name: 'Del',
      description: null,
      providerId: null,
      dagJson: '{}',
      isActive: true,
      createdAt: 1,
      updatedAt: 1,
    })
    await store.delete('cm-1')
    expect(await store.get('cm-1')).toBeNull()
  })
})
