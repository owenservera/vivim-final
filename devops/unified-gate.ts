// devops/unified-gate.ts
// Single entry point for quality gates across SpecKit and DevOps.
// Orchestrates existing tools (typecheck, lint, tests, invariants, audit-code)
// without duplicating their logic. Supports scope-based check selection and
// SpecKit checklist validation.

import { spawn } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

// ── Types ────────────────────────────────────────────────────

export type GateScope = 'unit' | 'phase' | 'feature' | 'full'

export type GateCheck =
  | 'typecheck'
  | 'lint'
  | 'unit-test'
  | 'integration-test'
  | 'invariants'
  | 'audit-code'
  | 'audit-arch'
  | 'cross-surface'
  | 'speckit-checklists'

export interface GateConfig {
  scope: GateScope
  featureDir?: string
  unitId?: string
  speckit?: boolean
  devops?: boolean
  checks?: GateCheck[]
  json?: boolean
}

export interface CheckResult {
  name: string
  passed: boolean
  output: string
  duration: number
  command: string
}

export interface GateResult {
  passed: boolean
  checks: CheckResult[]
  duration: number
  summary: string
  scope: string
}

// ── Scope → Check Mapping ────────────────────────────────────

const SCOPE_CHECKS: Record<GateScope, GateCheck[]> = {
  unit: ['typecheck', 'lint', 'unit-test'],
  phase: ['typecheck', 'lint', 'unit-test', 'invariants', 'audit-code'],
  feature: [
    'typecheck',
    'lint',
    'unit-test',
    'invariants',
    'audit-code',
    'integration-test',
    'cross-surface',
  ],
  full: [
    'typecheck',
    'lint',
    'unit-test',
    'integration-test',
    'invariants',
    'audit-code',
    'audit-arch',
    'cross-surface',
  ],
}

// ── Command execution ────────────────────────────────────────

