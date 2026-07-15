// devops/audit-arch/findings.ts
// Architecture-audit finding data model + persistence + summary.
//
// Reuses the generic helpers from `../audit-code/findings.ts` (computeSummary,
// risk, persistence, baseline trend) so the two subsystems share one machine
// format. Architecture findings get an `AR-` id prefix to stay distinct from
// source-audit `AU-` findings.

import {
  computeRisk,
  computeSummary,
  loadFindings,
  loadLatestBaseline,
  riskLabel,
  saveBaseline,
  saveFindings,
  compareBaseline,
  type Finding,
  type FindingsFile,
  type FindingsSummary,
} from '../audit-code/findings.ts'

export {
  computeRisk,
  computeSummary,
  loadFindings,
  loadLatestBaseline,
  riskLabel,
  saveBaseline,
  saveFindings,
  compareBaseline,
}
export type { Finding, FindingsFile, FindingsSummary }
export type FindingStatus = Finding['status']

export type FixEffort = 'S' | 'M' | 'L'

export interface FixInstructions {
  summary: string
  steps: string[]
  patchSuggestion?: string
  effort: FixEffort
  autoFixable: boolean
}

export interface FindingInput {
  priority: Priority
  dimension: Dimension
  invariant?: string
  title: string
  description: string
  file: string
  line: number
  evidence: string
  impact: string
  fixSummary: string
  fixSteps: string[]
  patchSuggestion?: string
  effort: FixEffort
  autoFixable: boolean
  linkedUnit?: string
  linkedAdr?: string
}

import type { Dimension, Priority } from '../audit-code/priority.ts'

let counter = 0

export function resetIdCounter(): void {
  counter = 0
}

function nextFindingId(): string {
  counter += 1
  return `AR-${String(counter).padStart(4, '0')}`
}

export function buildFinding(input: FindingInput): Finding {
  return {
    id: nextFindingId(),
    priority: input.priority,
    dimension: input.dimension,
    invariant: input.invariant,
    title: input.title,
    description: input.description,
    file: input.file,
    line: input.line,
    evidence: input.evidence,
    impact: input.impact,
    fix: {
      summary: input.fixSummary,
      steps: input.fixSteps,
      patchSuggestion: input.patchSuggestion,
      effort: input.effort,
      autoFixable: input.autoFixable,
    },
    status: 'open',
    linkedUnit: input.linkedUnit,
    linkedAdr: input.linkedAdr,
  }
}
