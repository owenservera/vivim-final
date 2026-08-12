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
  {
    id: '001-embed-reindex-v1',
    description: 'Invalidate pre-HF embeddings (minilm:ts, tfidf); rebuild lazily on next index()',
    version: 1,
    tags: ['embedding', 'reindex'],
    up: [`DELETE FROM memory_embedding WHERE model IN ('minilm:ts', 'tfidf')`],
    down: [],
    estimatedDurationMs: 500,
  },
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
