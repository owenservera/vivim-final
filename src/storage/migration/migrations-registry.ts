// src/storage/migration/migrations-registry.ts
// Central registry of all data model migrations.
//
// This framework handles DATA migrations (transformations), not schema
// migrations which are managed by Prisma.  Data migrations reshape column
// values, backfill computed fields, migrate JSON structures, etc.

import type { MigrationStep } from './types.js'

/**
 * All known data migrations in version order.
 * Add new migrations here as the data model evolves.
 *
 * Convention:
 *   - ID:  `NNN-descriptive-kebab-name`  (zero-padded, monotonically increasing)
 *   - Version: monotonically increasing integer matching the NNN prefix
 *   - Every migration MUST be idempotent (safe to re-run)
 *   - Prefer SQL-only `up`/`down` for simple transformations
 *   - Use `upFn`/`downFn` for complex multi-step transformations
 *   - Tag with categories for filtering (e.g., 'provider', 'conversation', 'telemetry')
 */
export const MIGRATIONS: MigrationStep[] = [
  // ── Example template (uncomment and adapt when needed) ────────────
  // {
  //   id: '001-add-session-lifecycle-table',
  //   description: 'Add session lifecycle tracking table',
  //   version: 1,
  //   tags: ['schema', 'session'],
  //   up: [
  //     `CREATE TABLE IF NOT EXISTS session_lifecycle (
  //        id TEXT PRIMARY KEY,
  //        provider_session_id TEXT NOT NULL REFERENCES provider_session(id),
  //        event_type TEXT NOT NULL,
  //        payload_json TEXT DEFAULT '{}',
  //        ts INTEGER NOT NULL
  //      )`,
  //   ],
  //   down: [
  //     `DROP TABLE IF EXISTS session_lifecycle`,
  //   ],
  //   estimatedDurationMs: 500,
  // },
  //
  // {
  //   id: '002-backfill-provider-display-names',
  //   description: 'Backfill display_name from displayName for legacy providers',
  //   version: 2,
  //   tags: ['provider', 'backfill'],
  //   dependsOn: ['001-add-session-lifecycle-table'],
  //   up: [
  //     `UPDATE provider_definition SET display_name = COALESCE(display_name, slug)
  //      WHERE display_name = '' OR display_name IS NULL`,
  //   ],
  //   down: [],
  //   estimatedDurationMs: 200,
  // },
]

/**
 * Get migrations filtered by tag.
 *
 * @param tag  The tag to filter by (e.g., 'provider', 'conversation').
 * @returns Migrations that have the specified tag.
 */
export function getMigrationsByTag(tag: string): MigrationStep[] {
  return MIGRATIONS.filter((m) => m.tags?.includes(tag))
}

/**
 * Get migrations up to a specific version (inclusive).
 *
 * @param maxVersion  Maximum version to include.
 * @returns Migrations with version <= maxVersion.
 */
export function getMigrationsUpTo(maxVersion: number): MigrationStep[] {
  return MIGRATIONS.filter((m) => m.version <= maxVersion)
}

/**
 * Get the highest version number in the registry.
 *
 * @returns The maximum version, or 0 if no migrations are registered.
 */
export function getMaxVersion(): number {
  if (MIGRATIONS.length === 0) return 0
  return Math.max(...MIGRATIONS.map((m) => m.version))
}
