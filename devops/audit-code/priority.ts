// devops/audit-code/priority.ts
// Audit priority scheme (P0-P3) and scope/depth tiers.
//
// Priority drives remediation order. Scope drives how much of the codebase
// is analysed (and therefore cost). Both are cumulative: each deeper scope
// runs everything the shallower one does, plus more checks.

export type Priority = 'P0' | 'P1' | 'P2' | 'P3'
export type Scope = 'surface' | 'standard' | 'deep' | 'full'
export type Dimension =
  | 'security'
  | 'correctness'
  | 'architecture'
  | 'quality'
  | 'performance'
  | 'testing'
  | 'dependencies'
  | 'drift'
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

export function comparePriority(a: Priority, b: Priority): number {
  return priorityRank(a) - priorityRank(b)
}

export function scopeIncludes(requested: Scope, minimum: Scope): boolean {
  return scopeRank(requested) >= scopeRank(minimum)
}

// ── Documentation table (rendered into the report legend) ──────────────────

export interface PriorityRule {
  priority: Priority
  dimension: Dimension
  invariant?: string
  description: string
}

export const PRIORITY_RULES: PriorityRule[] = [
  // P0 — Critical
  { priority: 'P0', dimension: 'security', description: 'Secret/key leakage in source or config' },
  { priority: 'P0', dimension: 'security', description: 'Untrusted input reaching a command/interpreter boundary' },
  { priority: 'P0', dimension: 'architecture', invariant: 'B1', description: 'Governor Canon violation — engine touches CDP directly' },
  { priority: 'P0', dimension: 'architecture', invariant: 'B2', description: 'Store-contract isolation violation — engine imports storage/impl' },
  { priority: 'P0', dimension: 'correctness', description: 'Crash / data-loss path on the happy route' },
  // P1 — High
  { priority: 'P1', dimension: 'architecture', invariant: 'B5', description: 'Engine reads process.env / raw config instead of ConfigManager' },
  { priority: 'P1', dimension: 'architecture', invariant: 'B7', description: 'Raw `new Error()` used inside an engine' },
  { priority: 'P1', dimension: 'correctness', description: 'Swallowed exception / silent catch' },
  { priority: 'P1', dimension: 'testing', invariant: 'D1', description: 'Engine with no unit test' },
  { priority: 'P1', dimension: 'correctness', description: 'Dead code on a hot path (unreachable branch)' },
  // P2 — Medium
  { priority: 'P2', dimension: 'quality', invariant: 'D2', description: '`any` type in engine code' },
  { priority: 'P2', dimension: 'performance', description: 'N+1 / unbounded loop over a collection' },
  { priority: 'P2', dimension: 'testing', description: 'Public API with no test coverage' },
  { priority: 'P2', dimension: 'quality', description: 'Unused export / import' },
  { priority: 'P2', dimension: 'dependencies', description: 'Unused or deprecated dependency' },
  // P3 — Low
  { priority: 'P3', dimension: 'quality', description: 'TODO / stub / placeholder debt' },
  { priority: 'P3', dimension: 'quality', description: 'Naming / style / missing doc' },
]

export function priorityLabel(p: Priority): string {
  switch (p) {
    case 'P0':
      return 'Critical — fix before any release'
    case 'P1':
      return 'High — correctness / architecture'
    case 'P2':
      return 'Medium — quality / performance'
    case 'P3':
      return 'Low — hygiene'
  }
}
