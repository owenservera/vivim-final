// devops/truth/gap-generator.ts
// Gap Generator — produces truth-grounded gap report from scanner + comparators
//
// Combines three data sources:
//   1. Scanner: file-by-file classification (REAL/STUB/INTERFACE_ONLY/MIXED)
//   2. Design Comparator: design doc claims vs actual code
//   3. Interface Comparator: exported interfaces vs implementations
//
// Output: prioritized list of gaps with severity, owner, and recommended action

import type { ScanResult, FileClassification } from './scanner.ts'
import type { DesignComparisonResult, DesignClaim } from './design-comparator.ts'
import type { InterfaceComparisonResult, InterfaceComparison } from './interface-comparator.ts'

// ── Types ─────────────────────────────────────────────────────────────────

export type GapSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'
export type GapType = 'STUB_FILE' | 'MISSING_FILE' | 'PARTIAL_IMPL' | 'DESIGN_CLAIM_VIOLATED' | 'DESIGN_CLAIM_UNVERIFIABLE' | 'INTERFACE_MISSING' | 'INTERFACE_PARTIAL'

export interface Gap {
  id: string
  severity: GapSeverity
  type: GapType
  domain: string          // engine domain: chrome, session, capability, etc.
  summary: string
  detail: string
  file?: string
  interface?: string
  designDoc?: string
  recommendedAction: string
  estimatedEffort: string  // S/M/L/XL
}

export interface GapReport {
  timestamp: string
  totalGaps: number
  bySeverity: Record<GapSeverity, number>
  byType: Record<GapType, number>
  byDomain: Record<string, number>
  gaps: Gap[]
  truthScore: number      // 0-100, how grounded is the roadmap
  executiveSummary: string
}

// ── Domain mapping ────────────────────────────────────────────────────────

function inferDomain(file: string): string {
  if (file.includes('chrome') || file.includes('cdp') || file.includes('fleet') || file.includes('profile') || file.includes('port-reaper')) return 'chrome-management'
  if (file.includes('conversation') || file.includes('session') || file.includes('stream-parser')) return 'session-state'
  if (file.includes('capability') || file.includes('capability-shape')) return 'capability-system'
  if (file.includes('provider') || file.includes('model') || file.includes('routing')) return 'provider-routing'
  if (file.includes('server') || file.includes('router')) return 'api-server'
  if (file.includes('cli')) return 'cli'
  if (file.includes('config')) return 'configuration'
  if (file.includes('schema')) return 'schema'
  if (file.includes('storage') || file.includes('prisma')) return 'storage'
  if (file.includes('telemetry') || file.includes('audit')) return 'observability'
  if (file.includes('health')) return 'health'
  if (file.includes('knowledge')) return 'knowledge'
  return 'general'
}

function inferSeverity(gap: Omit<Gap, 'severity' | 'id'>): GapSeverity {
  // Critical: files the system depends on that are stubs
  if (gap.type === 'STUB_FILE' && (gap.file?.includes('cdp') || gap.file?.includes('fleet'))) return 'CRITICAL'
  if (gap.type === 'MISSING_FILE' && gap.domain === 'chrome-management') return 'CRITICAL'
  if (gap.type === 'DESIGN_CLAIM_VIOLATED' && gap.designDoc?.includes('08-merged')) return 'HIGH'

  // Type-based severity
  switch (gap.type) {
    case 'STUB_FILE': return 'HIGH'
    case 'MISSING_FILE': return 'HIGH'
    case 'PARTIAL_IMPL': return 'MEDIUM'
    case 'DESIGN_CLAIM_VIOLATED': return 'HIGH'
    case 'DESIGN_CLAIM_UNVERIFIABLE': return 'MEDIUM'
    case 'INTERFACE_MISSING': return 'MEDIUM'
    case 'INTERFACE_PARTIAL': return 'MEDIUM'
    default: return 'LOW'
  }
}

