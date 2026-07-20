// src/storage/cozo/cozo-layer.ts
// CozoLayer — embedded CozoDB (graph + vector) projection over SQLite source of truth.
// ADR-014: SQLite is the single source of truth. Cozo is a rebuildable index.
// Fail-open: Cozo errors are logged, never thrown to callers.
//
// Ported from OG `cozo_layer.rs` — mirrors its API surface:
//   open → initSchema → runScript → project → close
//
// Package: cozo-node@0.7.6 (native N-API, auto-downloads prebuilt binary).
// Engine: "sqlite" for file-backed persistence, "mem" for tests.

import type { CozoDb as CozoDbInstance } from 'cozo-node'

// ── Types ──────────────────────────────────────────────────────────────────────

export interface CozoLayerOpts {
  /** Path to the Cozo sqlite file. Default: "./data/cozo.db" */
  path?: string
  /** Engine: "sqlite" (file-backed) or "mem" (in-memory, for tests). */
  engine?: 'sqlite' | 'mem'
}

export interface CozoQueryResult {
  headers: string[]
  rows: unknown[][]
}

export interface CozoScriptResult {
  status?: string
  headers?: string[]
  rows?: unknown[][]
}

// ── DDL ────────────────────────────────────────────────────────────────────────
// Graph + LCG schema — ported from OG `cozo_layer.rs` + `lcg/schema.rs`.
// These are the relations Cozo manages. SQLite remains the source of truth.

const GRAPH_DDL: string[] = [
  // Core graph relations
  ':create Account {id => provider_id, email}',
  ':create Conversation {id => account_id, provider, state, updated_at}',
  ':create Acus {id => author_did, type, state, parent_id, indexed_at}',
  ':create CapEntry {id => provider_id, name, version, status, confidence}',
  ':create Memory {id => account_id, memory_type, importance, is_active}',
  ':create AccountHasConv {account_id, conv_id}',
  ':create AcuParent {child_id => parent_id}',
  ':create AcuEdge {id => src, tgt, relation, weight}',
  ':create CapEdge {id => src, tgt, relationship}',
  ':create MemRel {id => src, tgt, rel_type, strength}',
  ':create EntityAlias {alias_id => canonical_id}',
  ':create lcg_state {key => value}',
]

const LCG_DDL: string[] = [
  // LCG: Local Conversation Graph — entity extraction + project inference
  ':create Entity {id => name, kind, canonical, first_seen, last_seen, mention_count, doc_freq, embedding: <F32;1536>}',
  ':create ConvMeta {id => provider, account_id, title, updated_at, msg_count, centroid: <F32;1536>}',
  ':create ConvEntity {conv_id, entity_id, weight, raw_count, provider, account_id, conv_updated_at}',
  ':create Project {id => name, status, confidence, is_user_confirmed, providers, created_at, updated_at, device_id, rev, updated_by, valid_from, superseded_at}',
  ':create ProjectMembership {project_id, conv_id, score, method, added_at, device_id, rev, updated_by, valid_from, superseded_at}',
]

// Relations that can be rebuilt from SQLite (ADR-014 projection set).
// If Cozo is corrupted, only these need rebuilding.
export const GRAPH_TREES = [
  'Account',
  'Conversation',
  'Acus',
  'CapEntry',
  'Memory',
  'AccountHasConv',
  'AcuParent',
  'AcuEdge',
  'CapEdge',
  'MemRel',
  'EntityAlias',
  'lcg_state',
  'Entity',
  'ConvMeta',
  'ConvEntity',
  'Project',
  'ProjectMembership',
]

// ── CozoLayer ──────────────────────────────────────────────────────────────────

export class CozoLayer {
  private db: CozoDbInstance | null = null
  private readonly path: string
  private readonly engine: 'sqlite' | 'mem'
  private initialized = false

