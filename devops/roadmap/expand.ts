// devops/roadmap/expand.ts
// Tracker Expansion — adds new units to atomic list after merge gate approval.
//
// This module handles:
//   1. Adding enriched metadata to existing units
//   2. Adding new units from interview-approved specs
//   3. Updating tracker stats and headers

import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { parseUnits, updateHeader, computeStats, updateState } from '../tracker.ts'
import type { UnitResearch } from './research.ts'

const PROJECT_ROOT = join(import.meta.dir, '..', '..')
const TRACKER_PATH = join(PROJECT_ROOT, 'docs', 'atomic', '01-tracker.md')

// ── Types ─────────────────────────────────────────────────────────────────

export interface EnrichedUnit {
  id: string
  name: string
  phase: number
  phaseName: string
  file?: string
  state: 'pending' | 'in_progress' | 'done' | 'blocked'
  classification?: string
  source?: string
  effort?: string
  gaps?: string[]
  vivimRef?: string
  vivimApi?: string
  skip?: string
}

// ── Enrich existing units ─────────────────────────────────────────────────

export async function enrichTracker(researchResults: UnitResearch[]): Promise<void> {
  const content = await readFile(TRACKER_PATH, 'utf8')
  const lines = content.split('\n')
  const units = parseUnits(lines)

  // Build enrichment map
  const enrichmentMap = new Map<string, UnitResearch>()
  for (const r of researchResults) {
    enrichmentMap.set(r.id, r)
  }

  // Find and enrich each unit
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (!line) continue

    // Match unit lines
    const unitMatch = line.match(/^(\s*)-\s+\[([ x~!])\]\s+(\d+\.\d+)\s+(?:—|-)\s+(.+?)(?:\s+→\s+`(.+?)`)?\s*$/)
    if (!unitMatch) continue

    const unitId = unitMatch[3]
    if (!unitId) continue

    const research = enrichmentMap.get(unitId)
    if (!research) continue

    // Don't enrich done units
    const unit = units.find(u => u.id === unitId)
    if (unit?.state === 'done') continue

    // Add enrichment as indented comments after the unit line
    const enrichmentLines: string[] = []
    if (research.classification) {
      enrichmentLines.push(`  - classification: ${research.classification}`)
    }
    if (research.classification === 'PORT' && research.vivimRef) {
      enrichmentLines.push(`  - source: against vivim-final (${research.vivimLines ?? '?'} lines)`)
    } else if (research.classification === 'CREATE') {
      enrichmentLines.push(`  - source: CREATE new`)
    } else if (research.classification === 'FIX') {
      enrichmentLines.push(`  - source: FIX stubs`)
    }
    if (research.effort) {
      enrichmentLines.push(`  - effort: ${research.effort}`)
    }
    if (research.gaps && research.gaps.length > 0) {
      enrichmentLines.push(`  - gaps: ${research.gaps.length} (${research.gaps[0]})`)
    }
    if (research.vivimApi) {
      enrichmentLines.push(`  - vivim-api: ${research.vivimApi}`)
    }
    if (research.skip) {
      enrichmentLines.push(`  - skip: ${research.skip}`)
    }

    if (enrichmentLines.length > 0) {
      // Insert enrichment after the unit line
      lines.splice(i + 1, 0, ...enrichmentLines)
      i += enrichmentLines.length // Skip past inserted lines
    }
  }

  // Write back
  await writeFile(TRACKER_PATH, lines.join('\n'), 'utf8')
}

// ── Add new unit ──────────────────────────────────────────────────────────

export async function addNewUnit(
  unitId: string,
  name: string,
  phase: number,
  phaseName: string,
  file: string,
  dependencies: string[],
): Promise<void> {
  const content = await readFile(TRACKER_PATH, 'utf8')
  const lines = content.split('\n')

  // Find the right phase to insert into
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
  const newUnitLine = `- [ ] ${unitId} — ${name} → \`${file}\``
  lines.splice(insertIndex, 0, '', newUnitLine)

  // Update header stats
  const updatedLines = updateHeader(lines, computeStats(parseUnits(lines)))

  // Write back
  await writeFile(TRACKER_PATH, updatedLines.join('\n'), 'utf8')
}

// ── Remove enrichment (for testing/cleanup) ───────────────────────────────

export async function removeEnrichment(): Promise<void> {
  const content = await readFile(TRACKER_PATH, 'utf8')
  const lines = content.split('\n')

  // Remove lines that start with "  - " (enrichment lines)
  const filtered = lines.filter(line => {
    // Keep lines that are not enrichment
    return !line.match(/^\s{2}-\s+(classification|source|effort|gaps|vivim-ref|vivim-api|skip):/)
  })

  // Update header stats
  const updatedLines = updateHeader(filtered, computeStats(parseUnits(filtered)))

  // Write back
  await writeFile(TRACKER_PATH, updatedLines.join('\n'), 'utf8')
}
