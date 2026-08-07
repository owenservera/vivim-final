// src/storage/migration/migration-runner.ts
// Migration runner — applies and rolls back data migrations.
// Complements Prisma schema migrations by handling DATA transformations
// (column value reshaping, bulk updates, etc.).

import { catchDebug } from '../../lib/catch-logger.js'
import { getLogger } from '../../lib/logger.js'
import { getDb } from '../db.js'
import type {
  MigrationContext,
  MigrationDirection,
  MigrationPlan,
  MigrationRecord,
  MigrationStatus,
  MigrationStep,
  SchemaVersion,
  SerializedMigrationRecord,
} from './types.js'

const log = getLogger('migration-runner')

/** SchemaMeta key prefix used to store migration records */
const META_KEY_PREFIX = 'migration_record:'

/** SchemaMeta key for tracking the current schema version */
const SCHEMA_VERSION_KEY = 'schema_version'

/**
 * Compute a SHA-256 checksum over the SQL statements of a migration step.
 * Used for integrity verification — if the SQL changes between runs the
 * checksum mismatch is flagged.
 */
async function computeChecksum(
  step: MigrationStep,
  direction: MigrationDirection,
): Promise<string> {
  const sql = direction === 'up' ? step.up.join('\n') : (step.down ?? []).join('\n')
  return await Bun.CryptoHasher.hash('sha256', sql, 'hex')
}

export class MigrationRunner {
  private readonly migrations = new Map<string, MigrationStep>()
  private readonly records = new Map<string, MigrationRecord>()
  private recordsLoaded = false
  private locked = false

  // ── Registration ────────────────────────────────────────────────────

  /** Register a single migration step. */
  register(step: MigrationStep): void {
    if (this.migrations.has(step.id)) {
      throw new Error(`Migration "${step.id}" is already registered`)
    }
    // Dependencies are validated at plan-creation time, not at registration.
    this.migrations.set(step.id, step)
  }

  /** Register multiple migrations at once. */
  registerAll(steps: MigrationStep[]): void {
    for (const step of steps) {
      this.register(step)
    }
  }

  // ── Plan Creation ───────────────────────────────────────────────────

  /**
   * Create a migration plan for applying pending (up) or rolling back (down) migrations.
   *
   * @param direction  'up' (default) to apply pending migrations, 'down' to roll back.
   * @param targetVersion  If specified, only include migrations up to / down to this version.
   */
  createPlan(direction: MigrationDirection = 'up', targetVersion?: number): MigrationPlan {
    this.validateDependencies()

    const sorted = this.topologicalSort()
    const appliedVersions = this.getAppliedVersions()

    if (direction === 'up') {
      return this.createUpPlan(sorted, appliedVersions, targetVersion)
    }
    return this.createDownPlan(sorted, appliedVersions, targetVersion)
  }

  private createUpPlan(
    sorted: MigrationStep[],
    appliedVersions: Set<number>,
    targetVersion?: number,
  ): MigrationPlan {
    const pending: MigrationStep[] = []
    let canRollback = true
    let estimatedMs = 0

    for (const step of sorted) {
      // Skip already-applied migrations
      if (appliedVersions.has(step.version)) continue
      // If a target version is set, skip migrations beyond it
      if (targetVersion !== undefined && step.version > targetVersion) continue
      pending.push(step)
      estimatedMs += step.estimatedDurationMs ?? 1000
      if (step.destructive || !step.down?.length) {
        canRollback = false
      }
    }

    return { migrations: pending, canRollback, estimatedDurationMs: estimatedMs }
  }

