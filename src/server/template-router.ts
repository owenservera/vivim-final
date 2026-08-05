// src/server/template-router.ts
// Phase 6 of ROADMAP-REPROGRAMMABLE-CANVAS.md — Visual Builder (node-graph).
//
// HTTP routes for WorkspaceTemplate CRUD. The Visual Builder saves a graph
// as a template via POST /api/template/from-graph; TemplatesGallery can list
// + instantiate templates.
//
// Templates are stored in-memory (Phase 6); Phase 8 adds Prisma persistence.
//
// Routes:
//   POST   /api/template/from-graph  — save a graph as a template
//   GET    /api/template             — list all templates
//   GET    /api/template/:id         — get a single template
//   POST   /api/template/:id/instantiate — emit a mutation plan from a template
//   DELETE /api/template/:id         — delete a template
//
// CONTRACT_VERSION: 1

import { ulid } from 'ulid'
import { z } from 'zod'
import { mutationExecutor } from '../reprogrammability/dsl/executor.js'
import type { SurfaceMutation, SurfaceMutationPlan } from '../reprogrammability/mutation-schema.js'
import { errorResponse, json } from './response.js'

// ── In-memory store (Phase 6; Phase 8 promotes to Prisma) ────────────────────

export interface WorkspaceTemplate {
  id: string
  name: string
  description?: string
  graphJson: unknown
  createdAt: number
  createdBy?: string
  tags?: string[]
}

const templates = new Map<string, WorkspaceTemplate>()

/**
 * Test helper: clear the in-memory template store. Not exported via the
 * router factory; imported directly by tests.
 */
export function __clearTemplatesForTest(): void {
  templates.clear()
}

// ── Zod schemas ──────────────────────────────────────────────────────────────

const FromGraphInputSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(280).optional(),
  graphJson: z.unknown(),
  tags: z.array(z.string()).optional(),
  createdBy: z.string().optional(),
})

// ── Router ───────────────────────────────────────────────────────────────────

export function createTemplateRouter() {
  return async function templateRouter(req: Request, url: URL): Promise<Response | null> {
    const path = url.pathname

    // ── POST /api/template/from-graph ────────────────────────────────────────
    if (path === '/api/template/from-graph' && req.method === 'POST') {
      let body: unknown
      try {
        body = await req.json()
      } catch {
        return errorResponse('Invalid JSON body', 'ValidationError', 400)
      }

      const parsed = FromGraphInputSchema.safeParse(body)
      if (!parsed.success) {
        return errorResponse(
          `Invalid input: ${parsed.error.issues.map((i) => i.message).join('; ')}`,
          'ValidationError',
          400,
        )
      }

      const tpl: WorkspaceTemplate = {
        id: ulid(),
        name: parsed.data.name,
        description: parsed.data.description,
        graphJson: parsed.data.graphJson,
        createdAt: Date.now(),
        createdBy: parsed.data.createdBy,
        tags: parsed.data.tags ?? [],
      }
      templates.set(tpl.id, tpl)
      return json({ ok: true, template: tpl }, 201)
    }

    // ── GET /api/template ────────────────────────────────────────────────────
    if (path === '/api/template' && req.method === 'GET') {
      const all = Array.from(templates.values()).sort((a, b) => b.createdAt - a.createdAt)
      return json({ ok: true, count: all.length, templates: all })
    }

    // ── GET /api/template/:id ────────────────────────────────────────────────
    const getMatch = path.match(/^\/api\/template\/([^/]+)$/)
    if (getMatch && req.method === 'GET') {
      const id = getMatch[1]!
      const tpl = templates.get(id)
      if (!tpl) return errorResponse(`Template not found: ${id}`, 'NotFound', 404)
      return json({ ok: true, template: tpl })
    }

    // ── POST /api/template/:id/instantiate ───────────────────────────────────
    // Converts the template's graph into a SurfaceMutationPlan (one rebind per
    // edge with a `target`), then applies it via the MutationExecutor.
    const instMatch = path.match(/^\/api\/template\/([^/]+)\/instantiate$/)
    if (instMatch && req.method === 'POST') {
      const id = instMatch[1]!
      const tpl = templates.get(id)
      if (!tpl) return errorResponse(`Template not found: ${id}`, 'NotFound', 404)

      const graph = tpl.graphJson as {
        nodes?: Array<Record<string, unknown>>
        edges?: Array<{
          id: string
          from: { nodeId: string; portId: string }
          to: { nodeId: string; portId: string }
          op?: string
          target?: string
        }>
      }

      if (!graph || !Array.isArray(graph.edges)) {
        return errorResponse(
          'Template graph has no edges; nothing to instantiate',
          'ValidationError',
          422,
        )
      }

      // Build a mutation plan from the graph's edges.
      const mutations: SurfaceMutation[] = []
      const nodes = Array.isArray(graph.nodes) ? graph.nodes : []
      for (const edge of graph.edges) {
        if (!edge.target || !edge.op) continue
        // Find the capability id on the other end.
        const fromNode = nodes.find((n) => n.id === edge.from.nodeId)
        const toNode = nodes.find((n) => n.id === edge.to.nodeId)
        const capNode =
          fromNode?.type === 'capability' ? fromNode : toNode?.type === 'capability' ? toNode : null
        const capId = (capNode?.capabilityId as string | undefined) ?? 'unknown'

        mutations.push({
          op: 'rebind', // Phase 6 only emits rebind edges from graph templates.
          target: edge.target,
          provenance: 'manual',
          payload: { capabilityId: capId, action: 'bind' as const },
          reason: `Instantiate template ${tpl.name}: ${edge.op} ${capId} → ${edge.target}`,
          idempotencyKey: `tpl-${tpl.id}-${edge.id}-${Date.now()}`,
        })
      }

      if (mutations.length === 0) {
        return json({
          ok: true,
          applied: 0,
          message: 'No rebind edges with a target — nothing to apply.',
        })
      }

      const plan: SurfaceMutationPlan = {
        id: `tpl-${tpl.id}-${Date.now()}`,
        mutations,
        provenance: 'manual',
        description: `Instantiate template: ${tpl.name}`,
      }

      const result = await mutationExecutor.applyPlan(plan)
      return json({ ok: result.ok, applied: result.records.length, result })
    }

    // ── DELETE /api/template/:id ─────────────────────────────────────────────
    const delMatch = path.match(/^\/api\/template\/([^/]+)$/)
    if (delMatch && req.method === 'DELETE') {
      const id = delMatch[1]!
      if (!templates.has(id)) {
        return errorResponse(`Template not found: ${id}`, 'NotFound', 404)
      }
      templates.delete(id)
      return json({ ok: true, deleted: id })
    }

    return null
  }
}