function inferEffort(gap: Gap): string {
  if (gap.type === 'MISSING_FILE') return 'L'
  if (gap.type === 'STUB_FILE' && gap.file?.includes('cdp')) return 'XL'
  if (gap.type === 'STUB_FILE') return 'M'
  if (gap.type === 'PARTIAL_IMPL') return 'S'
  return 'S'
}

// ── Gap generation from scanner ───────────────────────────────────────────

function gapsFromScanner(scan: ScanResult): Omit<Gap, 'severity' | 'id'>[] {
  const gaps: Omit<Gap, 'severity' | 'id'>[] = []

  for (const file of scan.files) {
    const domain = inferDomain(file.relativePath)

    if (file.classification === 'STUB') {
      gaps.push({
        type: 'STUB_FILE',
        domain,
        summary: `Stub file: ${file.relativePath}`,
        detail: `File is a stub with ${file.stubCount} stub markers and 0 real logic. ${file.lines} lines.`,
        file: file.relativePath,
        recommendedAction: `Implement ${file.relativePath} — build against vivim-final or write new implementation`,
        estimatedEffort: 'M',
      })
    } else if (file.classification === 'MIXED') {
      gaps.push({
        type: 'PARTIAL_IMPL',
        domain,
        summary: `Mixed file: ${file.relativePath}`,
        detail: `File has ${file.realCount} real markers and ${file.stubCount} stub markers. Partially implemented.`,
        file: file.relativePath,
        recommendedAction: `Complete implementation of stub methods in ${file.relativePath}`,
        estimatedEffort: 'S',
      })
    }
  }

  return gaps
}

// ── Gap generation from design comparator ─────────────────────────────────

function gapsFromDesignComparison(dc: DesignComparisonResult): Omit<Gap, 'severity' | 'id'>[] {
  const gaps: Omit<Gap, 'severity' | 'id'>[] = []

  for (const claim of dc.violated) {
    gaps.push({
      type: 'DESIGN_CLAIM_VIOLATED',
      domain: inferDomain(claim.claimedFile ?? claim.name),
      summary: `Design claim violated: ${claim.name}`,
      detail: `Design doc "${claim.source}" claims ${claim.name} exists at line ${claim.line}, but actual code is a stub or interface-only.`,
      file: claim.claimedFile,
      designDoc: claim.source,
      recommendedAction: `Implement ${claim.name} to match design doc spec`,
      estimatedEffort: 'M',
    })
  }

  for (const claim of dc.unverifiable) {
    gaps.push({
      type: 'DESIGN_CLAIM_UNVERIFIABLE',
      domain: inferDomain(claim.claimedFile ?? claim.name),
      summary: `Design claim unverifiable: ${claim.name}`,
      detail: `Design doc "${claim.source}" mentions ${claim.name} but no matching file found in codebase.`,
      file: claim.claimedFile,
      designDoc: claim.source,
      recommendedAction: `Create ${claim.claimedFile ?? claim.name} as specified in design doc`,
      estimatedEffort: 'L',
    })
  }

  return gaps
}

// ── Gap generation from interface comparator ───────────────────────────────

