// devops/invariants.ts
// Invariant Checker — enforces architectural boundary conditions.
//
// Categories:
//   A: Ground Truth (hard block) — research-first workflow
//   B: Architectural (hard block) — architecture boundaries
//   C: Planning (hard block) — roadmap adherence
//   D: Quality (soft warning) — code quality standards
//
// Usage:
//   bun run devops invariants check              # check all
//   bun run devops invariants check --unit 11.5  # check for specific unit
//   bun run devops invariants check --category B # check category only
//   bun run devops invariants report             # compliance report

import { readFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { parseUnits, type Unit } from './tracker.ts'
import { loadDeps } from './deps.ts'

const PROJECT_ROOT = join(import.meta.dir, '..')
const TRACKER_PATH = join(PROJECT_ROOT, 'docs', 'atomic-v3-fork-canon', '01-tracker.md')
const ATOMIC_DIR = join(PROJECT_ROOT, 'docs', 'atomic-v3-fork-canon')
const RESEARCH_REPORT_PATH = join(PROJECT_ROOT, 'docs', 'roadmap', 'RESEARCH-REPORT.md')
const TRUTH_GAPS_PATH = join(PROJECT_ROOT, 'docs', 'roadmap', 'TRUTH-GAPS.md')
const ENGINES_DIR = join(PROJECT_ROOT, 'src', 'engines')
const INDEX_PATH = join(PROJECT_ROOT, 'src', 'index.ts')

// ── Types ─────────────────────────────────────────────────────────────────

export type InvariantCategory = 'A' | 'B' | 'C' | 'D' | 'E'

export interface Violation {
  id: string
  category: InvariantCategory
  severity: 'block' | 'warning'
  message: string
  file?: string
  line?: number
}

export interface InvariantResult {
  pass: boolean
  violations: Violation[]
  warnings: Violation[]
  checked: string[]
  unit?: string
}

// ── Helpers ───────────────────────────────────────────────────────────────

async function fileExists(path: string): Promise<boolean> {
  try {
    await readFile(path, 'utf8')
    return true
  } catch {
    return false
  }
}

async function readFileLines(path: string): Promise<string[]> {
  const content = await readFile(path, 'utf8')
  return content.split('\n')
}

async function scanDirForPattern(
  dir: string,
  pattern: RegExp,
  exclude?: string,
): Promise<{ file: string; line: number; match: string }[]> {
  const results: { file: string; line: number; match: string }[] = []
  let entries: import('node:fs').Dirent[]
  try {
    entries = await readdir(dir, { withFileTypes: true })
  } catch {
    return results
  }
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.ts')) continue
    if (exclude && entry.name === exclude) continue
    const filePath = join(dir, entry.name)
    const lines = await readFileLines(filePath)
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!
      // Skip comments
      if (line.trimStart().startsWith('//')) continue
      const match = pattern.exec(line)
      if (match) {
        results.push({ file: `src/engines/${entry.name}`, line: i + 1, match: match[0] })
      }
    }
  }
  return results
}

// ── Category A: Ground Truth ──────────────────────────────────────────────

async function checkA1_ReportRequired(unitId: string): Promise<Violation[]> {
  const violations: Violation[] = []
  if (!(await fileExists(RESEARCH_REPORT_PATH))) {
    violations.push({
      id: 'A1',
      category: 'A',
      severity: 'block',
      message: `No RESEARCH-REPORT.md found. Run 'bun run devops roadmap' first.`,
    })
    return violations
  }
  const content = await readFile(RESEARCH_REPORT_PATH, 'utf8')
  if (!content.includes(unitId)) {
    violations.push({
      id: 'A1',
      category: 'A',
      severity: 'block',
      message: `Unit ${unitId} not found in RESEARCH-REPORT.md. Run research first.`,
    })
  }
  return violations
}