  private createDownPlan(
    sorted: MigrationStep[],
    appliedVersions: Set<number>,
    targetVersion?: number,
  ): MigrationPlan {
    // For rollback, iterate in reverse version order
    const applied = sorted.filter((s) => appliedVersions.has(s.version))
    const toRollback: MigrationStep[] = []
    let canRollback = true
    let estimatedMs = 0

    for (let i = applied.length - 1; i >= 0; i--) {
      const step = applied[i]
      if (!step) continue
      // If a target version is set, stop when we've rolled back to it
      if (targetVersion !== undefined && step.version <= targetVersion) break
      if (step.destructive) {
        canRollback = false
      }
      if (!step.down?.length && !step.downFn) {
        canRollback = false
      }
      toRollback.push(step)
      estimatedMs += step.estimatedDurationMs ?? 1000
    }

    return { migrations: toRollback, canRollback, estimatedDurationMs: estimatedMs }
  }

  // ── Plan Execution ──────────────────────────────────────────────────

  /**
   * Execute a migration plan.
   *
   * @param plan  The migration plan to execute.
   * @param opts.dryRun  If true, log what would happen without making changes.
   * @returns Array of migration records for each applied migration.
   */
  async executePlan(plan: MigrationPlan, opts?: { dryRun?: boolean }): Promise<MigrationRecord[]> {
    if (this.locked) {
      throw new Error('Migration is already running — concurrent execution is not allowed')
    }

    if (plan.migrations.length === 0) {
      log.info('No migrations to apply')
      return []
    }

    // Determine direction from the plan: if all migrations have applied records → down, else → up
    // We rely on the caller to create the plan with the right direction context.
    // The direction is inferred from whether the first migration is already applied.
    const firstMigration = plan.migrations[0]
    if (!firstMigration) {
      return []
    }
    const firstRecord = this.records.get(firstMigration.id)
    const direction: MigrationDirection = firstRecord?.status === 'completed' ? 'down' : 'up'

    this.locked = true
    const results: MigrationRecord[] = []

    try {
      for (const step of plan.migrations) {
        log.info(
          { migration: step.id, version: step.version, dryRun: opts?.dryRun },
          `${opts?.dryRun ? '[DRY RUN] ' : ''}${direction === 'up' ? 'Applying' : 'Rolling back'} migration: ${step.description}`,
        )

        if (opts?.dryRun) {
          // In dry-run mode, produce a synthetic record without persisting
          results.push({
            id: step.id,
            version: step.version,
            description: step.description,
            status: 'completed',
            appliedAt: Date.now(),
            checksum: await computeChecksum(step, direction),
            durationMs: 0,
          })
          continue
        }

        const record = await this.applyMigration(step, direction)
        results.push(record)
      }

      // Update schema version meta
      if (!opts?.dryRun) {
        await this.persistSchemaVersion(
          direction === 'up' ? results[results.length - 1] : undefined,
        )
      }
    } finally {
      this.locked = false
    }

    return results
  }

