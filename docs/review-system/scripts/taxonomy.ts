/**
 * VIVIM Review System — Taxonomy Registry (SINGLE SOURCE OF TRUTH)
 *
 * Every review unit in the system lives here: its ID, its prompt file, the
 * report it must produce, its depth tier, and its ordering. Everything else
 * (run.ts, RUN-BRIEF generation, state tracking, depth filtering) reads THIS
 * table — never a hardcoded list. Adding a new focus area = one row here.
 *
 * Depth tiers:
 *   quick    — daily sanity: bootstrap + the highest-value architecture/security/summary
 *   standard — default milestone: bootstrap + all core B1–B9 + synthesis C2
 *   deep     — release/architecture decision: everything incl. C1 ecosystem scan
 */
import { join } from 'node:path'

export type DepthTier = 'quick' | 'standard' | 'deep'

export interface ReviewUnit {
  id: string
  area: 'discovery' | 'core' | 'synthesis'
  title: string
  /** prompt file, relative to docs/review-system/ */
  prompt: string
  /** report file, written into the run directory */
  report: string
  /** minimum depth tier that includes this unit */
  minDepth: DepthTier
  /** execution order (stable, so reports are generated in dependency order) */
  order: number
}

export const UNITS: ReviewUnit[] = [
  { id: 'A0', area: 'discovery', title: 'Intake, Manifest & Health Dashboard', prompt: 'prompts/discovery/A0-intake-manifest.md', report: '00-intake-summary.md', minDepth: 'quick', order: 1 },
  { id: 'A1', area: 'discovery', title: 'Bootstrap & Runtime', prompt: 'prompts/discovery/A1-bootstrap-runtime.md', report: '01-foundation.md', minDepth: 'quick', order: 2 },
  { id: 'B1', area: 'core', title: 'Architecture, Layering & Boundaries', prompt: 'prompts/core/B1-architecture-boundaries.md', report: '02-architecture.md', minDepth: 'quick', order: 3 },
  { id: 'B2', area: 'core', title: 'Data & Persistence', prompt: 'prompts/core/B2-data-persistence.md', report: '03-data-persistence.md', minDepth: 'standard', order: 4 },
  { id: 'B3', area: 'core', title: 'API & Integration Surfaces', prompt: 'prompts/core/B3-api-integration.md', report: '04-api-integration.md', minDepth: 'standard', order: 5 },
  { id: 'B4', area: 'core', title: 'Concurrency & Reliability', prompt: 'prompts/core/B4-concurrency-reliability.md', report: '05-concurrency-reliability.md', minDepth: 'standard', order: 6 },
  { id: 'B5', area: 'core', title: 'Security & Secret Hygiene', prompt: 'prompts/core/B5-security-secrets.md', report: '06-security.md', minDepth: 'quick', order: 7 },
  { id: 'B6', area: 'core', title: 'Frontend & UX', prompt: 'prompts/core/B6-frontend-ux.md', report: '07-frontend-ux.md', minDepth: 'standard', order: 8 },
  { id: 'B7', area: 'core', title: 'Testing & Quality Gates', prompt: 'prompts/core/B7-testing-quality.md', report: '08-testing-quality.md', minDepth: 'standard', order: 9 },
  { id: 'B8', area: 'core', title: 'Observability & Operability', prompt: 'prompts/core/B8-observability.md', report: '09-observability.md', minDepth: 'standard', order: 10 },
  { id: 'B9', area: 'core', title: 'Performance & Efficiency', prompt: 'prompts/core/B9-performance.md', report: '10-performance.md', minDepth: 'standard', order: 11 },
  { id: 'C1', area: 'synthesis', title: 'Opportunity & Ecosystem Scan', prompt: 'prompts/synthesis/C1-opportunity-ecosystem.md', report: '11-opportunity-scan.md', minDepth: 'deep', order: 12 },
  { id: 'C2', area: 'synthesis', title: 'Consolidated Ledger + Exec Summary', prompt: 'prompts/synthesis/C2-consolidated-summary.md', report: '12-consolidated.md', minDepth: 'quick', order: 13 },
]

const DEPTH_ORDER: DepthTier[] = ['quick', 'standard', 'deep']

/** Units included at (and below) the given depth tier, in execution order. */
export function unitsForDepth(depth: DepthTier): ReviewUnit[] {
  const minIdx = DEPTH_ORDER.indexOf(depth)
  return UNITS.filter((u) => DEPTH_ORDER.indexOf(u.minDepth) <= minIdx).sort((a, b) => a.order - b.order)
}

export function unitById(id: string): ReviewUnit | undefined {
  return UNITS.find((u) => u.id.toUpperCase() === id.toUpperCase())
}

/** Report file that a unit must produce (for state tracking). */
export function reportPath(runDir: string, unit: ReviewUnit): string {
  return join(runDir, unit.report)
}

export function validateDepth(depth: string): DepthTier {
  if ((DEPTH_ORDER as string[]).includes(depth)) return depth as DepthTier
  throw new Error(`unknown depth '${depth}' (expected quick | standard | deep)`)
}
