// src/server/chrome-router.ts
// Phase 9 of ROADMAP-REPROGRAMMABLE-CANVAS.md — Self-Modifying Chrome.
//
// HTTP routes for the canonical chrome seed + Reset to Factory.
//
// Routes:
//   GET  /api/chrome/factory   — returns the canonical chrome seed (all surfaces)
//   POST /api/chrome/reset     — applies the factory reset (replace mutation per surface)
//
// The seed is loaded from seeds/chrome/canonical-chrome.json. The Reset
// endpoint applies the seed via the MutationExecutor so the reset is logged
// + undoable.
//
// CONTRACT_VERSION: 1

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { mutationExecutor } from '../reprogrammability/dsl/executor.js'
import type { SurfaceSpec } from '../reprogrammability/schema/spec.js'
import { appErrorResponse, errorResponse, json } from './response.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

interface FactorySeed {
  version: number
  description: string
  surfaces: Array<{
    id: string
    kind: string
    label: string
    spec: SurfaceSpec
  }>
}

let cachedSeed: FactorySeed | null = null

function loadSeed(): FactorySeed {
  if (cachedSeed) return cachedSeed
  const seedPath = join(__dirname, '..', '..', 'seeds', 'chrome', 'canonical-chrome.json')
  const raw = readFileSync(seedPath, 'utf8')
  cachedSeed = JSON.parse(raw) as FactorySeed
  return cachedSeed
}

export function createChromeRouter() {
  return async function chromeRouter(req: Request, url: URL): Promise<Response | null> {
    const path = url.pathname

    // ── GET /api/chrome/factory ──────────────────────────────────────────────
    if (path === '/api/chrome/factory' && req.method === 'GET') {
      try {
        const seed = loadSeed()
        return json({
          ok: true,
          version: seed.version,
          description: seed.description,
          surfaces: seed.surfaces.map((s) => ({ id: s.id, spec: s.spec })),
        })
      } catch (err) {
        return appErrorResponse(err)
      }
    }

    // ── POST /api/chrome/reset ───────────────────────────────────────────────
    if (path === '/api/chrome/reset' && req.method === 'POST') {
      try {
        const seed = loadSeed()
        const mutations = seed.surfaces.map((s) => ({
          op: 'replace' as const,
          target: s.id,
          provenance: 'system' as const,
          payload: s.spec,
          reason: 'Reset to factory chrome',
          idempotencyKey: `factory-reset-${s.id}-${Date.now()}`,
        }))

        const plan = {
          id: `factory-reset-${Date.now()}`,
          mutations,
          provenance: 'system' as const,
          description: 'Reset to factory chrome',
        }

        const result = await mutationExecutor.applyPlan(plan)
        return json({ ok: result.ok, applied: result.records.length, result })
      } catch (err) {
        return appErrorResponse(err)
      }
    }

    return null
  }
}
