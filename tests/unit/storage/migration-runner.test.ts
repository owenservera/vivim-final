// tests/unit/storage/migration-runner.test.ts
// Tests for the MigrationRunner — registration, planning, execution,
// rollback, integrity verification, status reporting, concurrency,
// dry-run, and destructive migration handling.

import { beforeEach, describe, expect, it, mock } from 'bun:test'
import type { CapStoreDb } from '../../../src/storage/db.js'
import { getDb, setDb } from '../../../src/storage/db.js'
import { MigrationRunner } from '../../../src/storage/migration/migration-runner.js'
import type { MigrationContext, MigrationStep } from '../../../src/storage/migration/types.js'

// ── Helpers ───────────────────────────────────────────────────────────

/** Create a simple reversible migration step */
function makeStep(
  overrides: Partial<MigrationStep> & { id: string; version: number },
): MigrationStep {
  return {
    description: `Migration ${overrides.id}`,
    up: [`CREATE TABLE IF NOT EXISTS test_${overrides.id} (id TEXT PRIMARY KEY)`],
    down: [`DROP TABLE IF EXISTS test_${overrides.id}`],
    estimatedDurationMs: 50,
    ...overrides,
  }
}

/** Minimal migration step with no SQL (for upFn tests) */
function makeFnStep(
  overrides: Partial<MigrationStep> & { id: string; version: number },
): MigrationStep {
  return {
    description: `Fn migration ${overrides.id}`,
    up: [],
    down: [],
    ...overrides,
  }
}

/** Mock db that captures raw SQL calls */
function makeMockDb() {
  const executedSql: string[] = []
  const metaStore: Map<string, string> = new Map()

  const prisma = {
    $executeRawUnsafe: mock(async (sql: string) => {
      if (sql.startsWith('SELECT')) return
      executedSql.push(sql)
    }),
    $queryRawUnsafe: mock(async (sql: string) => {
      executedSql.push(sql)
      if (sql.includes(`LIKE '${'migration_record:'}%'`)) {
        const results: Array<{ key: string; value: string }> = []
        for (const [key, value] of metaStore) {
          if (key.startsWith('migration_record:')) {
            results.push({ key, value })
          }
        }
        return results
      }
      return []
    }),
  }

  const fakeDb = { prisma } as unknown as CapStoreDb

  return {
    executedSql,
    metaStore,
    fakeDb,
  }
}