  /** Apply (or roll back) a single migration. */
  private async applyMigration(
    step: MigrationStep,
    direction: MigrationDirection,
  ): Promise<MigrationRecord> {
    const db = getDb()
    const ctx = this.createContext(direction)
    const startTime = Date.now()
    const checksum = await computeChecksum(step, direction)

    // Update status to 'running'
    const runningRecord: MigrationRecord = {
      id: step.id,
      version: step.version,
      description: step.description,
      status: 'running',
      appliedAt: Date.now(),
      checksum,
      durationMs: 0,
    }
    await this.saveRecord(runningRecord)

    try {
      if (direction === 'up') {
        // Execute SQL statements
        for (const sql of step.up) {
          ctx.log.info(`Executing SQL: ${sql.slice(0, 120)}${sql.length > 120 ? '...' : ''}`)
          await db.prisma.$executeRawUnsafe(sql)
        }
        // Execute JS migration function if present
        if (step.upFn) {
          await step.upFn(ctx)
        }
      } else {
        // Rollback: execute down SQL statements
        if (step.down) {
          for (const sql of step.down) {
            ctx.log.info(
              `Executing rollback SQL: ${sql.slice(0, 120)}${sql.length > 120 ? '...' : ''}`,
            )
            await db.prisma.$executeRawUnsafe(sql)
          }
        }
        // Execute JS rollback function if present
        if (step.downFn) {
          await step.downFn(ctx)
        }
      }

      const durationMs = Date.now() - startTime
      const completedRecord: MigrationRecord = {
        id: step.id,
        version: step.version,
        description: step.description,
        status: direction === 'up' ? 'completed' : 'rolled_back',
        appliedAt: startTime,
        rollbackAt: direction === 'down' ? Date.now() : undefined,
        checksum,
        durationMs,
      }

      await this.saveRecord(completedRecord)
      this.records.set(step.id, completedRecord)

      log.info(
        { migration: step.id, version: step.version, durationMs, direction },
        `Migration ${direction === 'up' ? 'applied' : 'rolled back'} successfully`,
      )

      return completedRecord
    } catch (err) {
      catchDebug(err, 'storage:migration:migration-runner:277')
      const durationMs = Date.now() - startTime
      const failedRecord: MigrationRecord = {
        id: step.id,
        version: step.version,
        description: step.description,
        status: 'failed',
        appliedAt: startTime,
        checksum,
        durationMs,
      }
      await this.saveRecord(failedRecord).catch((saveErr) => {
        log.error({ err: saveErr }, 'Failed to persist failed migration record')
      })
      this.records.set(step.id, failedRecord)

      log.error(
        { migration: step.id, version: step.version, err, durationMs },
        `Migration ${direction} failed`,
      )
      throw err
    }
  }

  // ── Rollback ────────────────────────────────────────────────────────

  /**
   * Roll back to a specific schema version.
   * All migrations with version > targetVersion will be rolled back in reverse order.
   */
  async rollback(targetVersion: number): Promise<MigrationRecord[]> {
    const plan = this.createPlan('down', targetVersion)

    if (!plan.canRollback) {
      const destructive = plan.migrations.filter((m) => m.destructive)
      const noDown = plan.migrations.filter((m) => !m.down?.length && !m.downFn)
      const reasons: string[] = []
      if (destructive.length > 0) {
        reasons.push(`Destructive migrations: ${destructive.map((m) => m.id).join(', ')}`)
      }
      if (noDown.length > 0) {
        reasons.push(`No rollback defined: ${noDown.map((m) => m.id).join(', ')}`)
      }
      throw new Error(`Rollback is not safe: ${reasons.join('; ')}`)
    }

    return this.executePlan(plan)
  }

  // ── Schema Version ──────────────────────────────────────────────────

  /** Get the current schema version information. */
  getSchemaVersion(): SchemaVersion {
    const applied = Array.from(this.records.values())
      .filter((r) => r.status === 'completed')
      .sort((a, b) => a.version - b.version)

    const lastApplied = applied[applied.length - 1]
    const version = lastApplied ? lastApplied.version : 0
    const name = version === 0 ? 'base' : `v${version}`
    const appliedMigrations = applied.map((r) => r.id)
    const lastAppliedAt = lastApplied ? lastApplied.appliedAt : undefined

    return { version, name, appliedMigrations, lastAppliedAt }
  }

  // ── Status ──────────────────────────────────────────────────────────

  /** Get a summary of migration status. */
  getStatus(): {
    total: number
    applied: number
    pending: number
    failed: number
  } {
    const total = this.migrations.size
    let applied = 0
    let failed = 0

    for (const [id, _step] of this.migrations) {
      const record = this.records.get(id)
      if (record?.status === 'completed') {
        applied++
      } else if (record?.status === 'failed') {
        failed++
      }
    }

    return {
      total,
      applied,
      pending: total - applied - failed,
      failed,
    }
  }

  // ── Integrity Verification ──────────────────────────────────────────