  constructor(opts?: CozoLayerOpts) {
    this.path = opts?.path ?? './data/cozo.db'
    this.engine = opts?.engine ?? 'sqlite'
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  /**
   * Open the Cozo database and create tables if needed.
   * Idempotent: `:create` on an existing relation is a no-op (tolerated).
   */
  async open(): Promise<void> {
    if (this.db) return

    // Dynamic import — cozo-node is optional; callers who don't install it
    // get a clear error at open time rather than at import time.
    let CozoDbCtor: typeof CozoDbInstance
    try {
      const mod = await import('cozo-node')
      CozoDbCtor = mod.CozoDb
    } catch (err) {
      throw new CozoOpenError(
        `cozo-node package not available. Install with: bun add cozo-node. ${(err as Error).message}`,
      )
    }

    try {
      this.db = new CozoDbCtor(this.engine, this.path, {})
    } catch (err) {
      throw new CozoOpenError(`Failed to open Cozo at ${this.path}: ${(err as Error).message}`)
    }
  }

  /**
   * Initialize the schema — creates all graph + LCG relations.
   * Each `:create` is idempotent (Cozo tolerates "already exists").
   */
  async initSchema(): Promise<void> {
    this.ensureOpen()
    const db = this.db
    if (!db) return
    const allDdl = [...GRAPH_DDL, ...LCG_DDL]
    for (const stmt of allDdl) {
      try {
        await db.run(stmt)
      } catch (err) {
        // Fail-open: log but don't throw. Relation may already exist.
        console.warn(`[cozo] initSchema warn (ignored): ${(err as Error).message}`)
      }
    }
    this.initialized = true
  }

  /**
   * Run a CozoScript query. Returns the full result with headers + rows.
   * Fail-open: if Cozo throws, returns null and logs the error.
   */
  async runScript(
    script: string,
    params?: Record<string, unknown>,
  ): Promise<CozoQueryResult | null> {
    this.ensureOpen()
    const db = this.db
    if (!db) return null
    try {
      const result = await db.run(script, params ?? {})
      return {
        headers: result.headers ?? [],
        rows: result.rows ?? [],
      }
    } catch (err) {
      console.error(`[cozo] runScript error (fail-open): ${(err as Error).message}`)
      return null
    }
  }

  /**
   * Run a mutating CozoScript (the default). Convenience alias for runScript.
   */
  async runMut(script: string, params?: Record<string, unknown>): Promise<CozoQueryResult | null> {
    return this.runScript(script, params)
  }

  /**
   * Project a single row into a Cozo relation.
   * Used AFTER a successful SQLite commit to keep Cozo in sync.
   * `columns` and `values` must have the same length.
   */
  async project(relation: string, columns: string[], values: unknown[]): Promise<void> {
    if (columns.length !== values.length) {
      console.error('[cozo] project: columns/values length mismatch')
      return
    }

    const params: Record<string, unknown> = {}
    const colPlaceholders: string[] = []
    const valPlaceholders: string[] = []

    for (let i = 0; i < columns.length; i++) {
      const name = columns[i]
      if (name === undefined) continue
      const paramName = `p${i}`
      params[paramName] = values[i]
      colPlaceholders.push(name)
      valPlaceholders.push(`$${paramName}`)
    }

    const script =
      `?[${colPlaceholders.join(',')}] <- [[${valPlaceholders.join(',')}]] ` +
      `:put ${relation} {${colPlaceholders.join(',')}}`

    await this.runMut(script, params)
  }

  /**
   * Batch-project multiple rows into a Cozo relation in a single query.
   * More efficient than calling `project` in a loop.
   */
  async projectBatch(relation: string, columns: string[], rows: unknown[][]): Promise<void> {
    if (rows.length === 0) return

    const params: Record<string, unknown> = {}
    const colPlaceholders: string[] = []
    const rowTuples: string[] = []

    for (let i = 0; i < columns.length; i++) {
      const col = columns[i]
      if (col !== undefined) colPlaceholders.push(col)
    }

    for (let r = 0; r < rows.length; r++) {
      const row = rows[r]
      if (row === undefined) continue
      const tupleParts: string[] = []
      for (let c = 0; c < row.length; c++) {
        const paramName = `r${r}_c${c}`
        params[paramName] = row[c]
        tupleParts.push(`$${paramName}`)
      }
      rowTuples.push(`[${tupleParts.join(',')}]`)
    }

    const script =
      `?[${colPlaceholders.join(',')}] <- [${rowTuples.join(',')}] ` +
      `:put ${relation} {${colPlaceholders.join(',')}}`

    await this.runMut(script, params)
  }

  /**
   * Export one or more relations (for backup / rebuild).
   */
  async exportRelations(relations: string[]): Promise<Record<string, CozoQueryResult> | null> {
    this.ensureOpen()
    const db = this.db
    if (!db) return null
    try {
      const result = await db.exportRelations(relations)
      return result as Record<string, CozoQueryResult>
    } catch (err) {
      console.error(`[cozo] exportRelations error (fail-open): ${(err as Error).message}`)
      return null
    }
  }

  /**
   * Import relations from exported data (for rebuild).
   */
  async importRelations(data: Record<string, unknown>): Promise<void> {
    this.ensureOpen()
    const db = this.db
    if (!db) return
    try {
      await db.importRelations(data)
    } catch (err) {
      console.error(`[cozo] importRelations error (fail-open): ${(err as Error).message}`)
    }
  }

  /**
   * Close the Cozo database. Must be called on shutdown.
   */
  close(): void {
    if (this.db) {
      try {
        this.db.close()
      } catch {
        // best-effort
      }
      this.db = null
      this.initialized = false
    }
  }

  /** Whether the database is open and initialized. */
  get isReady(): boolean {
    return this.db !== null && this.initialized
  }

  // ── Internal ───────────────────────────────────────────────────────────────

  private ensureOpen(): void {
    if (!this.db) {
      throw new CozoOpenError('CozoLayer not open. Call open() first.')
    }
  }
}

// ── Errors ─────────────────────────────────────────────────────────────────────

export class CozoOpenError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'CozoOpenError'
  }
}

// ── Singleton ──────────────────────────────────────────────────────────────────

let _cozo: CozoLayer | null = null

export function getCozo(): CozoLayer {
  if (!_cozo) {
    _cozo = new CozoLayer()
  }
  return _cozo
}

export function setCozo(cozo: CozoLayer): void {
  _cozo = cozo
}
