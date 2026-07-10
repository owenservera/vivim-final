// devops/roadmap/research.ts
// Research Engine — per-unit research grounded in truth system + atomic list.
//
// For each pending/in_progress unit:
//   1. Read atomic spec
//   2. Check if target file exists in vivim-final
//   3. Classify: DONE / PORT / CREATE / FIX
//   4. Identify gaps (methods missing, stubs, etc.)
//   5. Estimate effort (S/M/L/XL)

import { readFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { parseUnits, type Unit, type UnitState } from '../tracker.ts'
import { scanRoot, type ScanResult, type FileReport } from '../truth/scanner.ts'

const PROJECT_ROOT = join(import.meta.dir, '..', '..')
const TRACKER_PATH = join(PROJECT_ROOT, 'docs', 'atomic', '01-tracker.md')
const ATOMIC_DIR = join(PROJECT_ROOT, 'docs', 'atomic')
// Source of truth is vivim-final itself (PROJECT_ROOT). cap-store is prior-art reference only.

// ── Types ─────────────────────────────────────────────────────────────────

export type UnitClassification = 'DONE' | 'PORT' | 'CREATE' | 'FIX'

export interface UnitResearch {
  id: string
  name: string
  phase: number
  phaseName: string
  state: UnitState
  file?: string
  classification: UnitClassification
  fileReport?: FileReport
  vivimRef?: string
  vivimLines?: number
  gaps: string[]
  effort: 'S' | 'M' | 'L' | 'XL'
  vivimApi?: string
  skip?: string
  notes: string
}

// ── Tracker parsing ───────────────────────────────────────────────────────

async function loadTracker(): Promise<Unit[]> {
  const content = await readFile(TRACKER_PATH, 'utf8')
  return parseUnits(content.split('\n'))
}

// ── Atomic spec reading ───────────────────────────────────────────────────

async function readAtomicSpec(unitId: string): Promise<string | null> {
  const entries = await readdir(ATOMIC_DIR, { withFileTypes: true })
  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith('phase-')) continue
    const phaseDir = join(ATOMIC_DIR, entry.name)
    const files = await readdir(phaseDir)
    for (const file of files) {
      if (!file.endsWith('.md')) continue
      const content = await readFile(join(phaseDir, file), 'utf8')
      const match = /#\s+Unit\s+(\d+\.\d+)/.exec(content)
      if (match && match[1] === unitId) {
        return content
      }
    }
  }
  return null
}

// ── Vivim-final source reference ──────────────────────────────────────────

async function findVivimRef(fileName: string): Promise<{ path: string; lines: number } | null> {
  try {
    const filePath = join(PROJECT_ROOT, fileName)
    const content = await readFile(filePath, 'utf8')
    return { path: fileName, lines: content.split('\n').length }
  } catch {
    return null
  }
}

// ── File existence check ──────────────────────────────────────────────────

async function findFileInProject(fileName: string, scan: ScanResult): Promise<FileReport | undefined> {
  // Try exact match first
  const exact = scan.files.find(f => f.relativePath.endsWith(fileName))
  if (exact) return exact

  // Try with src/ prefix
  const withPrefix = scan.files.find(f => f.relativePath === `src/${fileName}`)
  if (withPrefix) return withPrefix

  // Try executor directory
  const executorPath = `src/executor/${fileName}`
  const executor = scan.files.find(f => f.relativePath === executorPath)
  if (executor) return executor

  return undefined
}

// ── Classification logic ──────────────────────────────────────────────────

function classifyUnit(
  unit: Unit,
  fileReport: FileReport | undefined,
  vivimRef: { path: string; lines: number } | null,
  spec: string | null,
): UnitClassification {
  // If file exists and is REAL → DONE
  if (fileReport?.classification === 'REAL') {
    return 'DONE'
  }

  // If file exists but is STUB/MIXED → FIX
  if (fileReport && (fileReport.classification === 'STUB' || fileReport.classification === 'MIXED')) {
    return 'FIX'
  }

  // If vivim-final source reference exists → PORT
  if (vivimRef) {
    return 'PORT'
  }

  // Otherwise → CREATE
  return 'CREATE'
}

// ── Gap extraction ────────────────────────────────────────────────────────

function extractGaps(
  fileReport: FileReport | undefined,
  spec: string | null,
  classification: UnitClassification,
): string[] {
  const gaps: string[] = []

  if (classification === 'FIX' && fileReport) {
    // Extract stub markers
    for (const marker of fileReport.stubMarkers) {
      gaps.push(`Stub: ${marker}`)
    }
  }

  if (classification === 'PORT' && spec) {
    // Extract methods from spec that need porting
    const methodMatches = spec.matchAll(/(?:async\s+)?(\w+)\s*\([^)]*\)\s*[:{]/g)
    for (const match of methodMatches) {
      gaps.push(`Port method: ${match[1]}`)
    }
  }

  if (classification === 'CREATE' && spec) {
    // Extract interface from spec
    const interfaceMatch = spec.match(/```typescript\s*\ninterface\s+(\w+)/)
    if (interfaceMatch) {
      gaps.push(`Create interface: ${interfaceMatch[1]}`)
    }

    // Extract class from spec
    const classMatch = spec.match(/```typescript\s*\nexport\s+class\s+(\w+)/)
    if (classMatch) {
      gaps.push(`Create class: ${classMatch[1]}`)
    }
  }

  return gaps
}

