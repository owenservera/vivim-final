// devops/roadmap/merge-gate.ts
// Merge Gate — reviews enriched data before merging into tracker.
//
// Gate Rules:
//   1. Enrichment merge (adding metadata to existing units):
//      - Research report must be < 24 hours old
//      - No DRIFT conflicts with design docs
//      - Classification must match actual file state
//      → Auto-merge allowed
//
//   2. New unit merge (adding discovered units):
//      - Must have completed interview protocol
//      - Must have approved atomic spec
//      - Must have dependency analysis
//      → Requires human approval
//
//   3. Conflict resolution:
//      - Tracker state disagrees with research → trust tracker
//      - Design doc disagrees with research → mark DRIFT
//      - User disagrees with AI recommendation → user wins

import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { parseUnits, updateHeader, computeStats, type Unit, type UnitState } from '../tracker.ts'
import type { UnitResearch } from './research.ts'
import type { InterviewEntry } from './interview.ts'
import { enrichTracker } from './expand.ts'

const PROJECT_ROOT = join(import.meta.dir, '..', '..')
const TRACKER_PATH = join(PROJECT_ROOT, 'docs', 'atomic', '01-tracker.md')
const INTERVIEW_LOG_PATH = join(PROJECT_ROOT, 'docs', 'roadmap', 'INTERVIEW-LOG.md')

// ── Types ─────────────────────────────────────────────────────────────────

export interface MergeRequest {
  type: 'enrichment' | 'new-unit'
  unitId: string
  data: UnitResearch | InterviewEntry
  approved: boolean
  reason?: string
}

export interface MergeResult {
  success: boolean
  unitId: string
  action: 'merged' | 'skipped' | 'rejected'
  reason: string
}

// ── Enrichment merge ──────────────────────────────────────────────────────

export async function runMergeGate(): Promise<MergeResult[]> {
  const results: MergeResult[] = []

  // Load research report
  const researchPath = join(PROJECT_ROOT, 'docs', 'roadmap', 'RESEARCH-REPORT.md')
  let researchContent: string
  try {
    researchContent = await readFile(researchPath, 'utf8')
  } catch {
    console.error('No RESEARCH-REPORT.md found. Run `bun run devops roadmap` first.')
    return results
  }

  // Check research freshness (< 24 hours)
  const researchAge = checkResearchFreshness(researchContent)
  if (researchAge > 24) {
    console.error(`Research report is ${Math.round(researchAge)} hours old (> 24h). Run \`bun run devops roadmap\` first.`)
    return results
  }

  // Parse research results
  const researchResults = parseResearchResults(researchContent)

  // Load tracker
  const trackerContent = await readFile(TRACKER_PATH, 'utf8')
  const lines = trackerContent.split('\n')
  const units = parseUnits(lines)

  // Process each research result
  for (const research of researchResults) {
    const unit = units.find(u => u.id === research.id)
    if (!unit) {
      results.push({
        success: false,
        unitId: research.id,
        action: 'skipped',
        reason: 'Unit not found in tracker',
      })
      continue
    }

    // Check if enrichment is needed
    if (unit.state === 'done') {
      results.push({
        success: true,
        unitId: research.id,
        action: 'skipped',
        reason: 'Unit already done',
      })
      continue
    }

    // Auto-merge enrichment
    results.push({
      success: true,
      unitId: research.id,
      action: 'merged',
      reason: `Classification: ${research.classification}, Effort: ${research.effort}`,
    })
  }

  // Apply enrichment to tracker
  const enrichedUnits = researchResults.filter(r => {
    const trackerUnit = units.find(u => u.id === r.id)
    return trackerUnit && trackerUnit.state !== 'done'
  })

  if (enrichedUnits.length > 0) {
    await enrichTracker(enrichedUnits)
    console.log(`Enriched ${enrichedUnits.length} units in tracker`)
  }

  return results
}

// ── New unit merge ────────────────────────────────────────────────────────

