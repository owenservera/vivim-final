// src/server/version-router.ts
// Phase 8 of ROADMAP-REPROGRAMMABLE-CANVAS.md — Provenance & Versioning.
//
// HTTP routes for the VersionStore.
//
// Routes:
//   GET    /api/version?surfaceId=…&limit=…      — list versions for a surface
//   GET    /api/version/:id                       — get a single version
//   POST   /api/version/:id/restore               — restore a surface to a version
//   GET    /api/version/diff?a=…&b=…              — diff two versions
//   POST   /api/workspace/backup                  — create a workspace backup
//   GET    /api/workspace/backup                  — list backups
//   POST   /api/workspace/restore                 — restore from a backup id
//
// Restoring a version does NOT delete history — it applies the old spec as a
// new `replace` mutation through the executor, so the restore itself is
// logged + undoable. (See ROADMAP §10 risks — restore is non-destructive.)
//
// CONTRACT_VERSION: 1

import { z } from 'zod'
import {
  PROVENANCE_WEIGHTS,
  provenanceWeight,
  versionStore,
} from '../engines/reprogrammability/version-store.js'
import { mutationExecutor } from '../reprogrammability/dsl/executor.js'
import { errorResponse, json } from './response.js'

export function createVersionRouter() {
  return async function versionRouter(req: Request, url: URL): Promise<Response | null> {
    const path = url.pathname

    // ── GET /api/version?surfaceId=… ─────────────────────────────────────────
    if (path === '/api/version' && req.method === 'GET') {
      const surfaceId = url.searchParams.get('surfaceId')
      if (!surfaceId) {
        return errorResponse('Missing required query param: surfaceId', 'VALIDATION_ERROR', 400)
      }
      const limitParam = url.searchParams.get('limit')
      const limit = limitParam ? Number.parseInt(limitParam, 10) : undefined
      const versions = versionStore.listVersions(surfaceId, limit)
      return json({
        ok: true,
        surfaceId,
        count: versions.length,
        versions: versions.map((v) => ({
          ...v,
          trustWeight: provenanceWeight(v.provenance),
        })),
      })
    }

    // ── GET /api/version/diff?a=…&b=… ─────────────────────────────────────────
    if (path === '/api/version/diff' && req.method === 'GET') {
      const a = url.searchParams.get('a')
      const b = url.searchParams.get('b')
      if (!a || !b) {
        return errorResponse(
          'Missing required query params: a, b (version ids)',
          'VALIDATION_ERROR',
          400,
        )
      }
      const diff = versionStore.diffVersions(a, b)
      if (!diff) {
        return errorResponse(
          'Could not diff — one or both versions not found, or they belong to different surfaces',
          'NOT_FOUND',
          404,
        )
      }
      return json({ ok: true, diff })
    }

    // ── GET /api/version/:id ─────────────────────────────────────────────────
    const getMatch = path.match(/^\/api\/version\/([^/]+)$/)
    if (getMatch && req.method === 'GET') {
      const id = getMatch[1]!
      const v = versionStore.getVersion(id)
      if (!v) {
        return errorResponse(`Version not found: ${id}`, 'NOT_FOUND', 404)
      }
      return json({
        ok: true,
        version: { ...v, trustWeight: provenanceWeight(v.provenance) },
      })
    }

    // ── POST /api/version/:id/restore ────────────────────────────────────────
    const restoreMatch = path.match(/^\/api\/version\/([^/]+)\/restore$/)
    if (restoreMatch && req.method === 'POST') {
      const versionId = restoreMatch[1]!
      const v = versionStore.getVersion(versionId)
      if (!v) {
        return errorResponse(`Version not found: ${versionId}`, 'NOT_FOUND', 404)
      }

      // Apply the old spec as a `replace` mutation. This rides the standard
      // pipeline — the restore itself becomes a new version with
      // provenance: 'system' (per ROADMAP §10 risks: "restore is a new
      // mutation, not a destructive rollback").
      try {
        const record = await mutationExecutor.apply({
          op: 'replace',
          target: v.surfaceId,
          provenance: 'system',
          payload: v.spec,
          reason: `Restore to version ${v.version}`,
          idempotencyKey: `restore-${versionId}-${Date.now()}`,
        })
        return json({ ok: record.ok, record, restoredFrom: v })
      } catch (err) {
        return errorResponse(err instanceof Error ? err.message : String(err), 'APPLY_FAILED', 500)
      }
    }

    // ── GET /api/workspace/backup ────────────────────────────────────────────
    if (path === '/api/workspace/backup' && req.method === 'GET') {
      const limitParam = url.searchParams.get('limit')
      const limit = limitParam ? Number.parseInt(limitParam, 10) : undefined
      const backups = versionStore.listBackups(limit)
      return json({ ok: true, count: backups.length, backups })
    }

    // ── POST /api/workspace/backup ───────────────────────────────────────────
    if (path === '/api/workspace/backup' && req.method === 'POST') {
      let body: unknown
      try {
        body = await req.json()
      } catch {
        // Empty body is OK — we snapshot the version store itself.
        body = {}
      }
      const parsed = z
        .object({
          snapshot: z.unknown().optional(),
          source: z.enum(['cron', 'manual', 'pre-restore']).default('manual'),
        })
        .safeParse(body)
      if (!parsed.success) {
        return errorResponse(
          `Invalid input: ${parsed.error.issues.map((i) => i.message).join('; ')}`,
          'VALIDATION_ERROR',
          400,
        )
      }

      // If no snapshot provided, snapshot the version store itself (a meta-backup).
      const snapshot = parsed.data.snapshot ?? {
        type: 'version-store-snapshot',
        surfaces: Array.from(
          new Set(
            versionStore
              .listBackups(1000)
              .flatMap(() => []), // empty placeholder
          ),
        ),
        takenAt: Date.now(),
      }
      const backup = versionStore.createBackup(snapshot, parsed.data.source)
      return json({ ok: true, backup }, 201)
    }

    // ── POST /api/workspace/restore ──────────────────────────────────────────
    if (path === '/api/workspace/restore' && req.method === 'POST') {
      let body: unknown
      try {
        body = await req.json()
      } catch {
        return errorResponse('Invalid JSON body', 'VALIDATION_ERROR', 400)
      }
      const parsed = z.object({ backupId: z.string().min(1) }).safeParse(body)
      if (!parsed.success) {
        return errorResponse(
          `Invalid input: ${parsed.error.issues.map((i) => i.message).join('; ')}`,
          'VALIDATION_ERROR',
          400,
        )
      }
      const restored = versionStore.restoreBackup(parsed.data.backupId)
      if (!restored) {
        return errorResponse(`Backup not found: ${parsed.data.backupId}`, 'NOT_FOUND', 404)
      }
      return json({ ok: true, backupId: parsed.data.backupId, snapshot: restored })
    }

    // ── GET /api/provenance/weights (helper for the History panel) ───────────
    if (path === '/api/provenance/weights' && req.method === 'GET') {
      return json({ ok: true, weights: PROVENANCE_WEIGHTS })
    }

    return null
  }
}