// ── Effort estimation ─────────────────────────────────────────────────────

function estimateEffort(
  classification: UnitClassification,
  fileReport: FileReport | undefined,
  vivimRef: { path: string; lines: number } | null,
  gaps: string[],
): 'S' | 'M' | 'L' | 'XL' {
  switch (classification) {
    case 'DONE':
      return 'S' // Already done, just verify
    case 'FIX':
      // Based on number of stub markers
      if (gaps.length <= 2) return 'S'
      if (gaps.length <= 5) return 'M'
      return 'L'
    case 'PORT':
      // Based on vivim-final file size
      if (vivimRef && vivimRef.lines <= 100) return 'S'
      if (vivimRef && vivimRef.lines <= 300) return 'M'
      if (vivimRef && vivimRef.lines <= 600) return 'L'
      return 'XL'
    case 'CREATE':
      // Based on spec complexity
      if (gaps.length <= 3) return 'M'
      if (gaps.length <= 6) return 'L'
      return 'XL'
    default:
      return 'M'
  }
}

// ── Vivim API detection ───────────────────────────────────────────────────

function detectVivimApi(spec: string | null, fileReport: FileReport | undefined): string | undefined {
  if (spec?.includes('BunCdpClient')) return 'BunCdpClient.send()'
  if (spec?.includes('PrismaClient')) return 'PrismaClient'
  if (fileReport?.imports.some(i => i.includes('cdp'))) return 'BunCdpClient.send()'
  if (fileReport?.imports.some(i => i.includes('prisma'))) return 'PrismaClient'
  return undefined
}

// ── Skip detection ────────────────────────────────────────────────────────

function detectSkip(spec: string | null): string | undefined {
  if (spec?.includes('cookie')) return 'Cookie migration (prior-art-specific)'
  if (spec?.includes('singleton')) return 'Singleton lock (prior-art-specific)'
  if (spec?.includes('armSlaveRead')) return 'armSlaveRead (prior-art-specific)'
  return undefined
}

// ── Main research function ────────────────────────────────────────────────

export async function researchUnit(unitId: string, scan?: ScanResult): Promise<UnitResearch> {
  const units = await loadTracker()
  const unit = units.find(u => u.id === unitId)
  if (!unit) {
    throw new Error(`Unit ${unitId} not found in tracker`)
  }

  const resolvedScan = scan ?? await scanRoot(PROJECT_ROOT)
  const spec = await readAtomicSpec(unitId)
  const fileReport = unit.file ? await findFileInProject(unit.file, resolvedScan) : undefined
  const vivimRef = unit.file ? await findVivimRef(unit.file) : null

  const classification = classifyUnit(unit, fileReport, vivimRef, spec)
  const gaps = extractGaps(fileReport, spec, classification)
  const effort = estimateEffort(classification, fileReport, vivimRef, gaps)
  const vivimApi = detectVivimApi(spec, fileReport)
  const skip = detectSkip(spec)

  return {
    id: unit.id,
    name: unit.name,
    phase: unit.phase,
    phaseName: unit.phaseName,
    state: unit.state,
    file: unit.file,
    classification,
    fileReport,
    vivimRef: vivimRef?.path,
    vivimLines: vivimRef?.lines,
    gaps,
    effort,
    vivimApi,
    skip,
    notes: '',
  }
}

// ── Research all units ────────────────────────────────────────────────────

export async function runResearch(): Promise<UnitResearch[]> {
  const units = await loadTracker()
  const scan = await scanRoot(PROJECT_ROOT)
  const results: UnitResearch[] = []

  for (const unit of units) {
    if (unit.state === 'done') {
      // Skip done units, just record them
      results.push({
        id: unit.id,
        name: unit.name,
        phase: unit.phase,
        phaseName: unit.phaseName,
        state: unit.state,
        file: unit.file,
        classification: 'DONE',
        gaps: [],
        effort: 'S',
        notes: 'Already completed',
      })
      continue
    }

    const research = await researchUnit(unit.id, scan)
    results.push(research)
  }

  return results
}

// ── Research by domain ────────────────────────────────────────────────────

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

export async function researchDomain(domain: string): Promise<UnitResearch[]> {
  const all = await runResearch()
  return all.filter(u => inferDomain(u.file) === domain)
}
