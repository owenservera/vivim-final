// devops/baseline.ts
// Regression-scoped gate support.
//
// The autonomous loop must be able to mark a unit `done` even when the repo
// carries PRE-EXISTING quality debt (lint/typecheck/test/audit/invariant). A
// naive repo-wide gate therefore blocks every unit forever.
//
// Instead we capture a BASELINE of findings at the start of a run, then only
// FAIL on findings introduced *after* that baseline (new regressions). The
// baseline is a known-good-or-known-debt snapshot the loop tolerates.
//
// Fingerprint strategy (coarse but stable across line shifts):
//   lint      -> "<file>:<category>"          (one entry per file+category)
//   typecheck -> raw tsc error line           (file + code + message)
//   tests     -> failing test name
//   audit     -> vulnerability COUNT delta
//   invariants-> violation key (id or title)

import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { checkInvariants } from './invariants.ts'

const BASELINE_PATH = join(process.cwd(), 'devops', '.gate-baseline.json')

export interface GateBaseline {
  capturedAt: string
  commit: string
  lint: string[]
  typecheck: string[]
  tests: string[]
  auditVulns: number
  invariantViolations: string[]
}

export function baselinePath(): string {
  return BASELINE_PATH
}

export function hasBaseline(): boolean {
  return existsSync(BASELINE_PATH)
}

// Capture a baseline only if one does not already exist. Used by the
// autonomous loop so it never silently overwrites a known-good reference.
export async function ensureBaseline(): Promise<GateBaseline> {
  if (hasBaseline()) return loadBaseline()!
  return captureBaseline()
}

export function loadBaseline(): GateBaseline | null {
  if (!existsSync(BASELINE_PATH)) return null
  try {
    return JSON.parse(readFileSync(BASELINE_PATH, 'utf8')) as GateBaseline
  } catch {
    return null
  }
}

function gitCommit(): string {
  try {
    return spawnSync('git', ['rev-parse', '--short', 'HEAD'], { encoding: 'utf8' }).stdout.trim()
  } catch {
    return 'unknown'
  }
}

// Run a command and return combined stdout+stderr.
function runCapture(cmd: string, args: string[]): string {
  const res = spawnSync(cmd, args, { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 })
  return `${res.stdout ?? ''}\n${res.stderr ?? ''}`
}

export function lintFingerprints(): string[] {
  const res = spawnSync(
    'bun',
    ['x', '@biomejs/biome', 'check', '--reporter=json', 'src', 'tests', 'seeds'],
    {
      encoding: 'utf8',
      maxBuffer: 32 * 1024 * 1024,
    },
  )
  const json = res.stdout ?? ''
  const start = json.indexOf('{')
  if (start === -1) return []
  try {
    const parsed = JSON.parse(json.slice(start)) as {
      diagnostics?: Array<{ category?: string; location?: { path?: { file?: string } } }>
    }
    const out = new Set<string>()
    for (const d of parsed.diagnostics ?? []) {
      const file = d.location?.path?.file
      if (file && d.category) out.add(`${file}:${d.category}`)
    }
    return [...out]
  } catch {
    return []
  }
}

function typecheckLines(): string[] {
  const out = runCapture('bun', ['x', 'tsc', '--noEmit'])
  return out
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => /\.ts\(\d+,\d+\):\s*error TS\d+/.test(l))
}

function failingTestNames(): string[] {
  const out = runCapture('bun', ['test', '--test-dir=tests/unit'])
  const names = new Set<string>()
  for (const line of out.split('\n')) {
    const m = line.match(/(?:✗|✕|fail\))\s*(.+?)\s*(?:\[[\d.]+m?s\])?\s*$/)
    if (m) names.add(m[1]!.trim())
  }
  return [...names]
}

function auditVulnCount(): number {
  const out = runCapture('bun', ['audit'])
  const m = out.match(/(\d+)\s+vulnerabilit(y|ies)/i)
  return m ? Number(m[1]) : 0
}

async function invariantViolationKeys(): Promise<string[]> {
  try {
    const res = await checkInvariants()
    return res.violations.map((v) => v.id ?? v.message ?? JSON.stringify(v))
  } catch {
    return []
  }
}

export async function captureBaseline(): Promise<GateBaseline> {
  const invariantViolations = await invariantViolationKeys()
  const baseline: GateBaseline = {
    capturedAt: new Date().toISOString(),
    commit: gitCommit(),
    lint: lintFingerprints(),
    typecheck: typecheckLines(),
    tests: failingTestNames(),
    auditVulns: auditVulnCount(),
    invariantViolations,
  }
  writeFileSync(BASELINE_PATH, JSON.stringify(baseline, null, 2), 'utf8')
  return baseline
}

export interface BaselineDiff {
  newLint: string[]
  newTypecheck: string[]
  newTests: string[]
  newVulns: number
  newInvariants: string[]
  hasNew: boolean
}

export function diffBaseline(current: Omit<GateBaseline, 'capturedAt' | 'commit'>): BaselineDiff {
  const base = loadBaseline()
  if (!base) {
    // No baseline: treat everything as new (strict).
    const newLint = current.lint
    const newTypecheck = current.typecheck
    const newTests = current.tests
    const newVulns = current.auditVulns
    const newInvariants = current.invariantViolations
    return {
      newLint,
      newTypecheck,
      newTests,
      newVulns,
      newInvariants,
      hasNew:
        newLint.length > 0 ||
        newTypecheck.length > 0 ||
        newTests.length > 0 ||
        newVulns > 0 ||
        newInvariants.length > 0,
    }
  }
  const baseLint = new Set(base.lint)
  const baseTc = new Set(base.typecheck)
  const baseTests = new Set(base.tests)
  const baseInv = new Set(base.invariantViolations)
  const newLint = current.lint.filter((x) => !baseLint.has(x))
  const newTypecheck = current.typecheck.filter((x) => !baseTc.has(x))
  const newTests = current.tests.filter((x) => !baseTests.has(x))
  const newVulns = Math.max(0, current.auditVulns - base.auditVulns)
  const newInvariants = current.invariantViolations.filter((x) => !baseInv.has(x))
  return {
    newLint,
    newTypecheck,
    newTests,
    newVulns,
    newInvariants,
    hasNew:
      newLint.length > 0 ||
      newTypecheck.length > 0 ||
      newTests.length > 0 ||
      newVulns > 0 ||
      newInvariants.length > 0,
  }
}