describe('MigrationRunner', () => {
  let runner: MigrationRunner

  beforeEach(() => {
    runner = new MigrationRunner()
  })

  // ── Registration ──────────────────────────────────────────────────

  describe('registration', () => {
    it('registers a single migration', () => {
      const step = makeStep({ id: '001-init', version: 1 })
      runner.register(step)
      const list = runner.listMigrations()
      expect(list).toHaveLength(1)
      expect(list[0].id).toBe('001-init')
      expect(list[0].version).toBe(1)
      expect(list[0].status).toBe('pending')
      expect(list[0].applied).toBe(false)
    })

    it('registers multiple migrations via registerAll', () => {
      const steps = [
        makeStep({ id: '001-init', version: 1 }),
        makeStep({ id: '002-second', version: 2 }),
        makeStep({ id: '003-third', version: 3 }),
      ]
      runner.registerAll(steps)
      expect(runner.listMigrations()).toHaveLength(3)
    })

    it('rejects duplicate migration IDs', () => {
      const step = makeStep({ id: '001-init', version: 1 })
      runner.register(step)
      expect(() => runner.register(step)).toThrow('already registered')
    })
  })

  // ── Plan Creation ─────────────────────────────────────────────────

  describe('plan creation (up)', () => {
    it('creates an empty plan when no migrations are registered', () => {
      const plan = runner.createPlan('up')
      expect(plan.migrations).toHaveLength(0)
      expect(plan.canRollback).toBe(true)
      expect(plan.estimatedDurationMs).toBe(0)
    })

    it('creates a plan with all pending migrations', () => {
      runner.registerAll([
        makeStep({ id: '001-a', version: 1 }),
        makeStep({ id: '002-b', version: 2 }),
      ])
      const plan = runner.createPlan('up')
      expect(plan.migrations).toHaveLength(2)
      expect(plan.migrations[0].id).toBe('001-a')
      expect(plan.migrations[1].id).toBe('002-b')
      expect(plan.canRollback).toBe(true)
      expect(plan.estimatedDurationMs).toBe(100)
    })

    it('excludes already-applied migrations from the up plan', () => {
      runner.registerAll([
        makeStep({ id: '001-a', version: 1 }),
        makeStep({ id: '002-b', version: 2 }),
      ])
      ;(runner as any).records.set('001-a', {
        id: '001-a',
        version: 1,
        description: 'Migration 001-a',
        status: 'completed',
        appliedAt: Date.now(),
        checksum: 'abc',
        durationMs: 10,
      })

      const plan = runner.createPlan('up')
      expect(plan.migrations).toHaveLength(1)
      expect(plan.migrations[0].id).toBe('002-b')
    })

    it('respects targetVersion for up plan', () => {
      runner.registerAll([
        makeStep({ id: '001-a', version: 1 }),
        makeStep({ id: '002-b', version: 2 }),
        makeStep({ id: '003-c', version: 3 }),
      ])
      const plan = runner.createPlan('up', 2)
      expect(plan.migrations).toHaveLength(2)
      expect(plan.migrations.map((m) => m.id)).toEqual(['001-a', '002-b'])
    })

    it('marks canRollback=false for destructive migrations', () => {
      runner.register(
        makeStep({
          id: '001-destructive',
          version: 1,
          destructive: true,
          down: ['DROP TABLE x'],
        }),
      )
      const plan = runner.createPlan('up')
      expect(plan.canRollback).toBe(false)
    })

    it('marks canRollback=false for migrations without down SQL', () => {
      const step: MigrationStep = {
        id: '001-no-down',
        version: 1,
        description: 'Migration without down',
        up: ['SELECT 1'],
      }
      runner.register(step)
      const plan = runner.createPlan('up')
      expect(plan.canRollback).toBe(false)
    })

    it('uses estimatedDurationMs from migration step', () => {
      runner.register(
        makeStep({
          id: '001-custom',
          version: 1,
          estimatedDurationMs: 5000,
          down: ['DROP TABLE x'],
        }),
      )
      const plan = runner.createPlan('up')
      expect(plan.estimatedDurationMs).toBe(5000)
    })
  })

  describe('plan creation (down)', () => {
    it('creates a rollback plan for applied migrations', () => {
      runner.registerAll([
        makeStep({ id: '001-a', version: 1 }),
        makeStep({ id: '002-b', version: 2 }),
        makeStep({ id: '003-c', version: 3 }),
      ])
      for (const id of ['001-a', '002-b']) {
        ;(runner as any).records.set(id, {
          id,
          version: Number(id.split('-')[0]),
          description: `Migration ${id}`,
          status: 'completed',
          appliedAt: Date.now(),
          checksum: 'abc',
          durationMs: 10,
        })
      }

      const plan = runner.createPlan('down')
      expect(plan.migrations).toHaveLength(2)
      expect(plan.migrations[0].id).toBe('002-b')
      expect(plan.migrations[1].id).toBe('001-a')
    })

    it('respects targetVersion for down plan', () => {
      runner.registerAll([
        makeStep({ id: '001-a', version: 1 }),
        makeStep({ id: '002-b', version: 2 }),
        makeStep({ id: '003-c', version: 3 }),
      ])
      for (const id of ['001-a', '002-b', '003-c']) {
        ;(runner as any).records.set(id, {
          id,
          version: Number(id.split('-')[0]),
          description: `Migration ${id}`,
          status: 'completed',
          appliedAt: Date.now(),
          checksum: 'abc',
          durationMs: 10,
        })
      }

      const plan = runner.createPlan('down', 1)
      expect(plan.migrations).toHaveLength(2)
      expect(plan.migrations[0].id).toBe('003-c')
      expect(plan.migrations[1].id).toBe('002-b')
    })
  })

  // ── Dependency Ordering ──────────────────────────────────────────

  describe('dependency ordering', () => {
    it('sorts migrations by version when no dependencies', () => {
      runner.registerAll([
        makeStep({ id: '003-c', version: 3 }),
        makeStep({ id: '001-a', version: 1 }),
        makeStep({ id: '002-b', version: 2 }),
      ])
      const plan = runner.createPlan('up')
      expect(plan.migrations.map((m) => m.id)).toEqual(['001-a', '002-b', '003-c'])
    })

    it('respects explicit dependencies', () => {
      runner.registerAll([
        makeStep({ id: '001-a', version: 1 }),
        makeStep({ id: '003-c', version: 3, dependsOn: ['002-b'] }),
        makeStep({ id: '002-b', version: 2, dependsOn: ['001-a'] }),
      ])
      const plan = runner.createPlan('up')
      expect(plan.migrations.map((m) => m.id)).toEqual(['001-a', '002-b', '003-c'])
    })

    it('throws on missing dependency', () => {
      runner.register(
        makeStep({
          id: '002-b',
          version: 2,
          dependsOn: ['001-nonexistent'],
        }),
      )
      expect(() => runner.createPlan('up')).toThrow(/depends on.*not registered/)
    })

    it('detects circular dependencies', () => {
      runner.registerAll([
        makeStep({ id: '001-a', version: 1, dependsOn: ['002-b'] }),
        makeStep({ id: '002-b', version: 2, dependsOn: ['001-a'] }),
      ])
      expect(() => runner.createPlan('up')).toThrow(/Circular dependency/)
    })
  })

  // ── Schema Version ───────────────────────────────────────────────

  describe('getSchemaVersion', () => {
    it('returns version 0 with no applied migrations', () => {
      const version = runner.getSchemaVersion()
      expect(version.version).toBe(0)
      expect(version.name).toBe('base')
      expect(version.appliedMigrations).toEqual([])
      expect(version.lastAppliedAt).toBeUndefined()
    })

    it('returns the highest applied version', () => {
      runner.registerAll([
        makeStep({ id: '001-a', version: 1 }),
        makeStep({ id: '002-b', version: 2 }),
      ])
      ;(runner as any).records.set('001-a', {
        id: '001-a',
        version: 1,
        description: '',
        status: 'completed',
        appliedAt: 1000,
        checksum: 'a',
        durationMs: 10,
      })
      ;(runner as any).records.set('002-b', {
        id: '002-b',
        version: 2,
        description: '',
        status: 'completed',
        appliedAt: 2000,
        checksum: 'b',
        durationMs: 10,
      })

      const version = runner.getSchemaVersion()
      expect(version.version).toBe(2)
      expect(version.name).toBe('v2')
      expect(version.appliedMigrations).toEqual(['001-a', '002-b'])
      expect(version.lastAppliedAt).toBe(2000)
    })

    it('ignores failed migrations when computing version', () => {
      runner.registerAll([
        makeStep({ id: '001-a', version: 1 }),
        makeStep({ id: '002-b', version: 2 }),
        makeStep({ id: '003-c', version: 3 }),
      ])
      ;(runner as any).records.set('001-a', {
        id: '001-a',
        version: 1,
        description: '',
        status: 'completed',
        appliedAt: 1000,
        checksum: 'a',
        durationMs: 10,
      })
      ;(runner as any).records.set('002-b', {
        id: '002-b',
        version: 2,
        description: '',
        status: 'failed',
        appliedAt: 2000,
        checksum: 'b',
        durationMs: 10,
      })

      const version = runner.getSchemaVersion()
      expect(version.version).toBe(1)
    })
  })

  // ── Status ───────────────────────────────────────────────────────

  describe('getStatus', () => {
    it('reports correct counts with no migrations', () => {
      const status = runner.getStatus()
      expect(status).toEqual({ total: 0, applied: 0, pending: 0, failed: 0 })
    })

    it('reports all pending when nothing applied', () => {
      runner.registerAll([
        makeStep({ id: '001-a', version: 1 }),
        makeStep({ id: '002-b', version: 2 }),
      ])
      const status = runner.getStatus()
      expect(status).toEqual({ total: 2, applied: 0, pending: 2, failed: 0 })
    })

    it('reports mixed statuses', () => {
      runner.registerAll([
        makeStep({ id: '001-a', version: 1 }),
        makeStep({ id: '002-b', version: 2 }),
        makeStep({ id: '003-c', version: 3 }),
      ])
      ;(runner as any).records.set('001-a', {
        id: '001-a',
        version: 1,
        description: '',
        status: 'completed',
        appliedAt: 1000,
        checksum: 'a',
        durationMs: 10,
      })
      ;(runner as any).records.set('003-c', {
        id: '003-c',
        version: 3,
        description: '',
        status: 'failed',
        appliedAt: 3000,
        checksum: 'c',
        durationMs: 10,
      })

      const status = runner.getStatus()
      expect(status).toEqual({ total: 3, applied: 1, pending: 1, failed: 1 })
    })
  })

  // ── List Migrations ──────────────────────────────────────────────

  describe('listMigrations', () => {
    it('returns migrations in dependency order', () => {
      runner.registerAll([
        makeStep({ id: '003-c', version: 3 }),
        makeStep({ id: '001-a', version: 1 }),
        makeStep({ id: '002-b', version: 2 }),
      ])
      const list = runner.listMigrations()
      expect(list.map((m) => m.id)).toEqual(['001-a', '002-b', '003-c'])
    })

    it('shows applied status for completed records', () => {
      runner.registerAll([
        makeStep({ id: '001-a', version: 1 }),
        makeStep({ id: '002-b', version: 2 }),
      ])
      ;(runner as any).records.set('001-a', {
        id: '001-a',
        version: 1,
        description: 'Migration 001-a',
        status: 'completed',
        appliedAt: 1000,
        checksum: 'a',
        durationMs: 10,
      })

      const list = runner.listMigrations()
      expect(list[0].applied).toBe(true)
      expect(list[0].status).toBe('completed')
      expect(list[1].applied).toBe(false)
      expect(list[1].status).toBe('pending')
    })
  })

  // ── Integrity Verification ───────────────────────────────────────

  describe('verifyIntegrity', () => {
    it('returns valid when no records exist', async () => {
      runner.register(makeStep({ id: '001-a', version: 1 }))
      const result = await runner.verifyIntegrity()
      expect(result.valid).toBe(true)
      expect(result.issues).toHaveLength(0)
    })

    it('detects checksum mismatch for applied migrations', async () => {
      const step = makeStep({ id: '001-a', version: 1, up: ['SELECT 1'], down: ['SELECT 2'] })
      runner.register(step)
      ;(runner as any).records.set('001-a', {
        id: '001-a',
        version: 1,
        description: 'Migration 001-a',
        status: 'completed',
        appliedAt: 1000,
        checksum: 'wrong_checksum_value',
        durationMs: 10,
      })

      const result = await runner.verifyIntegrity()
      expect(result.valid).toBe(false)
      expect(result.issues.length).toBeGreaterThan(0)
      expect(result.issues[0]).toContain('checksum mismatch')
    })

    it('detects applied migrations that are no longer registered', async () => {
      ;(runner as any).records.set('999-ghost', {
        id: '999-ghost',
        version: 999,
        description: 'Ghost',
        status: 'completed',
        appliedAt: 1000,
        checksum: 'x',
        durationMs: 0,
      })

      const result = await runner.verifyIntegrity()
      expect(result.valid).toBe(false)
      expect(result.issues[0]).toContain('not registered')
    })

    it('passes when checksums match', async () => {
      const step = makeStep({ id: '001-a', version: 1, up: ['SELECT 1'], down: ['SELECT 2'] })
      runner.register(step)

      const realChecksum = await Bun.CryptoHasher.hash('sha256', 'SELECT 1', 'hex')
      ;(runner as any).records.set('001-a', {
        id: '001-a',
        version: 1,
        description: 'Migration 001-a',
        status: 'completed',
        appliedAt: 1000,
        checksum: realChecksum,
        durationMs: 10,
      })

      const result = await runner.verifyIntegrity()
      expect(result.valid).toBe(true)
      expect(result.issues).toHaveLength(0)
    })
  })

  // ── Dry Run Mode ─────────────────────────────────────────────────

  describe('dry run mode', () => {
    it('returns records without executing SQL in dry run', async () => {
      runner.registerAll([
        makeStep({ id: '001-a', version: 1 }),
        makeStep({ id: '002-b', version: 2 }),
      ])

      const plan = runner.createPlan('up')
      const results = await runner.executePlan(plan, { dryRun: true })

      expect(results).toHaveLength(2)
      expect(results[0].id).toBe('001-a')
      expect(results[0].status).toBe('completed')
      expect(results[0].durationMs).toBe(0)
      expect(results[1].id).toBe('002-b')
    })

    it('returns empty array for empty plan in dry run', async () => {
      const plan = runner.createPlan('up')
      const results = await runner.executePlan(plan, { dryRun: true })
      expect(results).toHaveLength(0)
    })
  })

  // ── Concurrent Migration Prevention ──────────────────────────────

  describe('concurrent migration prevention', () => {
    it('throws when executePlan is called while another is running', async () => {
      const runner2 = new MigrationRunner()
      runner2.register(makeStep({ id: '001-a', version: 1 }))
      ;(runner2 as any).locked = true

      const plan = runner2.createPlan('up')
      try {
        await runner2.executePlan(plan)
        expect.unreachable('Should have thrown')
      } catch (err) {
        expect((err as Error).message).toContain('already running')
      } finally {
        ;(runner2 as any).locked = false
      }
    })
  })

  // ── Destructive Migration Handling ───────────────────────────────

  describe('destructive migration handling', () => {
    it('plan marks canRollback=false when destructive migration present', () => {
      runner.registerAll([
        makeStep({ id: '001-safe', version: 1, down: ['DROP TABLE x'] }),
        makeStep({ id: '002-destructive', version: 2, destructive: true, down: ['DROP TABLE y'] }),
      ])
      const plan = runner.createPlan('up')
      expect(plan.canRollback).toBe(false)
    })

    it('plan allows rollback when all migrations are non-destructive', () => {
      runner.registerAll([
        makeStep({ id: '001-safe', version: 1, down: ['DROP TABLE x'] }),
        makeStep({ id: '002-safe', version: 2, down: ['DROP TABLE y'] }),
      ])
      const plan = runner.createPlan('up')
      expect(plan.canRollback).toBe(true)
    })

    it('rollback() throws when plan contains destructive migrations', async () => {
      runner.registerAll([
        makeStep({ id: '001-safe', version: 1, down: ['DROP TABLE x'] }),
        makeStep({ id: '002-destructive', version: 2, destructive: true }),
      ])
      for (const id of ['001-safe', '002-destructive']) {
        ;(runner as any).records.set(id, {
          id,
          version: Number(id.split('-')[0]),
          description: `Migration ${id}`,
          status: 'completed',
          appliedAt: Date.now(),
          checksum: 'abc',
          durationMs: 10,
        })
      }

      await expect(runner.rollback(0)).rejects.toThrow(/not safe/)
      await expect(runner.rollback(0)).rejects.toThrow(/Destructive migrations/)
    })

    it('rollback() throws when migration has no down SQL or downFn', async () => {
      runner.register(makeFnStep({ id: '001-no-down', version: 1 }))
      ;(runner as any).records.set('001-no-down', {
        id: '001-no-down',
        version: 1,
        description: '',
        status: 'completed',
        appliedAt: 1000,
        checksum: 'a',
        durationMs: 10,
      })

      await expect(runner.rollback(0)).rejects.toThrow(/not safe/)
      await expect(runner.rollback(0)).rejects.toThrow(/No rollback defined/)
    })
  })

  // ── Plan Execution with SQL (mocked DB) ──────────────────────────

  describe('plan execution with SQL', () => {
    // Use setDb/getDb from db.ts to inject a mock — avoids readonly-module issues.
    let previousDb: CapStoreDb | null = null

    function installMock(mockDb: ReturnType<typeof makeMockDb>) {
      previousDb = getDb()
      setDb(mockDb.fakeDb)
    }

    function restoreDb() {
      if (previousDb) {
        setDb(previousDb)
        previousDb = null
      }
    }

    it('executes SQL statements for up migration', async () => {
      const mockDb = makeMockDb()
      installMock(mockDb)

      try {
        const testRunner = new MigrationRunner()
        testRunner.register(
          makeStep({
            id: '001-create-test',
            version: 1,
            up: ['CREATE TABLE test_table (id TEXT PRIMARY KEY)'],
            down: ['DROP TABLE IF EXISTS test_table'],
          }),
        )

        const plan = testRunner.createPlan('up')
        const results = await testRunner.executePlan(plan)

        expect(results).toHaveLength(1)
        expect(results[0].id).toBe('001-create-test')
        expect(results[0].status).toBe('completed')
        expect(results[0].durationMs).toBeGreaterThanOrEqual(0)

        const createTableCalls = mockDb.executedSql.filter((s) =>
          s.includes('CREATE TABLE test_table'),
        )
        expect(createTableCalls.length).toBe(1)
      } finally {
        restoreDb()
      }
    })

    it('executes upFn for migrations with JS functions', async () => {
      let fnCalled = false
      const mockDb = makeMockDb()
      installMock(mockDb)

      try {
        const testRunner = new MigrationRunner()
        testRunner.register(
          makeFnStep({
            id: '001-fn-migration',
            version: 1,
            upFn: async (_ctx: MigrationContext) => {
              fnCalled = true
            },
          }),
        )

        const plan = testRunner.createPlan('up')
        await testRunner.executePlan(plan)

        expect(fnCalled).toBe(true)
      } finally {
        restoreDb()
      }
    })

    it('records failed status when migration throws', async () => {
      const mockDb = makeMockDb()
      installMock(mockDb)

      try {
        const testRunner = new MigrationRunner()
        testRunner.register(
          makeFnStep({
            id: '001-failing',
            version: 1,
            upFn: async () => {
              throw new Error('Migration blew up')
            },
          }),
        )

        const plan = testRunner.createPlan('up')
        await expect(testRunner.executePlan(plan)).rejects.toThrow('Migration blew up')

        const status = testRunner.getStatus()
        expect(status.failed).toBe(1)
      } finally {
        restoreDb()
      }
    })
  })

  // ── Rollback Execution ───────────────────────────────────────────

  describe('rollback execution', () => {
    let previousDb: CapStoreDb | null = null

    function installMock(mockDb: ReturnType<typeof makeMockDb>) {
      previousDb = getDb()
      setDb(mockDb.fakeDb)
    }

    function restoreDb() {
      if (previousDb) {
        setDb(previousDb)
        previousDb = null
      }
    }

    it('executes down SQL statements in reverse order', async () => {
      const mockDb = makeMockDb()
      installMock(mockDb)

      try {
        const testRunner = new MigrationRunner()
        testRunner.registerAll([
          makeStep({
            id: '001-a',
            version: 1,
            up: ['CREATE TABLE a (id TEXT PRIMARY KEY)'],
            down: ['DROP TABLE IF EXISTS a'],
          }),
          makeStep({
            id: '002-b',
            version: 2,
            up: ['CREATE TABLE b (id TEXT PRIMARY KEY)'],
            down: ['DROP TABLE IF EXISTS b'],
          }),
        ])

        for (const id of ['001-a', '002-b']) {
          ;(testRunner as any).records.set(id, {
            id,
            version: Number(id.split('-')[0]),
            description: `Migration ${id}`,
            status: 'completed',
            appliedAt: Date.now(),
            checksum: 'abc',
            durationMs: 10,
          })
        }

        const results = await testRunner.rollback(0)
        expect(results).toHaveLength(2)
        expect(results[0].id).toBe('002-b')
        expect(results[0].status).toBe('rolled_back')
        expect(results[1].id).toBe('001-a')
        expect(results[1].status).toBe('rolled_back')

        const dropCalls = mockDb.executedSql.filter((s) => s.includes('DROP TABLE'))
        expect(dropCalls.length).toBeGreaterThanOrEqual(2)
      } finally {
        restoreDb()
      }
    })

    it('executes downFn for rollback with JS functions', async () => {
      let downFnCalled = false
      const mockDb = makeMockDb()
      installMock(mockDb)

      try {
        const testRunner = new MigrationRunner()
        testRunner.register(
          makeFnStep({
            id: '001-fn',
            version: 1,
            downFn: async () => {
              downFnCalled = true
            },
          }),
        )
        ;(testRunner as any).records.set('001-fn', {
          id: '001-fn',
          version: 1,
          description: '',
          status: 'completed',
          appliedAt: 1000,
          checksum: 'a',
          durationMs: 10,
        })

        await testRunner.rollback(0)
        expect(downFnCalled).toBe(true)
      } finally {
        restoreDb()
      }
    })
  })

  // ── Edge Cases ───────────────────────────────────────────────────

  describe('edge cases', () => {
    let previousDb: CapStoreDb | null = null

    function installMock(mockDb: ReturnType<typeof makeMockDb>) {
      previousDb = getDb()
      setDb(mockDb.fakeDb)
    }

    function restoreDb() {
      if (previousDb) {
        setDb(previousDb)
        previousDb = null
      }
    }

    it('handles empty up array with only upFn', async () => {
      const mockDb = makeMockDb()
      installMock(mockDb)

      try {
        const testRunner = new MigrationRunner()
        testRunner.register(
          makeFnStep({
            id: '001-fn-only',
            version: 1,
            up: [],
            upFn: async () => {},
            down: [],
            downFn: async () => {},
          }),
        )

        const plan = testRunner.createPlan('up')
        const results = await testRunner.executePlan(plan)
        expect(results).toHaveLength(1)
        expect(results[0].status).toBe('completed')
      } finally {
        restoreDb()
      }
    })

    it('migration context provides the correct direction for up', async () => {
      let capturedDirection: string | undefined
      const mockDb = makeMockDb()
      installMock(mockDb)

      try {
        const testRunner = new MigrationRunner()
        testRunner.register(
          makeFnStep({
            id: '001-ctx-test',
            version: 1,
            upFn: async (ctx: MigrationContext) => {
              capturedDirection = ctx.direction
            },
          }),
        )

        const plan = testRunner.createPlan('up')
        await testRunner.executePlan(plan)
        expect(capturedDirection).toBe('up')
      } finally {
        restoreDb()
      }
    })

    it('migration context state map is fresh per migration', async () => {
      const states: Map<string, unknown>[] = []
      const mockDb = makeMockDb()
      installMock(mockDb)

      try {
        const testRunner = new MigrationRunner()
        testRunner.registerAll([
          makeFnStep({
            id: '001-first',
            version: 1,
            upFn: async (ctx: MigrationContext) => {
              ctx.state.set('key', 'value-from-001')
              states.push(ctx.state)
            },
          }),
          makeFnStep({
            id: '002-second',
            version: 2,
            upFn: async (ctx: MigrationContext) => {
              states.push(ctx.state)
            },
          }),
        ])

        const plan = testRunner.createPlan('up')
        await testRunner.executePlan(plan)
        expect(states).toHaveLength(2)
        expect(states[0].get('key')).toBe('value-from-001')
        expect(states[1].has('key')).toBe(false)
      } finally {
        restoreDb()
      }
    })
  })
})