async function checkA2_Classification(unitId: string): Promise<Violation[]> {
  const violations: Violation[] = []
  if (!(await fileExists(RESEARCH_REPORT_PATH))) return violations
  const content = await readFile(RESEARCH_REPORT_PATH, 'utf8')
  // Find the unit's section and check for classification
  const unitSection = content.split(/### \d+\.\d+/).find(s => s.includes(unitId))
  if (unitSection && !unitSection.includes('classification:')) {
    violations.push({
      id: 'A2',
      category: 'A',
      severity: 'block',
      message: `Unit ${unitId} in RESEARCH-REPORT.md has no classification field.`,
    })
  }
  return violations
}

async function checkA3_CapStoreRef(unitId: string, units: Unit[]): Promise<Violation[]> {
  const violations: Violation[] = []
  if (!(await fileExists(RESEARCH_REPORT_PATH))) return violations
  const content = await readFile(RESEARCH_REPORT_PATH, 'utf8')
  const unitSection = content.split(/### \d+\.\d+/).find(s => s.includes(unitId))
  if (unitSection && unitSection.includes('classification: PORT')) {
    if (!unitSection.includes('vivimRef:') || !unitSection.includes('vivimLines:')) {
      violations.push({
        id: 'A3',
        category: 'A',
        severity: 'block',
        message: `Unit ${unitId} is PORT but has no vivimRef/vivimLines in research report.`,
      })
    }
  }
  return violations
}

async function checkA4_TruthScore(domain: string): Promise<Violation[]> {
  const violations: Violation[] = []
  if (!(await fileExists(TRUTH_GAPS_PATH))) return violations
  const content = await readFile(TRUTH_GAPS_PATH, 'utf8')
  // Extract truth score from header
  const scoreMatch = content.match(/Truth Score:\s*(\d+)%/)
  if (scoreMatch) {
    const score = Number(scoreMatch[1]) / 100
    if (score < 0.8) {
      violations.push({
        id: 'A4',
        category: 'A',
        severity: 'block',
        message: `Truth score ${Math.round(score * 100)}% < 80% threshold. Run truth verification first.`,
      })
    }
  }
  return violations
}

// ── Category B: Architectural ─────────────────────────────────────────────

async function checkB1_GovernorCanon(): Promise<Violation[]> {
  const violations: Violation[] = []
  // Flag any CDP *transport* import inside an engine (BunCdpClient, executor/cdp,
  // cdp-transport, etc.). The `cdp-discovery` module is a pure protocol *descriptor*
  // (static catalog + parser, no socket) supplied so an injected executor supplied by
  // ChromeGovernor can drive commands — it is Governor-Canon-safe and explicitly
  // exempt via the negative lookahead. The pattern still fails safe: any other cdp
  // module import is caught.
  const matches = await scanDirForPattern(
    ENGINES_DIR,
    /BunCdpClient|from\s+['"][^'"]*cdp(?!-discovery)[^'"]*['"]/,
    'chrome-governor.ts',
  )
  for (const m of matches) {
    violations.push({
      id: 'B1',
      category: 'B',
      severity: 'block',
      message: `Engine imports CDP directly: ${m.match}`,
      file: m.file,
      line: m.line,
    })
  }
  return violations
}

async function checkB2_StoreContractIsolation(): Promise<Violation[]> {
  const violations: Violation[] = []
  const matches = await scanDirForPattern(
    ENGINES_DIR,
    /storage\/impl|from.*['"]\.\.\/storage\/impl/,
  )
  for (const m of matches) {
    violations.push({
      id: 'B2',
      category: 'B',
      severity: 'block',
      message: `Engine imports concrete store implementation: ${m.match}`,
      file: m.file,
      line: m.line,
    })
  }
  return violations
}

async function checkB3_SeedsNotCode(): Promise<Violation[]> {
  const violations: Violation[] = []
  const matches = await scanDirForPattern(
    ENGINES_DIR,
    /DEFAULT_PROVIDER_CONFIGS|provider-config/,
  )
  for (const m of matches) {
    violations.push({
      id: 'B3',
      category: 'B',
      severity: 'block',
      message: `Engine has hardcoded provider config: ${m.match}`,
      file: m.file,
      line: m.line,
    })
  }
  return violations
}

async function checkB5_ConfigAuthority(): Promise<Violation[]> {
  const violations: Violation[] = []
  const matches = await scanDirForPattern(
    ENGINES_DIR,
    /process\.env|readFile.*config/,
    'config-manager.ts',
  )
  for (const m of matches) {
    violations.push({
      id: 'B5',
      category: 'B',
      severity: 'block',
      message: `Engine reads config directly instead of ConfigManager: ${m.match}`,
      file: m.file,
      line: m.line,
    })
  }
  return violations
}

async function checkB6_ServerSideHarness(): Promise<Violation[]> {
  const violations: Violation[] = []
  const harnessPath = join(ENGINES_DIR, 'harness-runtime.ts')
  if (await fileExists(harnessPath)) {
    const lines = await readFileLines(harnessPath)
    for (let i = 0; i < lines.length; i++) {
      if (lines[i]!.includes('addScriptToEvaluateOnNewDocument')) {
        violations.push({
          id: 'B6',
          category: 'B',
          severity: 'block',
          message: 'HarnessRuntime injects script into Chrome (should be server-side only)',
          file: 'src/engines/harness-runtime.ts',
          line: i + 1,
        })
      }
    }
  }
  return violations
}

async function checkB7_ErrorClasses(): Promise<Violation[]> {
  const violations: Violation[] = []
  const matches = await scanDirForPattern(ENGINES_DIR, /new Error\(/)
  for (const m of matches) {
    violations.push({
      id: 'B7',
      category: 'B',
      severity: 'block',
      message: `Engine uses raw 'new Error()' instead of custom error class: ${m.match}`,
      file: m.file,
      line: m.line,
    })
  }
  return violations
}

async function checkB8_AgentAddressableUIActions(): Promise<Violation[]> {
  const violations: Violation[] = []
  const wsPath = join(PROJECT_ROOT, 'src', 'server', 'websocket.ts')

  // Check registry.ts exists
  const registryPath = join(PROJECT_ROOT, 'web', 'ui', 'src', 'actions', 'registry.ts')
  if (!(await fileExists(registryPath))) {
    violations.push({
      id: 'B8',
      category: 'B',
      severity: 'block',
      message: '`web/ui/src/actions/registry.ts` not found. ActionRegistry required for agent-addressable UI.',
      file: registryPath,
    })
  }

  // Check agent-bridge.ts exists
  const bridgePath = join(PROJECT_ROOT, 'web', 'ui', 'src', 'actions', 'agent-bridge.ts')
  if (!(await fileExists(bridgePath))) {
    violations.push({
      id: 'B8',
      category: 'B',
      severity: 'block',
      message: '`web/ui/src/actions/agent-bridge.ts` not found. AgentBridge required for agent command transport.',
      file: bridgePath,
    })
  }

  // Check websocket.ts handles agent:command and agent:discover
  if (await fileExists(wsPath)) {
    const wsContent = await readFile(wsPath, 'utf8')
    if (!wsContent.includes("'agent:command'") && !wsContent.includes('"agent:command"')) {
      violations.push({
        id: 'B8',
        category: 'B',
        severity: 'block',
        message: '`src/server/websocket.ts` missing `agent:command` message handling.',
        file: wsPath,
      })
    }
    if (!wsContent.includes("'agent:discover'") && !wsContent.includes('"agent:discover"')) {
      violations.push({
        id: 'B8',
        category: 'B',
        severity: 'block',
        message: '`src/server/websocket.ts` missing `agent:discover` message handling.',
        file: wsPath,
      })
    }
  }

  return violations
}

// ── Category C: Planning ──────────────────────────────────────────────────

async function checkC1_PhaseGate(unitId: string, units: Unit[]): Promise<Violation[]> {
  const violations: Violation[] = []
  const unit = units.find(u => u.id === unitId)
  if (!unit) return violations

  const prevPhaseUnits = units.filter(u => u.phase === unit.phase - 1)
  const incomplete = prevPhaseUnits.filter(u => u.state !== 'done')
  if (incomplete.length > 0) {
    violations.push({
      id: 'C1',
      category: 'C',
      severity: 'block',
      message: `Phase ${unit.phase - 1} has ${incomplete.length} incomplete units: ${incomplete.map(u => u.id).join(', ')}`,
    })
  }
  return violations
}

async function checkC2_DependencyGate(
  unitId: string,
  units: Unit[],
  deps: Map<string, string[]>,
): Promise<Violation[]> {
  const violations: Violation[] = []
  const unitDeps = deps.get(unitId) ?? []
  for (const dep of unitDeps) {
    const depUnit = units.find(u => u.id === dep)
    if (depUnit && depUnit.state !== 'done') {
      violations.push({
        id: 'C2',
        category: 'C',
        severity: 'block',
        message: `Dependency ${dep} is not done (state: ${depUnit.state})`,
      })
    }
  }
  return violations
}

async function checkC3_AtomicSpecRequired(unitId: string): Promise<Violation[]> {
  const violations: Violation[] = []
  let entries: import('node:fs').Dirent[]
  try {
    entries = await readdir(ATOMIC_DIR, { withFileTypes: true })
  } catch {
    violations.push({
      id: 'C3',
      category: 'C',
      severity: 'block',
      message: 'No atomic spec directory found.',
    })
    return violations
  }
  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith('phase-')) continue
    const phaseDir = join(ATOMIC_DIR, entry.name)
    const files = await readdir(phaseDir)
    for (const file of files) {
      if (!file.endsWith('.md')) continue
      const content = await readFile(join(phaseDir, file), 'utf8')
      if (content.includes(`# Unit ${unitId}`)) {
        return violations
      }
    }
  }
  violations.push({
    id: 'C3',
    category: 'C',
    severity: 'block',
    message: `No atomic spec found for unit ${unitId}.`,
  })
  return violations
}

async function checkC4_DesignDocReference(unitId: string): Promise<Violation[]> {
  const violations: Violation[] = []
  let entries: import('node:fs').Dirent[]
  try {
    entries = await readdir(ATOMIC_DIR, { withFileTypes: true })
  } catch {
    return violations
  }
  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith('phase-')) continue
    const phaseDir = join(ATOMIC_DIR, entry.name)
    const files = await readdir(phaseDir)
    for (const file of files) {
      if (!file.endsWith('.md')) continue
      const content = await readFile(join(phaseDir, file), 'utf8')
      if (content.includes(`# Unit ${unitId}`)) {
        if (!content.includes('**Source:**') && !content.includes('**Design Doc:**')) {
          violations.push({
            id: 'C4',
            category: 'C',
            severity: 'block',
            message: `Atomic spec for ${unitId} has no Source or Design Doc reference.`,
          })
        }
        return violations
      }
    }
  }
  return violations
}

// ── Category D: Quality ───────────────────────────────────────────────────

async function checkD1_EngineTests(): Promise<Violation[]> {
  const violations: Violation[] = []
  const engines = await readdir(ENGINES_DIR)
  for (const engine of engines) {
    if (!engine.endsWith('.ts') || engine === 'index.ts') continue
    const testFile = engine.replace('.ts', '.test.ts')
    const testPath = join(PROJECT_ROOT, 'tests', 'unit', 'engines', testFile)
    if (!(await fileExists(testPath))) {
      violations.push({
        id: 'D1',
        category: 'D',
        severity: 'warning',
        message: `No unit test for engine: ${engine}`,
        file: `tests/unit/engines/${testFile}`,
      })
    }
  }
  return violations
}

async function checkD2_TypeSafety(): Promise<Violation[]> {
  const violations: Violation[] = []
  const matches = await scanDirForPattern(ENGINES_DIR, /:\s*any\b|as\s+any\b/)
  for (const m of matches) {
    violations.push({
      id: 'D2',
      category: 'D',
      severity: 'warning',
      message: `Engine uses 'any' type: ${m.match}`,
      file: m.file,
      line: m.line,
    })
  }
  return violations
}

async function checkD4_BarrelExport(): Promise<Violation[]> {
  const violations: Violation[] = []
  if (!(await fileExists(INDEX_PATH))) return violations
  const indexContent = await readFile(INDEX_PATH, 'utf8')
  const engines = await readdir(ENGINES_DIR)
  for (const engine of engines) {
    if (!engine.endsWith('.ts') || engine === 'index.ts') continue
    // Extract class name from file
    const content = await readFile(join(ENGINES_DIR, engine), 'utf8')
    const classMatch = content.match(/export\s+class\s+(\w+)/)
    const className = classMatch?.[1]
    if (className && !indexContent.includes(className)) {
      violations.push({
        id: 'D4',
        category: 'D',
        severity: 'warning',
        message: `Engine class ${className} not exported from src/index.ts`,
        file: 'src/index.ts',
      })
    }
  }
  return violations
}

// ── Category E: Goals ─────────────────────────────────────────────────────────

async function checkE5_IntegrationTestParity(unitId?: string): Promise<Violation[]> {
  const violations: Violation[] = []

  // Check for units in Phase 11 (executor) and Phase 13 (sandbox) that need integration tests
  if (!unitId) return violations

  const unitNum = Number(unitId.split('.')[0])
  if (unitNum < 11 || unitNum > 13) return violations

  // Check if integration tests exist for executor units
  const executorTestsDir = join(PROJECT_ROOT, 'tests', 'integration', 'executor')
  const capabilityTestsDir = join(PROJECT_ROOT, 'tests', 'integration', 'capabilities')

  const hasExecutorTests = (await readdir(executorTestsDir).catch(() => [] as any)).length > 0
  const hasCapabilityTests = (await readdir(capabilityTestsDir).catch(() => [] as any)).length > 0

  if (unitId === '11.5' && !hasExecutorTests) {
    violations.push({
      id: 'E5',
      category: 'E',
      severity: 'warning',
      message: `Executor unit ${unitId} requires integration tests in tests/integration/executor/`,
    })
  }

  if (unitId.startsWith('11.') && !hasExecutorTests) {
    violations.push({
      id: 'E5',
      category: 'E',
      severity: 'warning',
      message: `Executor unit ${unitId} requires integration tests in tests/integration/executor/`,
    })
  }

  if (unitId.startsWith('13.') && !hasCapabilityTests) {
    // For sandbox units, integration tests are in tests/integration/capabilities/ or tests/integration/sandbox/
    const sandboxTestsDir = join(PROJECT_ROOT, 'tests', 'integration', 'sandbox')
    const hasSandboxTests = (await readdir(sandboxTestsDir).catch(() => [] as any)).length > 0
    if (!hasSandboxTests) {
      violations.push({
        id: 'E5',
        category: 'E',
        severity: 'warning',
        message: `Sandbox unit ${unitId} requires integration tests in tests/integration/sandbox/`,
      })
    }
  }

  return violations
}

// ── Main API ──────────────────────────────────────────────────────────────

export async function checkInvariants(
  unitId?: string,
  category?: InvariantCategory,
): Promise<InvariantResult> {
  const allViolations: Violation[] = []
  const checked: string[] = []

  // Load tracker
  const trackerLines = await readFileLines(TRACKER_PATH)
  const units = parseUnits(trackerLines)
  const deps = await loadDeps(ATOMIC_DIR)

  // Category A: Ground Truth
  if (!category || category === 'A') {
    if (unitId) {
      checked.push('A1', 'A2', 'A3')
      allViolations.push(...await checkA1_ReportRequired(unitId))
      allViolations.push(...await checkA2_Classification(unitId))
      allViolations.push(...await checkA3_CapStoreRef(unitId, units))
    }
    checked.push('A4')
    allViolations.push(...await checkA4_TruthScore('general'))
  }

  // Category B: Architectural
  if (!category || category === 'B') {
    checked.push('B1', 'B2', 'B3', 'B5', 'B6', 'B7', 'B8')
    allViolations.push(...await checkB1_GovernorCanon())
    allViolations.push(...await checkB2_StoreContractIsolation())
    allViolations.push(...await checkB3_SeedsNotCode())
    allViolations.push(...await checkB5_ConfigAuthority())
    allViolations.push(...await checkB6_ServerSideHarness())
    allViolations.push(...await checkB7_ErrorClasses())
    allViolations.push(...await checkB8_AgentAddressableUIActions())
  }

  // Category C: Planning
  if (!category || category === 'C') {
    if (unitId) {
      checked.push('C1', 'C2', 'C3', 'C4')
      allViolations.push(...await checkC1_PhaseGate(unitId, units))
      allViolations.push(...await checkC2_DependencyGate(unitId, units, deps))
      allViolations.push(...await checkC3_AtomicSpecRequired(unitId))
      allViolations.push(...await checkC4_DesignDocReference(unitId))
    }
  }

// Category D: Quality
  if (!category || category === 'D') {
    checked.push('D1', 'D2', 'D4')
    allViolations.push(...await checkD1_EngineTests())
    allViolations.push(...await checkD2_TypeSafety())
    allViolations.push(...await checkD4_BarrelExport())
  }

  // Category E: Goals
  if (!category || (category === 'E' as InvariantCategory)) {
    checked.push('E5')
    allViolations.push(...await checkE5_IntegrationTestParity(unitId))
  }

  const blockViolations = allViolations.filter(v => v.severity === 'block')
  const warnings = allViolations.filter(v => v.severity === 'warning')

  return {
    pass: blockViolations.length === 0,
    violations: blockViolations,
    warnings,
    checked,
    unit: unitId,
  }
}

// ── Report ────────────────────────────────────────────────────────────────

export async function generateInvariantReport(): Promise<string> {
  const result = await checkInvariants()
  const lines: string[] = [
    '# Invariant Compliance Report',
    '',
    `**Generated:** ${new Date().toISOString()}`,
    `**Status:** ${result.pass ? 'PASS' : 'FAIL'}`,
    `**Checked:** ${result.checked.join(', ')}`,
    '',
    '---',
    '',
  ]

  if (result.violations.length > 0) {
    lines.push('## Hard Blocks')
    lines.push('')
    for (const v of result.violations) {
      const loc = v.file ? ` (${v.file}:${v.line})` : ''
      lines.push(`- **${v.id}:** ${v.message}${loc}`)
    }
    lines.push('')
  }

  if (result.warnings.length > 0) {
    lines.push('## Warnings')
    lines.push('')
    for (const w of result.warnings) {
      const loc = w.file ? ` (${w.file}:${w.line})` : ''
      lines.push(`- **${w.id}:** ${w.message}${loc}`)
    }
    lines.push('')
  }

  if (result.violations.length === 0 && result.warnings.length === 0) {
    lines.push('All invariants pass. No violations found.')
    lines.push('')
  }

  return lines.join('\n')
}