function gapsFromInterfaceComparison(ic: InterfaceComparisonResult): Omit<Gap, 'severity' | 'id'>[] {
  const gaps: Omit<Gap, 'severity' | 'id'>[] = []

  for (const comp of ic.missing) {
    gaps.push({
      type: 'INTERFACE_MISSING',
      domain: inferDomain(comp.interfaceFile),
      summary: `Interface not implemented: ${comp.interfaceName}`,
      detail: `Interface ${comp.interfaceName} in ${comp.interfaceFile} has no implementing class.`,
      file: comp.interfaceFile,
      interface: comp.interfaceName,
      recommendedAction: `Create implementing class for ${comp.interfaceName}`,
      estimatedEffort: 'L',
    })
  }

  for (const comp of ic.stub) {
    const unimplemented = comp.methods.filter((m) => !m.implemented || m.stub)
    gaps.push({
      type: 'INTERFACE_PARTIAL',
      domain: inferDomain(comp.interfaceFile),
      summary: `Interface stub: ${comp.interfaceName} (${unimplemented.length} methods stubbed)`,
      detail: `Class ${comp.implementingClass} implements ${comp.interfaceName} but ${unimplemented.length}/${comp.methods.length} methods are stubs: ${unimplemented.map((m) => m.name).join(', ')}`,
      file: comp.implementingFile,
      interface: comp.interfaceName,
      recommendedAction: `Implement stub methods: ${unimplemented.map((m) => m.name).join(', ')}`,
      estimatedEffort: 'M',
    })
  }

  for (const comp of ic.partial) {
    const missing = comp.methods.filter((m) => !m.implemented)
    gaps.push({
      type: 'INTERFACE_PARTIAL',
      domain: inferDomain(comp.interfaceFile),
      summary: `Interface partial: ${comp.interfaceName} (${missing.length} methods missing)`,
      detail: `Class ${comp.implementingClass} implements ${comp.interfaceName} but ${missing.length}/${comp.methods.length} methods missing: ${missing.map((m) => m.name).join(', ')}`,
      file: comp.implementingFile,
      interface: comp.interfaceName,
      recommendedAction: `Implement missing methods: ${missing.map((m) => m.name).join(', ')}`,
      estimatedEffort: 'M',
    })
  }

  return gaps
}

// ── Main generator ────────────────────────────────────────────────────────

export function generateGapReport(
  scan: ScanResult,
  dc: DesignComparisonResult,
  ic: InterfaceComparisonResult,
): GapReport {
  const rawGaps = [
    ...gapsFromScanner(scan),
    ...gapsFromDesignComparison(dc),
    ...gapsFromInterfaceComparison(ic),
  ]

  // Assign severity and IDs
  const gaps: Gap[] = rawGaps.map((g, i) => {
    const severity = inferSeverity(g)
    const id = `GAP-${String(i + 1).padStart(3, '0')}`
    const effort = inferEffort({ ...g, severity, id })
    return { ...g, severity, id, estimatedEffort: effort }
  })

  // Sort by severity
  const severityOrder: Record<GapSeverity, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 }
  gaps.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity])

  // Count by severity
  const bySeverity: Record<GapSeverity, number> = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 }
  for (const g of gaps) bySeverity[g.severity]++

  // Count by type
  const byType: Record<GapType, number> = {} as Record<GapType, number>
  for (const g of gaps) byType[g.type] = (byType[g.type] ?? 0) + 1

  // Count by domain
  const byDomain: Record<string, number> = {}
  for (const g of gaps) byDomain[g.domain] = (byDomain[g.domain] ?? 0) + 1

  // Truth score: percentage of files that are REAL
  const realFiles = scan.byClassification.REAL
  const totalFiles = scan.totalFiles
  const truthScore = totalFiles > 0 ? Math.round((realFiles / totalFiles) * 100) : 0

  // Executive summary
  const criticalGaps = gaps.filter((g) => g.severity === 'CRITICAL')
  const highGaps = gaps.filter((g) => g.severity === 'HIGH')
  const topDomains = Object.entries(byDomain)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([d, c]) => `${d}(${c})`)

  const executiveSummary = [
    `Truth Score: ${truthScore}% (${realFiles}/${totalFiles} files are REAL)`,
    `Gaps: ${gaps.length} total — ${bySeverity.CRITICAL} CRITICAL, ${bySeverity.HIGH} HIGH, ${bySeverity.MEDIUM} MEDIUM, ${bySeverity.LOW} LOW`,
    `Top gap domains: ${topDomains.join(', ')}`,
    criticalGaps.length > 0 ? `BLOCKERS: ${criticalGaps.map((g) => g.summary).join('; ')}` : 'No critical blockers',
  ].join('\n')

  return {
    timestamp: new Date().toISOString(),
    totalGaps: gaps.length,
    bySeverity,
    byType,
    byDomain,
    gaps,
    truthScore,
    executiveSummary,
  }
}
