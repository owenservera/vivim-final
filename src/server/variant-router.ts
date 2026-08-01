import { ulid } from 'ulid'
import { getLogger } from '../lib/logger.js'
import { mutationExecutor } from '../reprogrammability/dsl/executor.js'
import { surfaceRegistry } from '../reprogrammability/registry.js'
import {
  SurfaceVariantSchema,
  UpsertSurfaceVariantInputSchema,
} from '../reprogrammability/variant-schema.js'
import type { SurfaceVariant } from '../reprogrammability/variant-schema.js'
import { errorResponse, json } from './response.js'

const log = getLogger('variant-router')

/**
 * Lookup a variant across all surfaces by id. Returns the surfaceId + variant.
 */
function findVariantById(
  variantId: string,
): { surfaceId: string; variant: SurfaceVariant; index: number } | null {
  // Walk every surface's variants list. The registry exposes listVariants
  // by surfaceId, so we iterate over all surfaces and search.
  for (const surface of surfaceRegistry.list()) {
    const variants = surfaceRegistry.listVariants(surface.id)
    const idx = variants.findIndex((v) => v.id === variantId)
    if (idx >= 0) {
      return { surfaceId: surface.id, variant: variants[idx]!, index: idx }
    }
  }
  return null
}

/**
 * Build a Router. Stateful (the registry is a singleton), but the function
 * is exported as a factory to match the pattern of mutation-router.
 */
