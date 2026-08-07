// src/engines/reprogrammability/version-store.ts
// Phase 8 of ROADMAP-REPROGRAMMABLE-CANVAS.md — Provenance & Versioning.
//
// `VersionStore` persists a `SurfaceVersion` row every time a mutation is
// applied to a surface. This is the "Time Machine" backing store.
//
// Storage: in-memory Map (Phase 8 plant). The Prisma models
// (SurfaceVersion, WorkspaceBackup, WorkspaceTemplateRow) are added to
// schema.prisma but the migration is NOT yet applied — see gap log
// gap_ms2k6c5p_xxxx. The in-memory store uses the same shape so the
// Phase 8 router + UI can be built today; the Prisma-backed implementation
// is a drop-in replacement.
//
// Provenance weights (drives trust scoring):
//   manual:      100   (user edited spec JSON directly)
//   nlcl:         90   (deterministic NL command)
//   prefix:       80   (slash/tag/mention command)
//   plugin:       60   (registered plugin)
//   llm-harness:  40   (LLM-produced plan, confirmed via HMAC)
//   system:       20   (internal: boot, migration, backup restore)
//
// CONTRACT_VERSION: 1

import { ulid } from 'ulid'
import { getLogger } from '../../lib/logger.js'
import type { MutationProvenance } from '../../reprogrammability/contract.js'
import type { SurfaceSpec } from '../../reprogrammability/schema/spec.js'

const log = getLogger('version-store')

export interface SurfaceVersion {
  id: string
  surfaceId: string
  version: number
  specJson: string
  spec: SurfaceSpec
  provenance: MutationProvenance
  mutationId?: string
  createdAt: number
}

export interface WorkspaceBackup {
  id: string
  snapshotJson: string
  source: 'cron' | 'manual' | 'pre-restore'
  createdAt: number
}

/**
 * Provenance weights — lower = less trusted. Used by the trust-score
 * integration (Phase 8 extends trust-score.ts to weight mutations by
 * provenance).
 */
export const PROVENANCE_WEIGHTS: Record<MutationProvenance, number> = {
  manual: 100,
  nlcl: 90,
  prefix: 80,
  plugin: 60,
  'llm-harness': 40,
  system: 20,
}

/**
 * Trust weight for a provenance tag. Used by the History panel to show
 * "low-trust" mutations with a different color.
 */
export function provenanceWeight(p: MutationProvenance): number {
  return PROVENANCE_WEIGHTS[p] ?? 50
}

/**
 * In-memory VersionStore. Singleton exported at the bottom.
 */
export class VersionStore {
  /** surfaceId → versions (oldest first) */
  private readonly versions = new Map<string, SurfaceVersion[]>()
  /** backupId → backup */
  private readonly backups = new Map<string, WorkspaceBackup>()
  /** Cap versions per surface to prevent unbounded growth. */
  private readonly maxVersionsPerSurface = 100

  /**
   * Save a new version for a surface. Called by the MutationExecutor after
   * every successful apply.
   */
  saveVersion(input: {
    surfaceId: string
    spec: SurfaceSpec
    provenance: MutationProvenance
    mutationId?: string
  }): SurfaceVersion {
    const existing = this.versions.get(input.surfaceId) ?? []
    // Version number is monotonically increasing — read from the last entry,
    // not from `existing.length`, so capping at maxVersionsPerSurface doesn't
    // restart the counter.
    const version = existing.length > 0 ? existing[existing.length - 1]!.version + 1 : 1
    const specJson = JSON.stringify(input.spec)
    const v: SurfaceVersion = {
      id: ulid(),
      surfaceId: input.surfaceId,
      version,
      specJson,
      spec: input.spec,
      provenance: input.provenance,
      mutationId: input.mutationId,
      createdAt: Date.now(),
    }
    existing.push(v)

    // Cap at maxVersionsPerSurface — drop the oldest (keep the most recent).
    if (existing.length > this.maxVersionsPerSurface) {
      existing.shift()
    }

    this.versions.set(input.surfaceId, existing)
    log.debug(
      { surfaceId: input.surfaceId, version, provenance: input.provenance },
      '[version-store] version saved',
    )
    return v
  }

  /**
   * List versions for a surface (oldest first). Optionally limit.
   */
  listVersions(surfaceId: string, limit?: number): SurfaceVersion[] {
    const all = this.versions.get(surfaceId) ?? []
    if (limit && limit > 0) {
      return all.slice(-limit)
    }
    return [...all]
  }

  /**
   * Get a specific version by id (across all surfaces).
   */
  getVersion(versionId: string): SurfaceVersion | null {
    for (const versions of this.versions.values()) {
      const v = versions.find((x) => x.id === versionId)
      if (v) return v
    }
    return null
  }

  /**
   * Get a specific version by surfaceId + version number.
   */
  getVersionByNumber(surfaceId: string, version: number): SurfaceVersion | null {
    const list = this.versions.get(surfaceId) ?? []
    return list.find((v) => v.version === version) ?? null
  }

