// src/storage/migration/index.ts
// Barrel exports for the data migration framework.
//
// This framework complements Prisma schema migrations by handling DATA
// transformations — column value reshaping, bulk backfills, JSON
// structure migrations, etc.

// ── Runner ────────────────────────────────────────────────────────────
export { MigrationRunner } from './migration-runner.js'
// ── Registry ──────────────────────────────────────────────────────────
export {
  getMaxVersion,
  getMigrationsByTag,
  getMigrationsUpTo,
  MIGRATIONS,
} from './migrations-registry.js'
// ── Types ─────────────────────────────────────────────────────────────
export type {
  MigrationContext,
  MigrationDirection,
  MigrationPlan,
  MigrationRecord,
  MigrationStatus,
  MigrationStep,
  SchemaVersion,
  SerializedMigrationRecord,
} from './types.js'

// ── Convenience ───────────────────────────────────────────────────────

import { getLogger } from '../../lib/logger.js'
import { createPreMigrationSnapshot, restoreFromSnapshot } from '../snapshot.js'
import { MigrationRunner } from './migration-runner.js'
import { MIGRATIONS } from './migrations-registry.js'

const log = getLogger('migration:index')

/**
 * Create and initialize a MigrationRunner pre-loaded with all registered
 * migrations from the central registry.
 *
 * Usage:
 * ```ts
 * const runner = await createMigrationRunner()
 * const plan = runner.createPlan('up')
 * await runner.executePlan(plan)
 * ```
 */
export async function createMigrationRunner(): Promise<MigrationRunner> {
  const runner = new MigrationRunner()
  runner.registerAll(MIGRATIONS)
  await runner.init()
  return runner
}

/**
 * Apply all pending data migrations. This is the primary entry point
 * for bootstrapping / upgrading the data layer at server startup.
 *
 * Creates a pre-migration snapshot of both DBs before executing.
 * On failure, automatically restores from the snapshot and re-throws.
 *
 * @returns The migration records for applied migrations (empty if already up-to-date).
 */
export async function applyPendingMigrations(opts?: { dryRun?: boolean }) {
  const runner = await createMigrationRunner()
  const plan = runner.createPlan('up')

  if (plan.migrations.length === 0) {
    return []
  }

  // Create pre-migration snapshot (skip for dry runs)
  let snapshotDir: string | undefined
  if (!opts?.dryRun) {
    try {
      snapshotDir = createPreMigrationSnapshot()
      log.info(
        { snapshotDir, migrationCount: plan.migrations.length },
        'Pre-migration snapshot created',
      )
    } catch (err) {
      log.error({ err }, 'Failed to create pre-migration snapshot — aborting migration')
      throw err
    }
  }

  try {
    const results = await runner.executePlan(plan, opts)
    if (snapshotDir) {
      log.info({ snapshotDir, applied: results.length }, 'Migration completed successfully')
    }
    return results
  } catch (err) {
    // Rollback: restore from snapshot on failure
    if (snapshotDir) {
      log.error({ err, snapshotDir }, 'Migration failed — restoring from snapshot')
      try {
        await restoreFromSnapshot(snapshotDir, { skipVersionCheck: true })
        log.info({ snapshotDir }, 'Successfully restored from pre-migration snapshot')
      } catch (restoreErr) {
        log.error({ restoreErr, snapshotDir }, 'CRITICAL: Snapshot restore also failed')
        throw restoreErr
      }
    }
    throw err
  }
}

/**
 * Verify the integrity of all applied data migrations.
 * Useful as a health-check at server startup.
 *
 * @returns Integrity check result with any issues found.
 */
export async function verifyMigrationIntegrity() {
  const runner = await createMigrationRunner()
  return runner.verifyIntegrity()
}
