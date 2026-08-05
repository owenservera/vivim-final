// src/storage/migration/types.ts
// Data model versioning and migration framework types.

/** Migration direction */
export type MigrationDirection = 'up' | 'down'

/** Migration status */
export type MigrationStatus = 'pending' | 'running' | 'completed' | 'failed' | 'rolled_back'

/** A single migration step */
export interface MigrationStep {
  /** Unique migration identifier (e.g., '001-create-provider-tables') */
  id: string
  /** Human-readable description */
  description: string
  /** Migration version (monotonically increasing) */
  version: number
  /** Dependencies — other migration IDs that must run first */
  dependsOn?: string[]
  /** Tags for categorization */
  tags?: string[]
  /** SQL statements to run for 'up' migration */
  up: string[]
  /** SQL statements to run for 'down' migration (rollback) */
  down?: string[]
  /** Optional JavaScript migration function (for complex transformations) */
  upFn?: (ctx: MigrationContext) => Promise<void>
  downFn?: (ctx: MigrationContext) => Promise<void>
  /** Whether this migration is destructive (cannot be rolled back safely) */
  destructive?: boolean
  /** Estimated duration in ms */
  estimatedDurationMs?: number
}

/** Migration context passed to migration functions */
export interface MigrationContext {
  /** Database connection for executing SQL */
  db: import('../db.js').CapStoreDb
  /** Migration direction */
  direction: MigrationDirection
  /** Logger for this migration */
  log: { info: (msg: string) => void; warn: (msg: string) => void; error: (msg: string) => void }
  /** Store arbitrary migration state */
  state: Map<string, unknown>
}

/** Migration record (persisted in database via SchemaMeta) */
export interface MigrationRecord {
  id: string
  version: number
  description: string
  status: MigrationStatus
  appliedAt: number
  rollbackAt?: number
  checksum: string
  durationMs: number
}

/** Migration plan — ordered list of migrations to apply */
export interface MigrationPlan {
  /** Migrations to apply */
  migrations: MigrationStep[]
  /** Whether rollback is possible for all migrations in the plan */
  canRollback: boolean
  /** Estimated total duration */
  estimatedDurationMs: number
}

/** Schema version descriptor */
export interface SchemaVersion {
  /** Current schema version number */
  version: number
  /** Human-readable version name */
  name: string
  /** Applied migration IDs */
  appliedMigrations: string[]
  /** Last migration applied at */
  lastAppliedAt?: number
}

/** Serialized migration record stored in SchemaMeta value column (JSON) */
export interface SerializedMigrationRecord {
  id: string
  version: number
  description: string
  status: MigrationStatus
  appliedAt: number
  rollbackAt?: number
  checksum: string
  durationMs: number
}