  /**
   * Restore a surface to a prior version. Returns the spec to apply as a
   * `replace` mutation. Does NOT apply the mutation — the caller is
   * responsible for routing through the MutationExecutor so the restore
   * itself gets logged as a new version.
   */
  getRestoreSpec(versionId: string): SurfaceSpec | null {
    const v = this.getVersion(versionId)
    if (!v) return null
    return v.spec
  }

  /**
   * Diff two versions of the same surface. Returns a structured diff.
   */
  diffVersions(
    versionIdA: string,
    versionIdB: string,
  ): {
    surfaceId: string
    versionA: number
    versionB: number
    specA: SurfaceSpec
    specB: SurfaceSpec
    jsonDiff: string
  } | null {
    const a = this.getVersion(versionIdA)
    const b = this.getVersion(versionIdB)
    if (!a || !b) return null
    if (a.surfaceId !== b.surfaceId) return null
    return {
      surfaceId: a.surfaceId,
      versionA: a.version,
      versionB: b.version,
      specA: a.spec,
      specB: b.spec,
      jsonDiff: diffJson(a.specJson, b.specJson),
    }
  }

  /**
   * Create a workspace backup snapshot. Returns the backup id.
   */
  createBackup(snapshot: unknown, source: WorkspaceBackup['source'] = 'manual'): WorkspaceBackup {
    const snapshotJson = JSON.stringify(snapshot)
    const backup: WorkspaceBackup = {
      id: ulid(),
      snapshotJson,
      source,
      createdAt: Date.now(),
    }
    this.backups.set(backup.id, backup)
    log.info(
      { backupId: backup.id, source, bytes: snapshotJson.length },
      '[version-store] backup created',
    )
    return backup
  }

  /**
   * List backups (most recent first).
   */
  listBackups(limit?: number): WorkspaceBackup[] {
    const all = Array.from(this.backups.values()).sort((a, b) => b.createdAt - a.createdAt)
    if (limit && limit > 0) return all.slice(0, limit)
    return all
  }

  /**
   * Get a backup by id.
   */
  getBackup(backupId: string): WorkspaceBackup | null {
    return this.backups.get(backupId) ?? null
  }

  /**
   * Restore from a backup. Returns the parsed snapshot.
   */
  restoreBackup(backupId: string): unknown | null {
    const backup = this.backups.get(backupId)
    if (!backup) return null
    try {
      return JSON.parse(backup.snapshotJson)
    } catch (err) {
      log.error({ err, backupId }, '[version-store] failed to parse backup snapshot')
      return null
    }
  }

  /**
   * Test helper: clear all versions + backups.
   */
  clear(): void {
    this.versions.clear()
    this.backups.clear()
  }
}

/**
 * Simple line-by-line JSON diff. Not a structural diff, but sufficient for
 * the Time Machine panel's "show me what changed" use case.
 */
function diffJson(a: string, b: string): string {
  const linesA = a.split('\n')
  const linesB = b.split('\n')
  const out: string[] = []
  const max = Math.max(linesA.length, linesB.length)
  for (let i = 0; i < max; i++) {
    const la = linesA[i] ?? ''
    const lb = linesB[i] ?? ''
    if (la === lb) continue
    if (la && !lb) out.push(`- ${la}`)
    else if (!la && lb) out.push(`+ ${lb}`)
    else {
      out.push(`- ${la}`)
      out.push(`+ ${lb}`)
    }
  }
  return out.join('\n')
}

// ── Singleton ────────────────────────────────────────────────────────────────

export const versionStore = new VersionStore()

// ── MutationExecutor hook ────────────────────────────────────────────────────

/**
 * Hook the VersionStore into the MutationExecutor. After every successful
 * `apply()`, save a version. Called once at server bootstrap.
 *
 * This is intentionally a separate function (not a method on MutationExecutor)
 * to keep the executor free of storage concerns. Phase 10 may promote this
 * to a constructor injection if the coupling proves stable.
 */
import { mutationExecutor } from '../../reprogrammability/dsl/executor.js'

let hooked = false
export function hookVersionStoreToExecutor(): void {
  if (hooked) return
  // The MutationExecutor doesn't expose an `onApply` event. We patch its
  // `apply` method to save a version after each successful call. This is
  // a minimal-impact change — the executor's contract is unchanged.
  const original = mutationExecutor.apply.bind(mutationExecutor)
  mutationExecutor.apply = async (mutation) => {
    const record = await original(mutation)
    if (record.ok) {
      try {
        versionStore.saveVersion({
          surfaceId: mutation.target.split('/')[0]!,
          spec: record.afterSpec,
          provenance: mutation.provenance,
          mutationId: record.id,
        })
      } catch (err) {
        // Best-effort — version save failures must not break the apply.
        log.error({ err }, '[version-store] failed to save version')
      }
    }
    return record
  }
  hooked = true
  log.info('[version-store] hooked into MutationExecutor.apply')
}
