// devops/deep-scan/types.ts
// Deep-scan type model: phase identifiers, normalized findings, scores.
//
// Deep-scan reuses the audit finding model from `audit-code/findings.ts` and
// adds a `phase` field so every finding is traceable to the pass that produced
// it (P01..P10). Findings from reused checks (audit-code AU-, audit-arch AR-)
// are renumbered to a unified `DS-` prefix so the report is self-consistent.

import type {
  Dimension,
  Priority,
} from '../audit-code/priority.ts'
import type {
  FindingStatus,
  FixInstructions,
} from '../audit-code/findings.ts'

export type PhaseId =
  | 'P01'
  | 'P02'
  | 'P03'
  | 'P04'
  | 'P05'
  | 'P06'
  | 'P07'
  | 'P08'
  | 'P09'
  | 'P10'

export const PHASE_ORDER: PhaseId[] = [
  'P01',
  'P02',
  'P03',
  'P04',
  'P05',
  'P06',
  'P07',
  'P08',
  'P09',
  'P10',
]

export interface PhaseMeta {
  id: PhaseId
  name: string
  dimension: string // primary domain the phase feeds
  minScope: Scope
  durationMs: number
}

export type Scope = 'surface' | 'standard' | 'deep' | 'full'

// Normalized deep-scan finding. Mirrors the audit Finding shape (so
// fix/to-units can consume it) plus `phase`.
export interface DeepScanFinding {
  id: string // DS-NNNN
  phase: PhaseId
  priority: Priority
  dimension: Dimension
  invariant?: string
  title: string
  description: string
  file: string
  line: number
  evidence: string
  impact: string
  fix: FixInstructions
  status: FindingStatus
  linkedUnit?: string
  linkedAdr?: string
}

export interface DomainScore {
  domain: DomainId
  score: number // 0..1 (1 = clean)
  weightedFindings: number
  count: number
  p0: number
  p1: number
  p2: number
  p3: number
}

export type DomainId =
  | 'correctness'
  | 'architecture'
  | 'performance'
  | 'quality'
  | 'testHealth'
  | 'commands' // cross-surface gate (scored separately, pass/fail)

export const DOMAIN_WEIGHTS: Record<DomainId, number> = {
  correctness: 0.4,
  architecture: 0.3,
  performance: 0.15,
  quality: 0.1,
  testHealth: 0.05,
  commands: 0, // gate, not weighted
}

export interface PhaseSummary {
  phase: PhaseId
  dimension: string
  findings: number
  topModules: { module: string; count: number }[]
}

export interface ScanRun {
  scope: Scope
  commit: string
  date: string
  filesScanned: number
  durationMs: number
  phaseDurationsMs: Record<PhaseId, number>
}

export interface RiskVerdict {
  risk: 'H' | 'M' | 'L'
  reason: string
}

export interface DeepScanReport {
  run: ScanRun
  scores: Record<DomainId, DomainScore>
  risk: RiskVerdict
  summary: { P0: number; P1: number; P2: number; P3: number; total: number }
  phaseSummary: PhaseSummary[]
  crossSurfaceGate: { pass: boolean; reason: string; count: number }
  findings: DeepScanFinding[]
}
