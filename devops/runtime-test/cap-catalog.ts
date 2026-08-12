// devops/runtime-test/cap-catalog.ts
// Unit 1.1 — Static capability catalog (offline discovery).
//
// AGENT-SAFE: bounded file read + regex; never touches the network. Lets the agent
// PLAN a new capability without a running server (closes the chicken-egg where
// `discover` needs /api/capabilities which needs the server to boot, which needs
// code to compile). Mirrors the `discover-cdp` catalog-fallback pattern.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const SOURCE = 'src/engines/capability-bootstrap.ts'
const OUT = '.runtime/capability-catalog.json'

export interface CatalogCap {
  id: string
  slug: string
  name: string
}

/**
 * Statically extract every `makeCapability` registration from the bootstrap source.
 * Each call lists `id`, then `slug`, then `name` in that order, so sequential zipping
 * pairs them correctly without a full parser.
 */
export function generateCatalog(): { ok: boolean; capabilities: CatalogCap[]; error?: string } {
  try {
    if (!existsSync(SOURCE)) {
      return { ok: false, capabilities: [], error: `source not found: ${SOURCE}` }
    }
    const src = readFileSync(SOURCE, 'utf8')
    const ids = [...src.matchAll(/id:\s*'([^']+)'/g)].map((m) => m[1])
    const slugs = [...src.matchAll(/slug:\s*'([^']+)'/g)].map((m) => m[1])
    const names = [...src.matchAll(/name:\s*'([^']+)'/g)].map((m) => m[1])
    const n = Math.min(ids.length, slugs.length, names.length)
    const caps: CatalogCap[] = []
    for (let i = 0; i < n; i++) {
      caps.push({ id: ids[i], slug: slugs[i], name: names[i] })
    }
    try {
      mkdirSync('.runtime', { recursive: true })
      writeFileSync(OUT, JSON.stringify({ generatedAt: Date.now(), capabilities: caps }, null, 2), 'utf8')
    } catch {
  // [audit] log the error with context here
      // best-effort persistence
    }
    return { ok: true, capabilities: caps }
  } catch (err) {
    return { ok: false, capabilities: [], error: String(err) }
  }
}

export function readCatalog(): { ok: boolean; capabilities: CatalogCap[]; source: 'file' | 'none' } {
  try {
    if (!existsSync(OUT)) return { ok: false, capabilities: [], source: 'none' }
    const data = JSON.parse(readFileSync(OUT, 'utf8')) as { capabilities: CatalogCap[] }
    return { ok: true, capabilities: data.capabilities ?? [], source: 'file' }
  } catch {
    return { ok: false, capabilities: [], source: 'none' }
  }
}

/** Best-effort resolve a goal string to a known capability (offline). */
export function matchGoalToCapability(goal: string): CatalogCap | null {
  const g = goal.toLowerCase()
  const catalog = readCatalog()
  const capabilities = catalog.ok ? catalog.capabilities : []
  // Prefer slug/id substring, then name token overlap.
  for (const c of capabilities) {
    if (g.includes(c.slug.replace(/_/g, ' ')) || g.includes(c.id.replace(/:/g, ' '))) return c
  }
  const tokens = g.split(/\W+/).filter((t) => t.length > 3)
  for (const c of capabilities) {
    const nameTokens = c.name.toLowerCase().split(/\W+/)
    if (tokens.some((t) => nameTokens.includes(t))) return c
  }
  return null
}