  /**
   * Verify the integrity of applied migrations by comparing stored
   * checksums against the current migration definitions.
   */
  async verifyIntegrity(): Promise<{ valid: boolean; issues: string[] }> {
    await this.loadRecords()
    const issues: string[] = []

    for (const [id, step] of this.migrations) {
      const record = this.records.get(id)
      if (!record || record.status !== 'completed') continue

      const currentChecksum = await computeChecksum(step, 'up')
      if (record.checksum !== currentChecksum) {
        issues.push(
          `Migration "${id}" (v${step.version}): checksum mismatch. ` +
            `Stored: ${record.checksum}, Current: ${currentChecksum}`,
        )
      }
    }

    // Check for applied migrations that are no longer registered
    for (const [id, record] of this.records) {
      if (record.status === 'completed' && !this.migrations.has(id)) {
        issues.push(`Migration "${id}" is recorded as applied but is not registered in the runner`)
      }
    }

    return { valid: issues.length === 0, issues }
  }

  // ── Listing ─────────────────────────────────────────────────────────

  /** List all registered migrations with their current status. */
  listMigrations(): Array<{
    id: string
    version: number
    description: string
    status: MigrationStatus
    applied: boolean
  }> {
    const sorted = this.topologicalSort()
    return sorted.map((step) => {
      const record = this.records.get(step.id)
      return {
        id: step.id,
        version: step.version,
        description: step.description,
        status: record?.status ?? 'pending',
        applied: record?.status === 'completed',
      }
    })
  }

  // ── Record Persistence (SchemaMeta) ─────────────────────────────────

  /**
   * Load migration records from the SchemaMeta table.
   * Each record is stored with key `migration_record:<id>`.
   */
  private async loadRecords(): Promise<void> {
    if (this.recordsLoaded) return
    this.recordsLoaded = true

    try {
      const db = getDb()
      // SchemaMeta has a composite key [key, value], so we query by prefix.
      // Prisma doesn't natively support prefix queries on SchemaMeta,
      // so we use a raw query.
      const rows = await db.prisma.$queryRawUnsafe<Array<{ key: string; value: string }>>(
        `SELECT key, value FROM "SchemaMeta" WHERE key LIKE '${META_KEY_PREFIX}%'`,
      )

      for (const row of rows) {
        const id = row.key.slice(META_KEY_PREFIX.length)
        try {
          const parsed: SerializedMigrationRecord = JSON.parse(row.value)
          this.records.set(id, parsed)
        } catch {
          log.warn({ key: row.key }, 'Failed to parse migration record from SchemaMeta')
        }
      }
    } catch (err) {
      // Table might not exist yet — that's fine for a fresh install.
      log.debug({ err }, 'Could not load migration records (possibly fresh install)')
    }
  }

  /**
   * Save a migration record to the SchemaMeta table.
   * Uses upsert semantics via the composite key [key, value].
   */
  private async saveRecord(record: MigrationRecord): Promise<void> {
    const db = getDb()
    const key = `${META_KEY_PREFIX}${record.id}`
    const value = JSON.stringify(record)

    // Delete the old record first (SchemaMeta has a composite PK so we
    // can't upsert directly — the value is part of the key).
    await db.prisma.$executeRawUnsafe(
      `DELETE FROM "SchemaMeta" WHERE key = '${key.replace(/'/g, "''")}'`,
    )
    await db.prisma.$executeRawUnsafe(
      `INSERT INTO "SchemaMeta" (key, value) VALUES ('${key.replace(/'/g, "''")}', '${value.replace(/'/g, "''")}')`,
    )
  }

  /**
   * Persist the current schema version to SchemaMeta.
   * @param latestRecord  The most recently applied migration record (undefined if rolled back to base).
   */
  private async persistSchemaVersion(latestRecord?: MigrationRecord): Promise<void> {
    const db = getDb()
    const version = latestRecord?.version ?? 0
    const value = JSON.stringify({ version, name: version === 0 ? 'base' : `v${version}` })

    await db.prisma.$executeRawUnsafe(
      `DELETE FROM "SchemaMeta" WHERE key = '${SCHEMA_VERSION_KEY}'`,
    )
    await db.prisma.$executeRawUnsafe(
      `INSERT INTO "SchemaMeta" (key, value) VALUES ('${SCHEMA_VERSION_KEY}', '${value.replace(/'/g, "''")}')`,
    )
  }

