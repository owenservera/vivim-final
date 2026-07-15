// tests/unit/storage/impl/harness-checkpoint-store-impl.test.ts
// HarnessCheckpointStoreImpl — Prisma-backed HarnessCheckpointStore tests

import { beforeEach, describe, expect, test } from 'bun:test'
import type {
  HarnessCheckpointRow,
  HarnessCheckpointStore,
} from '../../../../src/engines/harness-checkpoint.js'
import type { CapStoreDb } from '../../../../src/storage/db.js'
import { HarnessCheckpointStoreImpl } from '../../../../src/storage/impl/harness-checkpoint-store-impl.js'

function createMockDb() {
  const checkpoints: HarnessCheckpointRow[] = []
  const prisma = {
    harnessCheckpoint: {
      async create({ data }: { data: HarnessCheckpointRow }) {
        checkpoints.push(data)
      },
      async findFirst({
        where,
        orderBy,
      }: { where: Record<string, unknown>; orderBy?: Record<string, string> }) {
        const filtered = checkpoints.filter((c) => {
          if (where.slaveId) return c.slaveId === where.slaveId
          if (where.conversationId) return c.conversationId === where.conversationId
          return true
        })
        if (orderBy?.createdAt === 'desc') filtered.sort((a, b) => b.createdAt - a.createdAt)
        return filtered[0] ?? null
      },
      async deleteMany({ where }: { where: Record<string, unknown> }) {
        const idx = checkpoints.findIndex((c) => c.slaveId === where.slaveId)
        if (idx >= 0) checkpoints.splice(idx, 1)
      },
    },
  }
  return { prisma } as unknown as CapStoreDb
}

describe('HarnessCheckpointStoreImpl', () => {
  let db: CapStoreDb
  let store: HarnessCheckpointStore

  beforeEach(() => {
    db = createMockDb()
    store = new HarnessCheckpointStoreImpl(db)
  })

  test('create and getLatestBySlave round-trip', async () => {
    const row: HarnessCheckpointRow = {
      id: 'cp-1',
      slaveId: 'slave-1',
      conversationId: null,
      activeDagJson: '{"nodes":[]}',
      dagPosition: 0,
      loadedModulesJson: '[]',
      pageUrl: null,
      pageTitle: null,
      authState: null,
      createdAt: Date.now(),
    }
    await store.create(row)
    const result = await store.getLatestBySlave('slave-1')
    expect(result).not.toBeNull()
    expect(result?.id).toBe('cp-1')
    expect(result?.slaveId).toBe('slave-1')
  })

  test('getLatestByConversation returns latest checkpoint', async () => {
    await store.create({
      id: 'cp-1',
      slaveId: 's1',
      conversationId: 'conv-1',
      activeDagJson: null,
      dagPosition: null,
      loadedModulesJson: '[]',
      pageUrl: null,
      pageTitle: null,
      authState: null,
      createdAt: 100,
    })
    await store.create({
      id: 'cp-2',
      slaveId: 's1',
      conversationId: 'conv-1',
      activeDagJson: null,
      dagPosition: 5,
      loadedModulesJson: '[]',
      pageUrl: null,
      pageTitle: null,
      authState: null,
      createdAt: 200,
    })
    const result = await store.getLatestByConversation('conv-1')
    expect(result?.id).toBe('cp-2')
    expect(result?.dagPosition).toBe(5)
  })

  test('deleteBySlave removes checkpoints', async () => {
    await store.create({
      id: 'cp-1',
      slaveId: 's1',
      conversationId: null,
      activeDagJson: null,
      dagPosition: null,
      loadedModulesJson: '[]',
      pageUrl: null,
      pageTitle: null,
      authState: null,
      createdAt: 100,
    })
    await store.deleteBySlave('s1')
    expect(await store.getLatestBySlave('s1')).toBeNull()
  })
})
