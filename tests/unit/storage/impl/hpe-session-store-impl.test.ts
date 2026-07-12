// tests/unit/storage/impl/hpe-session-store-impl.test.ts
// HpeSessionStoreImpl — Prisma-backed HpeSessionStoreContract tests

import { beforeEach, describe, expect, test } from 'bun:test'
import type {
  HpeSession,
  HpeSessionStoreContract,
} from '../../../../src/storage/contracts/hpe-session-store.js'
import type { CapStoreDb } from '../../../../src/storage/db.js'
import { HpeSessionStoreImpl } from '../../../../src/storage/impl/hpe-session-store-impl.js'

function createMockDb() {
  const sessions = new Map<
    string,
    {
      id: string
      agentId: string
      prompt: string
      response: string | null
      actions: string
      status: string
      startedAt: number
      completedAt: number | null
    }
  >()
  const prisma = {
    hpeSession: {
      async upsert({
        where,
        create,
      }: {
        where: { id: string }
        create: Record<string, unknown>
        update: Record<string, unknown>
      }) {
        const existing = sessions.get(where.id)
        if (existing) {
          Object.assign(existing, create)
        } else {
          sessions.set(where.id, create as never)
        }
      },
      async findUnique({ where }: { where: { id: string } }) {
        return sessions.get(where.id) ?? null
      },
      async findMany({ where, take }: { where: Record<string, unknown>; take?: number }) {
        let rows = Array.from(sessions.values())
        if (where.agentId) rows = rows.filter((s) => s.agentId === where.agentId)
        return rows.slice(0, take ?? 50)
      },
      async update({ where, data }: { where: { id: string }; data: Record<string, unknown> }) {
        const s = sessions.get(where.id)
        if (s) Object.assign(s, data)
      },
    },
  }
  return { prisma } as unknown as CapStoreDb
}

describe('HpeSessionStoreImpl', () => {
  let db: CapStoreDb
  let store: HpeSessionStoreContract

  beforeEach(() => {
    db = createMockDb()
    store = new HpeSessionStoreImpl(db)
  })

  test('save and findById round-trip', async () => {
    const session: HpeSession = {
      id: 'hs-1',
      agentId: 'agent-1',
      prompt: 'hello',
      actions: '[]',
      status: 'pending',
      startedAt: Date.now(),
    }
    await store.save(session)
    const result = await store.findById('hs-1')
    expect(result).not.toBeNull()
    expect(result!.prompt).toBe('hello')
    expect(result!.status).toBe('pending')
  })

  test('findByAgent returns sessions for agent', async () => {
    await store.save({
      id: 'hs-1',
      agentId: 'a1',
      prompt: 'p1',
      actions: '[]',
      status: 'pending',
      startedAt: 100,
    })
    await store.save({
      id: 'hs-2',
      agentId: 'a2',
      prompt: 'p2',
      actions: '[]',
      status: 'pending',
      startedAt: 200,
    })
    const result = await store.findByAgent('a1')
    expect(result).toHaveLength(1)
    expect(result[0]!.agentId).toBe('a1')
  })

  test('updateStatus changes status and sets completedAt', async () => {
    await store.save({
      id: 'hs-1',
      agentId: 'a1',
      prompt: 'p',
      actions: '[]',
      status: 'pending',
      startedAt: 100,
    })
    await store.updateStatus('hs-1', 'completed')
    const result = await store.findById('hs-1')
    expect(result!.status).toBe('completed')
    expect(result!.completedAt).toBeTruthy()
  })
})