  // ── Context Factory ─────────────────────────────────────────────────

  private createContext(direction: MigrationDirection): MigrationContext {
    const migrationLog = getLogger('migration')
    return {
      db: getDb(),
      direction,
      log: {
        info: (msg: string) => migrationLog.info({ direction }, msg),
        warn: (msg: string) => migrationLog.warn({ direction }, msg),
        error: (msg: string) => migrationLog.error({ direction }, msg),
      },
      state: new Map(),
    }
  }

  // ── Topological Sort ────────────────────────────────────────────────

  /**
   * Sort registered migrations in dependency order (Kahn's algorithm).
   * Migrations with no dependencies come first.
   */
  private topologicalSort(): MigrationStep[] {
    const inDegree = new Map<string, number>()
    const dependents = new Map<string, string[]>()

    for (const [id] of this.migrations) {
      inDegree.set(id, 0)
      dependents.set(id, [])
    }

    for (const [id, step] of this.migrations) {
      const deps = step.dependsOn ?? []
      inDegree.set(id, deps.length)
      for (const dep of deps) {
        const children = dependents.get(dep) ?? []
        children.push(id)
        dependents.set(dep, children)
      }
    }

    // Start with nodes that have no dependencies
    const queue: string[] = []
    for (const [id, degree] of inDegree) {
      if (degree === 0) queue.push(id)
    }

    // Sort queue entries by version for deterministic output
    queue.sort(
      (a, b) => (this.migrations.get(a)?.version ?? 0) - (this.migrations.get(b)?.version ?? 0),
    )

    const sorted: MigrationStep[] = []
    while (queue.length > 0) {
      const id = queue.shift()
      if (!id) break
      const step = this.migrations.get(id)
      if (step) sorted.push(step)

      const children = dependents.get(id) ?? []
      for (const child of children) {
        const newDegree = (inDegree.get(child) ?? 1) - 1
        inDegree.set(child, newDegree)
        if (newDegree === 0) {
          // Insert in version-sorted position
          const childVersion = this.migrations.get(child)?.version ?? 0
          const insertIdx = queue.findIndex(
            (qId) => (this.migrations.get(qId)?.version ?? 0) > childVersion,
          )
          if (insertIdx === -1) {
            queue.push(child)
          } else {
            queue.splice(insertIdx, 0, child)
          }
        }
      }
    }

    // If we didn't visit all migrations, there's a cycle
    if (sorted.length !== this.migrations.size) {
      const visited = new Set(sorted.map((s) => s.id))
      const unvisited = Array.from(this.migrations.keys()).filter((id) => !visited.has(id))
      throw new Error(`Circular dependency detected among migrations: ${unvisited.join(', ')}`)
    }

    return sorted
  }

  /** Validate that all declared dependencies exist. */
  private validateDependencies(): void {
    for (const [id, step] of this.migrations) {
      const deps = step.dependsOn ?? []
      for (const dep of deps) {
        if (!this.migrations.has(dep)) {
          throw new Error(`Migration "${id}" depends on "${dep}" which is not registered`)
        }
      }
    }
  }

  // ── Helpers ─────────────────────────────────────────────────────────

  /** Get the set of version numbers that have been successfully applied. */
  private getAppliedVersions(): Set<number> {
    const versions = new Set<number>()
    for (const record of this.records.values()) {
      if (record.status === 'completed') {
        versions.add(record.version)
      }
    }
    return versions
  }

  /**
   * Ensure records are loaded. Public entry point for callers who need
   * records loaded before calling getSchemaVersion / getStatus.
   */
  async init(): Promise<void> {
    await this.loadRecords()
  }
}