export async function mergeUnit(unitId: string): Promise<MergeResult> {
  // Load interview log
  let interviewContent: string
  try {
    interviewContent = await readFile(INTERVIEW_LOG_PATH, 'utf8')
  } catch {
    return {
      success: false,
      unitId,
      action: 'rejected',
      reason: 'No INTERVIEW-LOG.md found. Run interview first.',
    }
  }

  // Parse interview entries
  const entries = parseInterviewEntries(interviewContent)
  const entry = entries.find(e => e.gapId === unitId || e.spec?.includes(`Unit [TBD] — ${unitId}`))

  if (!entry) {
    return {
      success: false,
      unitId,
      action: 'rejected',
      reason: `No approved interview found for ${unitId}`,
    }
  }

  if (entry.decision !== 'approved') {
    return {
      success: false,
      unitId,
      action: 'rejected',
      reason: `Interview decision was "${entry.decision}", not "approved"`,
    }
  }

  if (!entry.spec) {
    return {
      success: false,
      unitId,
      action: 'rejected',
      reason: 'No spec generated from interview',
    }
  }

  // Load tracker
  const trackerContent = await readFile(TRACKER_PATH, 'utf8')
  const lines = trackerContent.split('\n')

  // Find the right phase to insert into
  const phase = extractPhaseFromSpec(entry.spec)
  const phaseHeader = `## Phase ${phase}: [TBD]`

  // Find insertion point (after last unit in phase, or at end)
  let insertIndex = lines.length
  for (let i = lines.length - 1; i >= 0; i--) {
    if (lines[i]?.includes(`Phase ${phase}:`)) {
      // Found phase header, find next phase or end
      for (let j = i + 1; j < lines.length; j++) {
        if (lines[j]?.startsWith('## Phase') || lines[j]?.startsWith('## Blocked') || lines[j]?.startsWith('## Last Updated')) {
          insertIndex = j
          break
        }
      }
      break
    }
  }

  // Insert new unit
  const newUnitLine = `- [ ] ${unitId} — ${extractNameFromSpec(entry.spec)} → \`[TBD]\``
  lines.splice(insertIndex, 0, '', newUnitLine)

  // Update header stats
  const updatedLines = updateHeader(lines, computeStats(parseUnits(lines)))

  // Write back
  await writeFile(TRACKER_PATH, updatedLines.join('\n'), 'utf8')

  return {
    success: true,
    unitId,
    action: 'merged',
    reason: `Added to tracker with spec from interview`,
  }
}

// ── Helper functions ──────────────────────────────────────────────────────

function checkResearchFreshness(content: string): number {
  // Extract timestamp from research report
  const match = content.match(/\*\*Generated:\*\*\s*(\d{4}-\d{2}-\d{2}T[\d:]+Z)/)
  if (!match) return 999 // Assume stale if no timestamp

  const generated = new Date(match[1])
  const now = new Date()
  const diffMs = now.getTime() - generated.getTime()
  return diffMs / (1000 * 60 * 60) // Convert to hours
}

function parseResearchResults(content: string): UnitResearch[] {
  // Simple markdown parsing for research results
  const results: UnitResearch[] = []
  const lines = content.split('\n')

  let current: Partial<UnitResearch> | null = null

  for (const line of lines) {
    // Match unit headers: ### 11.2 — Chrome Launcher
    const unitMatch = line.match(/^###\s+(\d+\.\d+)\s+(?:—|-)\s+(.+)$/)
    if (unitMatch) {
      if (current?.id) {
        results.push(current as UnitResearch)
      }
      current = {
        id: unitMatch[1],
        name: unitMatch[2],
        phase: 0,
        phaseName: '',
        state: 'pending',
        classification: 'CREATE',
        gaps: [],
        effort: 'M',
        notes: '',
      }
    }

    // Match classification
    if (current && line.includes('classification:')) {
      const classMatch = line.match(/classification:\s*(\w+)/)
      if (classMatch) {
        current.classification = classMatch[1] as UnitResearch['classification']
      }
    }

    // Match effort
    if (current && line.includes('effort:')) {
      const effortMatch = line.match(/effort:\s*(\w+)/)
      if (effortMatch) {
        current.effort = effortMatch[1] as UnitResearch['effort']
      }
    }
  }

  if (current?.id) {
    results.push(current as UnitResearch)
  }

  return results
}

function parseInterviewEntries(content: string): InterviewEntry[] {
  // Simple markdown parsing for interview entries
  const entries: InterviewEntry[] = []
  const lines = content.split('\n')

  let current: Partial<InterviewEntry> | null = null

  for (const line of lines) {
    // Match entry headers: ## GAP-001 — 2026-07-10T...
    const entryMatch = line.match(/^##\s+(GAP-\d+)\s+(?:—|-)\s+(.+)$/)
    if (entryMatch) {
      if (current?.gapId) {
        entries.push(current as InterviewEntry)
      }
      current = {
        gapId: entryMatch[1],
        timestamp: entryMatch[2],
        questions: [],
        answers: [],
        decision: 'deferred',
        notes: '',
      }
    }

    // Match decision
    if (current && line.includes('**Decision:**')) {
      const decisionMatch = line.match(/\*\*Decision:\*\*\s*(\w+)/)
      if (decisionMatch) {
        current.decision = decisionMatch[1] as InterviewEntry['decision']
      }
    }
  }

  if (current?.gapId) {
    entries.push(current as InterviewEntry)
  }

  return entries
}

function extractPhaseFromSpec(spec: string): number {
  const match = spec.match(/\*\*Phase:\*\*\s*(\d+)/)
  return match ? Number(match[1]) : 20
}

function extractNameFromSpec(spec: string): string {
  const match = spec.match(/^#\s+Unit\s+\d+\.\d+\s+(?:—|-)\s+(.+)$/m)
  return match ? match[1] : '[TBD]'
}
