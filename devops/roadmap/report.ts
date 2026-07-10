// devops/roadmap/report.ts
// Report Generator — produces research reports, discovered units, and domain health.
//
// Outputs:
//   1. docs/roadmap/RESEARCH-REPORT.md — per-unit research data
//   2. docs/roadmap/DISCOVERED-UNITS.md — candidate future units
//   3. docs/roadmap/DOMAIN-HEALTH.md — domain truth scores

import { writeFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import type { UnitResearch } from './research.ts'
import type { DiscoveredUnit } from './discover.ts'

const PROJECT_ROOT = join(import.meta.dir, '..', '..')
const ROADMAP_DIR = join(PROJECT_ROOT, 'docs', 'roadmap')

// ── Types ─────────────────────────────────────────────────────────────────

interface DomainHealth {
  domain: string
  totalUnits: number
  doneUnits: number
  pendingUnits: number
  truthScore: number
  topGaps: string[]
}

// ── Main report generator ─────────────────────────────────────────────────

export async function generateReport(
  researchResults: UnitResearch[],
  discovered: DiscoveredUnit[],
): Promise<void> {
  // Ensure directory exists
  await mkdir(ROADMAP_DIR, { recursive: true })

  // Generate all reports
  await generateResearchReport(researchResults)
  await generateDiscoveredUnitsReport(discovered)
  await generateDomainHealthReport(researchResults, discovered)
}

// ── Research Report ───────────────────────────────────────────────────────

async function generateResearchReport(results: UnitResearch[]): Promise<void> {
  const lines: string[] = [
    '# Research Report',
    '',
    `**Generated:** ${new Date().toISOString()}`,
    `**Truth Score:** ${calculateTruthScore(results)}%`,
    '',
    '---',
    '',
    '## Executive Summary',
    '',
    `- Total units: ${results.length}`,
    `- Done: ${results.filter(r => r.classification === 'DONE').length}`,
    `- Need port: ${results.filter(r => r.classification === 'PORT').length}`,
    `- Need create: ${results.filter(r => r.classification === 'CREATE').length}`,
    `- Need fix: ${results.filter(r => r.classification === 'FIX').length}`,
    '',
    '---',
    '',
    '## Unit Research',
    '',
  ]

  // Group by phase
  const byPhase = new Map<number, UnitResearch[]>()
  for (const r of results) {
    const phase = byPhase.get(r.phase) ?? []
    phase.push(r)
    byPhase.set(r.phase, phase)
  }

  for (const [phase, phaseResults] of [...byPhase.entries()].sort((a, b) => a[0] - b[0])) {
    lines.push(`### Phase ${phase}`)
    lines.push('')

    for (const r of phaseResults) {
      lines.push(`#### ${r.id} — ${r.name}`)
      lines.push('')
      lines.push(`- **Status:** ${r.state}`)
      lines.push(`- **File:** \`${r.file ?? 'N/A'}\``)
      lines.push(`- **Classification:** ${r.classification}`)
      lines.push(`- **Source:** ${r.source ?? 'N/A'}`)
      lines.push(`- **Effort:** ${r.effort}`)

      if (r.gaps && r.gaps.length > 0) {
        lines.push(`- **Gaps:** ${r.gaps.length}`)
        for (const gap of r.gaps.slice(0, 3)) {
          lines.push(`  - ${gap}`)
        }
        if (r.gaps.length > 3) {
          lines.push(`  - ... and ${r.gaps.length - 3} more`)
        }
      }

      if (r.vivimRef) {
        lines.push(`- **Vivim ref:** \`${r.vivimRef}\``)
      }
      if (r.vivimApi) {
        lines.push(`- **Vivim API:** ${r.vivimApi}`)
      }
      if (r.skip) {
        lines.push(`- **Skip:** ${r.skip}`)
      }

      lines.push('')
    }
  }

  // Implementation order
  lines.push('---')
  lines.push('')
  lines.push('## Implementation Order')
  lines.push('')

  const pending = results
    .filter(r => r.classification !== 'DONE')
    .sort((a, b) => {
      const effortOrder = { S: 0, M: 1, L: 2, XL: 3 }
      const effortDiff = (effortOrder[a.effort] ?? 1) - (effortOrder[b.effort] ?? 1)
      if (effortDiff !== 0) return effortDiff
      return a.id.localeCompare(b.id, undefined, { numeric: true })
    })

  for (const r of pending) {
    lines.push(`1. **${r.id} — ${r.name}** (${r.classification}, ${r.effort})`)
  }

  lines.push('')

  // Write report
  const reportPath = join(ROADMAP_DIR, 'RESEARCH-REPORT.md')
  await writeFile(reportPath, lines.join('\n'), 'utf8')
}

// ── Discovered Units Report ───────────────────────────────────────────────

async function generateDiscoveredUnitsReport(discovered: DiscoveredUnit[]): Promise<void> {
  const lines: string[] = [
    '# Discovered Units',
    '',
    `**Generated:** ${new Date().toISOString()}`,
    '',
    'These are gaps in the codebase that don\'t map to any existing atomic unit.',
    'They are candidates for future phases.',
    '',
    '---',
    '',
  ]

  // Group by severity
  const bySeverity = new Map<string, DiscoveredUnit[]>()
  for (const d of discovered) {
    const severity = bySeverity.get(d.severity) ?? []
    severity.push(d)
    bySeverity.set(d.severity, severity)
  }

  const severityOrder = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']
  for (const severity of severityOrder) {
    const units = bySeverity.get(severity)
    if (!units || units.length === 0) continue

    lines.push(`## ${severity} (${units.length})`)
    lines.push('')
    lines.push('| ID | Domain | Summary | Suggested Unit | Phase | Effort |')
    lines.push('|---|---|---|---|---|---|')

    for (const d of units) {
      lines.push(`| ${d.gapId} | ${d.domain} | ${d.summary} | ${d.suggestedUnit} | ${d.suggestedPhase} | ${d.effort} |`)
    }

    lines.push('')
  }

  // Write report
  const reportPath = join(ROADMAP_DIR, 'DISCOVERED-UNITS.md')
  await writeFile(reportPath, lines.join('\n'), 'utf8')
}

// ── Domain Health Report ──────────────────────────────────────────────────

async function generateDomainHealthReport(
  results: UnitResearch[],
  discovered: DiscoveredUnit[],
): Promise<void> {
  // Calculate domain health
  const domainHealth = calculateDomainHealth(results, discovered)

  const lines: string[] = [
    '# Domain Health',
    '',
    `**Generated:** ${new Date().toISOString()}`,
    '',
    '| Domain | Total | Done | Pending | Truth Score | Top Gaps |',
    '|--------|-------|------|---------|-------------|----------|',
  ]

  for (const dh of domainHealth.sort((a, b) => b.truthScore - a.truthScore)) {
    const topGaps = dh.topGaps.slice(0, 2).join('; ') || 'None'
    lines.push(`| ${dh.domain} | ${dh.totalUnits} | ${dh.doneUnits} | ${dh.pendingUnits} | ${dh.truthScore}% | ${topGaps} |`)
  }

  lines.push('')
  lines.push('---')
  lines.push('')
  lines.push('## Gap Distribution by Domain')
  lines.push('')

  const gapByDomain = new Map<string, number>()
  for (const d of discovered) {
    gapByDomain.set(d.domain, (gapByDomain.get(d.domain) ?? 0) + 1)
  }

  for (const [domain, count] of [...gapByDomain.entries()].sort((a, b) => b[1] - a[1])) {
    lines.push(`- **${domain}:** ${count} gaps`)
  }

  lines.push('')

  // Write report
  const reportPath = join(ROADMAP_DIR, 'DOMAIN-HEALTH.md')
  await writeFile(reportPath, lines.join('\n'), 'utf8')
}

// ── Helper functions ──────────────────────────────────────────────────────

function calculateTruthScore(results: UnitResearch[]): number {
  if (results.length === 0) return 0
  const done = results.filter(r => r.classification === 'DONE').length
  return Math.round((done / results.length) * 100)
}

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

function calculateDomainHealth(
  results: UnitResearch[],
  discovered: DiscoveredUnit[],
): DomainHealth[] {
  const domainMap = new Map<string, DomainHealth>()

  // Initialize domains from results
  for (const r of results) {
    const domain = inferDomain(r.file)
    if (!domainMap.has(domain)) {
      domainMap.set(domain, {
        domain,
        totalUnits: 0,
        doneUnits: 0,
        pendingUnits: 0,
        truthScore: 0,
        topGaps: [],
      })
    }
    const dh = domainMap.get(domain)!
    dh.totalUnits++
    if (r.classification === 'DONE') {
      dh.doneUnits++
    } else {
      dh.pendingUnits++
    }
  }

  // Add gaps from discovered
  for (const d of discovered) {
    if (!domainMap.has(d.domain)) {
      domainMap.set(d.domain, {
        domain: d.domain,
        totalUnits: 0,
        doneUnits: 0,
        pendingUnits: 0,
        truthScore: 0,
        topGaps: [],
      })
    }
    const dh = domainMap.get(d.domain)!
    dh.topGaps.push(d.summary)
  }

  // Calculate truth scores
  for (const dh of domainMap.values()) {
    dh.truthScore = dh.totalUnits > 0
      ? Math.round((dh.doneUnits / dh.totalUnits) * 100)
      : 0
  }

  return [...domainMap.values()]
}
