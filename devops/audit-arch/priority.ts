// devops/audit-arch/priority.ts
// Architecture-audit priority scheme + depth tiers.
//
// Priority drives remediation order. Scope drives how much of the module graph
// is analysed (and therefore cost). Like audit-code, deeper scopes run every
// shallower scope's passes plus more.
//
// The dimensions here describe STRUCTURAL properties of the codebase graph
// (layering, cycles, coupling, cohesion, boundaries) — distinct from the
// line-level dimensions of `audit-code` (security, dead code, `any`, …).
//
// The `commands` dimension audits the single command layer: every operation is
// a UnifiedCapability whose cliComponent / ui / mcpToolName / apiEndpoint /
// surfaces bindings and NL-catalog `capabilityId` binding should be consistent.
// It surfaces potential new commands and central commands needed.

export type Priority = 'P0' | 'P1' | 'P2' | 'P3'
export type Scope = 'surface' | 'standard' | 'deep' | 'full'
export type Dimension =
  | 'layering'
  | 'cycles'
  | 'coupling'
  | 'cohesion'
  | 'boundaries'
  | 'commands'
export type Risk = 'H' | 'M' | 'L'

// Ordering helper: higher number = more urgent.
const PRIORITY_RANK: Record<Priority, number> = { P0: 0, P1: 1, P2: 2, P3: 3 }
const SCOPE_RANK: Record<Scope, number> = { surface: 0, standard: 1, deep: 2, full: 3 }

export function priorityRank(p: Priority): number {
  return PRIORITY_RANK[p]
}

export function scopeRank(s: Scope): number {
  return SCOPE_RANK[s]
}

export function scopeIncludes(requested: Scope, minimum: Scope): boolean {
  return scopeRank(requested) >= scopeRank(minimum)
}

export function comparePriority(a: Priority, b: Priority): number {
  return priorityRank(a) - priorityRank(b)
}

export interface PriorityRule {
  priority: Priority
  dimension: Dimension
  description: string
}

// Architecture-audit priority rules. Hard boundary breaks (B1/B2) are surfaced
// by the `boundaries` pass and are P0; everything else is structural hygiene.
export const PRIORITY_RULES: PriorityRule[] = [
  // P0 — Critical (reused hard invariants)
  { priority: 'P0', dimension: 'boundaries', description: 'Governor Canon (B1) — engine touches CDP directly' },
  { priority: 'P0', dimension: 'boundaries', description: 'Store-Contract (B2) — engine imports storage/impl' },
  // P1 — High
  { priority: 'P1', dimension: 'cycles', description: 'Cyclic dependency between modules' },
  { priority: 'P1', dimension: 'layering', description: 'Upward dependency — a lower layer imports a higher layer' },
  { priority: 'P1', dimension: 'boundaries', description: 'Other B-category boundary violation' },
  { priority: 'P1', dimension: 'commands', description: 'Dangling command — NL catalog pattern binds to a non-existent capability' },
  { priority: 'P1', dimension: 'commands', description: 'Duplicate capability id (two makeCapability calls share an id)' },
  // P2 — Medium
  { priority: 'P2', dimension: 'layering', description: 'Skip-layer dependency (layer N imports layer N-2+) without going through the layer in between' },
  { priority: 'P2', dimension: 'coupling', description: 'God/hub module — very high fan-in + fan-out (instability hotspot)' },
  { priority: 'P2', dimension: 'cohesion', description: 'Low-cohesion module — mostly imports outside its own module' },
  { priority: 'P2', dimension: 'commands', description: 'Potential new command — capability has no NL catalog pattern (not reachable by natural language)' },
  { priority: 'P2', dimension: 'commands', description: 'Surface declared but binding missing — capability lists a surface with no corresponding cliCommand/ui/mcpToolName/apiEndpoint' },
  { priority: 'P2', dimension: 'commands', description: 'Central command candidate — same cliCommand name defined by multiple capabilities (should be one command)' },
  // P3 — Low
  { priority: 'P3', dimension: 'coupling', description: 'Orphan module — no inbound or outbound in-repo dependencies' },
  { priority: 'P3', dimension: 'commands', description: 'Frontend action with no backing capability (id not matched by any capability id/slug/ui.component)' },
]

export function priorityLabel(p: Priority): string {
  switch (p) {
    case 'P0':
      return 'Critical — breaks an enforced boundary'
    case 'P1':
      return 'High — structural integrity (cycle / wrong direction)'
    case 'P2':
      return 'Medium — quality of the module graph'
    case 'P3':
      return 'Low — hygiene'
  }
}