function execCommand(command: string, args: string[]): Promise<CheckResult> {
  const start = Date.now()
  return new Promise((resolve) => {
    const proc = spawn(command, args, {
      cwd: process.cwd(),
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    let stdout = ''
    let stderr = ''

    proc.stdout?.on('data', (data: Buffer) => {
      stdout += data.toString()
    })

    proc.stderr?.on('data', (data: Buffer) => {
      stderr += data.toString()
    })

    proc.on('close', (code) => {
      const duration = Date.now() - start
      const output = stdout + stderr
      resolve({
        name: args.join(' '),
        passed: code === 0,
        output,
        duration,
        command: `${command} ${args.join(' ')}`,
      })
    })

    proc.on('error', () => {
      resolve({
        name: args.join(' '),
        passed: false,
        output: `Failed to execute: ${command}`,
        duration: Date.now() - start,
        command: `${command} ${args.join(' ')}`,
      })
    })
  })
}

// ── Individual check runners ─────────────────────────────────

async function runTypeCheck(_config: GateConfig): Promise<CheckResult> {
  return execCommand('bun', ['run', 'typecheck'])
}

async function runLint(_config: GateConfig): Promise<CheckResult> {
  return execCommand('bun', ['run', 'lint'])
}

async function runUnitTest(_config: GateConfig): Promise<CheckResult> {
  return execCommand('bun', ['test', '--test-dir=tests/unit'])
}

async function runIntegrationTest(_config: GateConfig): Promise<CheckResult> {
  return execCommand('bun', ['test', 'tests/integration'])
}

async function runInvariants(_config: GateConfig): Promise<CheckResult> {
  return execCommand('bun', ['run', 'devops', 'invariants', 'check', '--category', 'B'])
}

async function runAuditCode(_config: GateConfig): Promise<CheckResult> {
  return execCommand('bun', ['run', 'devops', 'audit-code', 'standard', '--json'])
}

async function runAuditArch(_config: GateConfig): Promise<CheckResult> {
  return execCommand('bun', ['run', 'devops', 'audit-arch', 'standard'])
}

async function runCrossSurface(_config: GateConfig): Promise<CheckResult> {
  return execCommand('bun', ['run', 'devops', 'verify-cross-surface'])
}

async function runSpecKitChecklists(config: GateConfig): Promise<CheckResult> {
  const start = Date.now()

  if (!config.featureDir) {
    return {
      name: 'speckit-checklists',
      passed: false,
      output: 'No featureDir provided for SpecKit checklist check',
      duration: Date.now() - start,
      command: 'speckit-checklists (internal)',
    }
  }

  const checklistsPath = join(process.cwd(), config.featureDir, 'checklists', 'requirements.md')

  if (!existsSync(checklistsPath)) {
    // Checklists are optional per spec — warn but don't fail
    return {
      name: 'speckit-checklists',
      passed: true,
      output: 'No checklists found (optional)',
      duration: Date.now() - start,
      command: 'speckit-checklists (internal)',
    }
  }

  try {
    const content = await readFile(checklistsPath, 'utf8')
    const lines = content.split('\n')
    const incomplete: string[] = []

    for (const line of lines) {
      const match = line.match(/^- \[ \] (CHK\d+):?\s*(.*)$/)
      if (match) {
        incomplete.push(`${match[1]}: ${match[2]}`)
      }
    }

    const passed = incomplete.length === 0
    const output = passed
      ? 'All checklists complete'
      : `Incomplete checklists:\n${incomplete.map((c) => `  - ${c}`).join('\n')}`

    return {
      name: 'speckit-checklists',
      passed,
      output,
      duration: Date.now() - start,
      command: 'speckit-checklists (internal)',
    }
  } catch (e) {
    return {
      name: 'speckit-checklists',
      passed: false,
      output: `Error reading checklists: ${(e as Error).message}`,
      duration: Date.now() - start,
      command: 'speckit-checklists (internal)',
    }
  }
}

// ── Check dispatcher ─────────────────────────────────────────

const CHECK_RUNNERS: Record<GateCheck, (config: GateConfig) => Promise<CheckResult>> = {
  typecheck: runTypeCheck,
  lint: runLint,
  'unit-test': runUnitTest,
  'integration-test': runIntegrationTest,
  invariants: runInvariants,
  'audit-code': runAuditCode,
  'audit-arch': runAuditArch,
  'cross-surface': runCrossSurface,
  'speckit-checklists': runSpecKitChecklists,
}

// ── Main gate function ───────────────────────────────────────

export async function runUnifiedGate(config: GateConfig): Promise<GateResult> {
  const start = Date.now()

  // Determine which checks to run
  let checksToRun: GateCheck[]

  if (config.checks) {
    // Explicit checks provided
    checksToRun = config.checks
  } else {
    // Use scope-based defaults
    checksToRun = [...SCOPE_CHECKS[config.scope]]

    // Add SpecKit checklists if speckit mode is enabled
    if (config.speckit && !checksToRun.includes('speckit-checklists')) {
      checksToRun.push('speckit-checklists')
    }

    // Add devops checks if devops mode is enabled
    if (config.devops) {
      if (!checksToRun.includes('invariants')) {
        checksToRun.push('invariants')
      }
      if (!checksToRun.includes('audit-code')) {
        checksToRun.push('audit-code')
      }
    }
  }

  // Run all checks
  const results: CheckResult[] = []
  for (const check of checksToRun) {
    const runner = CHECK_RUNNERS[check]
    if (runner) {
      const result = await runner(config)
      results.push(result)
    }
  }

  const duration = Date.now() - start
  const passed = results.every((r) => r.passed)

  // Build summary
  const passedCount = results.filter((r) => r.passed).length
  const failedCount = results.length - passedCount
  const summary = passed
    ? `PASS (${passedCount}/${results.length} checks)`
    : `FAIL (${failedCount}/${results.length} checks failed)`

  return {
    passed,
    checks: results,
    duration,
    summary,
    scope: config.scope,
  }
}
