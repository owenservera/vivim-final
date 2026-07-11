// devops/roadmap/discover.ts
// Discovery Engine — identify gaps not in atomic list → candidate future units.
//
// For each gap in truth report:
//   1. Does gap map to an existing atomic unit?
//   2. If NO → candidate for new unit
//   3. Group candidates by domain
//   4. Rank by severity (CRITICAL > HIGH > MEDIUM > LOW)

import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { parseUnits } from '../tracker.ts'
import { scanRoot } from '../truth/scanner.ts'
import { loadDesignDocs, compareDesignToCode } from '../truth/design-comparator.ts'
import { compareInterfaces } from '../truth/interface-comparator.ts'
import { generateGapReport, type Gap, type GapReport } from '../truth/gap-generator.ts'

const PROJECT_ROOT = join(import.meta.dir, '..', '..')
const TRACKER_PATH = join(PROJECT_ROOT, 'docs', 'atomic', '01-tracker.md')
const DESIGN_DOCS_DIR = join(PROJECT_ROOT, 'docs', 'merged-design-v2')

// ── Types ─────────────────────────────────────────────────────────────────

export interface DiscoveredUnit {
  gapId: string
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'
  domain: string
  summary: string
  detail: string
  file?: string
  suggestedUnit: string
  suggestedPhase: number
  suggestedDependencies: string[]
  effort: 'S' | 'M' | 'L' | 'XL'
}

// ── Gap-to-unit mapping ───────────────────────────────────────────────────

function inferDomain(file: string | undefined): string {
  if (!file) return 'general'
  if (file.includes('chrome') || file.includes('cdp') || file.includes('fleet') || file.includes('profile') || file.includes('port-reaper')) return 'chrome-management'
  if (file.includes('conversation') || file.includes('session') || file.includes('stream-parser')) return 'session-state'
  if (file.includes('capability')) return 'capability-system'
  if (file.includes('provider') || file.includes('model') || file.includes('routing')) return 'provider-routing'
  if (file.includes('server') || file.includes('router')) return 'api-server'
  if (file.includes('cli')) return 'cli'
  if (file.includes('config')) return 'configuration'
  if (file.includes('storage') || file.includes('prisma')) return 'storage'
  if (file.includes('telemetry') || file.includes('audit')) return 'observability'
  return 'general'
}

function suggestUnitName(gap: Gap): string {
  // Extract meaningful name from gap summary
  const summary = gap.summary
    .replace(/^(Stub file: |Mixed file: |Design claim violated: |Design claim unverifiable: |Interface not implemented: |Interface partial: )/, '')
    .replace(/\.(ts|js)$/, '')
    .replace(/[-_/]/g, ' ')

  // Convert to PascalCase
  return summary
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join('')
}

function suggestPhase(domain: string, gap: Gap): number {
  // Map domains to phases
  const domainPhaseMap: Record<string, number> = {
    'chrome-management': 11,
    'session-state': 12,
    'capability-system': 13,
    'provider-routing': 14,
    'api-server': 15,
    'cli': 16,
    'configuration': 17,
    'storage': 18,
    'observability': 19,
    'general': 20,
  }

  return domainPhaseMap[domain] ?? 20
}

function suggestDependencies(gap: Gap, existingUnits: string[]): string[] {
  const deps: string[] = []

  // If gap is in chrome-management, might depend on 11.1 (CDP Client)
  if (gap.domain === 'chrome-management' && existingUnits.includes('11.1')) {
    deps.push('11.1')
  }

  // If gap is in session-state, might depend on 3.6 (ConversationManager)
  if (gap.domain === 'session-state' && existingUnits.includes('3.6')) {
    deps.push('3.6')
  }

  return deps
}

function estimateEffort(gap: Gap): 'S' | 'M' | 'L' | 'XL' {
  switch (gap.severity) {
    case 'CRITICAL':
      return 'XL'
    case 'HIGH':
      return 'L'
    case 'MEDIUM':
      return 'M'
    case 'LOW':
      return 'S'
    default:
      return 'M'
  }
}

// ── Main discovery function ───────────────────────────────────────────────

export async function runDiscovery(): Promise<DiscoveredUnit[]> {
  // 1. Load current tracker
  const trackerContent = await readFile(TRACKER_PATH, 'utf8')
  const units = parseUnits(trackerContent.split('\n'))
  const existingUnitIds = new Set(units.map(u => u.id))
  const existingFiles = new Set(units.filter(u => u.file).map(u => u.file))

  // 2. Run truth system
  const scan = await scanRoot(PROJECT_ROOT)
  const claims = await loadDesignDocs(DESIGN_DOCS_DIR)
  const dc = compareDesignToCode(claims, scan)
  const ic = await compareInterfaces(scan)
  const gapReport = generateGapReport(scan, dc, ic)

  // 3. Find gaps that don't map to existing units
  const discovered: DiscoveredUnit[] = []

  for (const gap of gapReport.gaps) {
    // Check if gap maps to an existing unit
    const mapsToUnit = checkGapMapsToUnit(gap, units, existingFiles)

    if (!mapsToUnit) {
      const domain = inferDomain(gap.file)
      const suggestedUnit = suggestUnitName(gap)
      const suggestedPhase = suggestPhase(domain, gap)
      const suggestedDependencies = suggestDependencies(gap, [...existingUnitIds])
      const effort = estimateEffort(gap)

      discovered.push({
        gapId: gap.id,
        severity: gap.severity,
        domain,
        summary: gap.summary,
        detail: gap.detail,
        file: gap.file,
        suggestedUnit,
        suggestedPhase,
        suggestedDependencies,
        effort,
      })
    }
  }

  // 4. Sort by severity then domain
  const severityOrder = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 }
  discovered.sort((a, b) => {
    const sevDiff = severityOrder[a.severity] - severityOrder[b.severity]
    if (sevDiff !== 0) return sevDiff
    return a.domain.localeCompare(b.domain)
  })

  return discovered
}

// ── Check if gap maps to existing unit ────────────────────────────────────

function checkGapMapsToUnit(
  gap: Gap,
  units: ReturnType<typeof parseUnits>,
  existingFiles: Set<string>,
): boolean {
  // Check if gap file matches any unit's target file
  if (gap.file) {
    for (const unit of units) {
      if (unit.file && gap.file.includes(unit.file)) {
        return true
      }
      if (unit.file && unit.file.includes(gap.file)) {
        return true
      }
    }
  }

  return false
}
