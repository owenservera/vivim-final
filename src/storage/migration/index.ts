// src/storage/migration/index.ts
// Barrel exports for the data migration framework.
//
// This framework complements Prisma schema migrations by handling DATA
// transformations — column value reshaping, bulk backfills, JSON
// structure migrations, etc.

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

// ── Runner ────────────────────────────────────────────────────────────
export { MigrationRunner } from './migration-runner.js'

// ── Registry ──────────────────────────────────────────────────────────
export {
  MIGRATIONS,
  getMigrationsByTag,
  getMigrationsUpTo,
  getMaxVersion,
} from './migrations-registry.js'

// ── Convenience ───────────────────────────────────────────────────────

import { MigrationRunner } from './migration-runner.js'
import { MIGRATIONS } from './migrations-registry.js'

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
 * @returns The migration records for applied migrations (empty if already up-to-date).
 */
export async function applyPendingMigrations(opts?: { dryRun?: boolean }) {
  const runner = await createMigrationRunner()
  const plan = runner.createPlan('up')
  return runner.executePlan(plan, opts)
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