export function createVariantRouter() {
  return async function variantRouter(req: Request, url: URL): Promise<Response | null> {
    const path = url.pathname

    // ── GET /api/variant?surfaceId=… ─────────────────────────────────────
    if (path === '/api/variant' && req.method === 'GET') {
      const surfaceId = url.searchParams.get('surfaceId')
      if (!surfaceId) {
        return errorResponse('Missing required query param: surfaceId', 'VALIDATION_ERROR', 400)
      }
      const variants = surfaceRegistry.listVariants(surfaceId)
      return json({ ok: true, surfaceId, variants, count: variants.length })
    }

    // ── GET /api/variant/_active?surfaceId=… ─────────────────────────────
    if (path === '/api/variant/_active' && req.method === 'GET') {
      const surfaceId = url.searchParams.get('surfaceId')
      if (!surfaceId) {
        return errorResponse('Missing required query param: surfaceId', 'VALIDATION_ERROR', 400)
      }
      const active = surfaceRegistry.getActiveVariant(surfaceId)
      return json({ ok: true, surfaceId, active: active ?? null })
    }

    // ── POST /api/variant ────────────────────────────────────────────────
    if (path === '/api/variant' && req.method === 'POST') {
      let body: unknown
      try {
        body = await req.json()
      } catch {
        return errorResponse('Invalid JSON body', 'VALIDATION_ERROR', 400)
      }

      const parsed = UpsertSurfaceVariantInputSchema.safeParse(body)
      if (!parsed.success) {
        return errorResponse(
          `Invalid input: ${parsed.error.issues.map((i) => i.message).join('; ')}`,
          'VALIDATION_ERROR',
          400,
        )
      }

      const now = Date.now()
      const variant: SurfaceVariant = {
        id: ulid(),
        surfaceId: parsed.data.surfaceId,
        name: parsed.data.name,
        description: parsed.data.description,
        spec: parsed.data.spec,
        isActive: false,
        isLocked: false,
        provenance: 'manual',
        createdAt: now,
        updatedAt: now,
        tags: parsed.data.tags ?? [],
      }

      // Validate the constructed variant against the full schema.
      const variantParsed = SurfaceVariantSchema.safeParse(variant)
      if (!variantParsed.success) {
        return errorResponse(
          `Constructed variant failed schema validation: ${variantParsed.error.issues.map((i) => i.message).join('; ')}`,
          'VALIDATION_ERROR',
          500,
        )
      }

      surfaceRegistry.saveVariant(parsed.data.surfaceId, variantParsed.data)
      log.info(
        { surfaceId: variant.surfaceId, variantId: variant.id },
        '[variant-router] variant created',
      )
      return json({ ok: true, variant: variantParsed.data }, 201)
    }

    // ── PUT /api/variant/:id ─────────────────────────────────────────────
    const putMatch = path.match(/^\/api\/variant\/([^/]+)$/)
    if (putMatch && req.method === 'PUT') {
      const variantId = putMatch[1]!
      const existing = findVariantById(variantId)
      if (!existing) {
        return errorResponse(`Variant not found: ${variantId}`, 'NOT_FOUND', 404)
      }
      if (existing.variant.isLocked) {
        return errorResponse(`Cannot edit locked variant: ${variantId}`, 'LOCKED', 423)
      }

      let body: unknown
      try {
        body = await req.json()
      } catch {
        return errorResponse('Invalid JSON body', 'VALIDATION_ERROR', 400)
      }

      const parsed = UpsertSurfaceVariantInputSchema.safeParse(body)
      if (!parsed.success) {
        return errorResponse(
          `Invalid input: ${parsed.error.issues.map((i) => i.message).join('; ')}`,
          'VALIDATION_ERROR',
          400,
        )
      }

      const updated: SurfaceVariant = {
        ...existing.variant,
        name: parsed.data.name,
        description: parsed.data.description,
        spec: parsed.data.spec,
        tags: parsed.data.tags ?? existing.variant.tags,
        updatedAt: Date.now(),
      }
      const updatedParsed = SurfaceVariantSchema.safeParse(updated)
      if (!updatedParsed.success) {
        return errorResponse(
          `Updated variant failed schema validation: ${updatedParsed.error.issues.map((i) => i.message).join('; ')}`,
          'VALIDATION_ERROR',
          500,
        )
      }

      surfaceRegistry.saveVariant(existing.surfaceId, updatedParsed.data)
      log.info({ surfaceId: existing.surfaceId, variantId }, '[variant-router] variant updated')
      return json({ ok: true, variant: updatedParsed.data })
    }

    // ── DELETE /api/variant/:id ──────────────────────────────────────────
    const delMatch = path.match(/^\/api\/variant\/([^/]+)$/)
    if (delMatch && req.method === 'DELETE') {
      const variantId = delMatch[1]!
      const existing = findVariantById(variantId)
      if (!existing) {
        return errorResponse(`Variant not found: ${variantId}`, 'NOT_FOUND', 404)
      }
      if (existing.variant.isLocked) {
        return errorResponse(`Cannot delete locked variant: ${variantId}`, 'LOCKED', 423)
      }
      try {
        surfaceRegistry.deleteVariant(existing.surfaceId, variantId)
      } catch (err) {
        return errorResponse(err instanceof Error ? err.message : String(err), 'LOCKED', 423)
      }
      log.info({ surfaceId: existing.surfaceId, variantId }, '[variant-router] variant deleted')
      return json({ ok: true, deleted: variantId })
    }

    // ── POST /api/variant/:id/activate ──────────────────────────────────
    const actMatch = path.match(/^\/api\/variant\/([^/]+)\/activate$/)
    if (actMatch && req.method === 'POST') {
      const variantId = actMatch[1]!
      const existing = findVariantById(variantId)
      if (!existing) {
        return errorResponse(`Variant not found: ${variantId}`, 'NOT_FOUND', 404)
      }

      // Mark active in registry first.
      surfaceRegistry.setActiveVariant(existing.surfaceId, variantId)

      // Apply the variant's spec as a `replace` mutation through the executor.
      // This rides the provenance + undo/redo pipeline so the activation is
      // logged, undoable, and shows up in the History panel.
      try {
        const record = await mutationExecutor.apply({
          op: 'replace',
          target: existing.surfaceId,
          provenance: 'manual',
          payload: existing.variant.spec,
          reason: `Activate variant: ${existing.variant.name}`,
          idempotencyKey: `variant-activate-${variantId}-${Date.now()}`,
        })
        log.info(
          { surfaceId: existing.surfaceId, variantId, ok: record.ok },
          '[variant-router] variant activated',
        )
        return json({ ok: record.ok, variant: existing.variant, applyRecord: record })
      } catch (err) {
        log.error(
          { err, surfaceId: existing.surfaceId, variantId },
          '[variant-router] activation apply failed',
        )
        return errorResponse(err instanceof Error ? err.message : String(err), 'APPLY_FAILED', 500)
      }
    }

    // ── GET /api/variant/:id ─────────────────────────────────────────────
    const getMatch = path.match(/^\/api\/variant\/([^/]+)$/)
    if (getMatch && req.method === 'GET') {
      const variantId = getMatch[1]!
      const existing = findVariantById(variantId)
      if (!existing) {
        return errorResponse(`Variant not found: ${variantId}`, 'NOT_FOUND', 404)
      }
      return json({ ok: true, variant: existing.variant })
    }

    return null
  }
}
