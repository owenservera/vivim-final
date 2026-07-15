import { describe, expect, it } from 'bun:test'
import type { CapStoreDb } from '../../../src/storage/db.js'
import { closeDb, configurePrisma, getDb, setDb } from '../../../src/storage/db.js'

// Minimal fake PrismaClient that records every raw pragma it was asked to run.
function makeFakePrisma(opts: { failJournalMode?: boolean } = {}) {
  const calls: string[] = []
  const prisma = {
    calls,
    $queryRawUnsafe: async (sql: string) => {
      calls.push(sql)
      if (opts.failJournalMode && /PRAGMA journal_mode =/.test(sql)) {
        throw new Error('mock journal_mode failure')
      }
      // The trailing readback `PRAGMA journal_mode` returns the current mode.
      if (/PRAGMA journal_mode$/.test(sql)) {
        return [{ journal_mode: 'wal' }]
      }
      return []
    },
  }
  return prisma
}

function makeFakeDb(opts?: { failJournalMode?: boolean }) {
  const prisma = makeFakePrisma(opts)
  const closeCalls: number[] = []
  const db = {
    prisma,
    close: async () => {
      closeCalls.push(1)
    },
  } as unknown as CapStoreDb
  return { db, prisma, closeCalls }
}

describe('configurePrisma (1.1)', () => {
  it('applies the WAL pragma set via the single authority path', async () => {
    const { db, prisma } = makeFakeDb()
    await configurePrisma(db)
    expect(prisma.calls.some((c) => c === 'PRAGMA journal_mode = WAL')).toBe(true)
    expect(prisma.calls.some((c) => c === 'PRAGMA busy_timeout = 5000')).toBe(true)
    expect(prisma.calls.some((c) => c === 'PRAGMA foreign_keys = ON')).toBe(true)
    expect(prisma.calls.some((c) => c === 'PRAGMA synchronous = NORMAL')).toBe(true)
    expect(prisma.calls.some((c) => c === 'PRAGMA cache_size = -64000')).toBe(true)
  })

  it('throws only on journal_mode failure, not on other pragmas', async () => {
    const { db } = makeFakeDb({ failJournalMode: true })
    await expect(configurePrisma(db)).rejects.toThrow(/journal_mode/)
  })

  it('is idempotent — re-applying is safe', async () => {
    const { db, prisma } = makeFakeDb()
    await configurePrisma(db)
    await configurePrisma(db)
    // journal_mode requested twice, no error raised
    expect(prisma.calls.filter((c) => c === 'PRAGMA journal_mode = WAL').length).toBe(2)
  })
})

describe('closeDb (1.1)', () => {
  it('closes the singleton exactly once even if called repeatedly', async () => {
    const { db, closeCalls } = makeFakeDb()
    setDb(db)
    await closeDb()
    await closeDb()
    await closeDb()
    expect(closeCalls.length).toBe(1)
  })

  it('replaces the singleton on next getDb()', async () => {
    const { db } = makeFakeDb()
    setDb(db)
    await closeDb()
    // getDb() lazily rebuilds a fresh singleton (no throw even after close).
    expect(() => getDb()).not.toThrow()
  })
})
