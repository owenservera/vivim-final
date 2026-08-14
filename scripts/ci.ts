// scripts/ci.ts
// Local CI mirror — runs the same quality gate that .github/workflows/ci.yml
// runs in GitHub Actions. Use this before pushing to catch failures early.
//
// Usage:
//   bun run ci           # run full gate, exit non-zero on any failure
//   bun run ci --fix     # auto-fix lint/format issues first, then run gate
//
// Gate steps (in order):
//   1. prisma generate (system)  — regenerate system client
//   2. prisma generate (user)    — regenerate user client
//   3. prisma drift check (system) — schema vs migrations drift
//   4. prisma drift check (user)   — schema vs migrations drift
//   5. typecheck         — bun x tsc --noEmit
//   6. lint              — bun run lint (biome check src/ tests/ seeds/)
//   7. unit tests        — bun test tests/unit/
//   8. arch tests        — bun test tests/arch/
//   9. build             — bun run build (tsup)
//  10. docs:openapi      — bun run docs:openapi
//  11. docs:manual       — bun run docs:manual
//
// Each step prints a clear PASS/FAIL banner. On failure, the script exits
// immediately with the failing step's exit code so the user can fix and
// re-run without waiting for downstream steps.

import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = import.meta.dir.replace('/scripts', '')
const fix = process.argv.includes('--fix')

interface Step {
  name: string
  cmd: string[]
  cwd?: string
  optional?: boolean
}

const steps: Step[] = [
  {
    name: 'prisma generate (system)',
    cmd: ['bun', 'x', 'prisma', 'generate', '--schema=prisma/system/schema.prisma'],
  },
  {
    name: 'prisma generate (user)',
    cmd: ['bun', 'x', 'prisma', 'generate', '--schema=prisma/user/schema.prisma'],
  },
  {
    name: 'prisma drift check (system)',
    cmd: ['bun', 'x', 'prisma', 'migrate', 'diff', '--from-migrations', 'prisma/system/migrations', '--to-schema-datamodel', 'prisma/system/schema.prisma', '--exit-code'],
  },
  {
    name: 'prisma drift check (user)',
    cmd: ['bun', 'x', 'prisma', 'migrate', 'diff', '--from-migrations', 'prisma/user/migrations', '--to-schema-datamodel', 'prisma/user/schema.prisma', '--exit-code'],
  },
  {
    name: 'typecheck',
    cmd: ['bun', 'x', 'tsc', '--noEmit'],
  },
  {
    name: fix ? 'lint (with --write)' : 'lint',
    cmd: fix ? ['bun', 'x', 'biome', 'check', 'src/', 'tests/', 'seeds/', '--write'] : ['bun', 'run', 'lint'],
  },
  {
    name: 'unit tests',
    cmd: ['bun', 'test', 'tests/unit/', '--exclude', 'docs/**'],
  },
  {
    name: 'arch tests',
    cmd: ['bun', 'test', 'tests/arch/', '--exclude', 'docs/**'],
  },
  {
    name: 'build',
    cmd: ['bun', 'run', 'build'],
  },
  {
    name: 'docs:openapi',
    cmd: ['bun', 'run', 'docs:openapi'],
    optional: true,
  },
  {
    name: 'docs:manual',
    cmd: ['bun', 'run', 'docs:manual'],
    optional: true,
  },
]

function banner(text: string, color: 'gray' | 'green' | 'red' | 'cyan' = 'gray') {
  const colors: Record<string, string> = {
    gray: '\x1b[90m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    cyan: '\x1b[36m',
  }
  const reset = '\x1b[0m'
  const line = '─'.repeat(Math.max(40, text.length + 4))
  // [audit] removed: console.log(`${colors[color]}${line}${reset}`)
  // [audit] removed: console.log(`${colors[color]}  ${text}${reset}`)
  // [audit] removed: console.log(`${colors[color]}${line}${reset}`)
}

function runStep(step: Step): boolean {
  banner(`▶ ${step.name}`, 'cyan')
  const cwd = step.cwd ?? ROOT
  const result = spawnSync(step.cmd[0]!, step.cmd.slice(1), {
    cwd,
    stdio: 'inherit',
    env: { ...process.env, FORCE_COLOR: '1' },
  })
  if (result.status === 0) {
    banner(`✓ ${step.name} — PASS`, 'green')
    // [audit] removed: console.log()
    return true
  }
  if (step.optional) {
    banner(`⚠ ${step.name} — FAILED (optional, continuing)`, 'gray')
    // [audit] removed: console.log()
    return true
  }
  banner(`✗ ${step.name} — FAIL (exit ${result.status})`, 'red')
  // [audit] removed: console.log()
  return false
}

// ── Main ───────────────────────────────────────────────────────────────────

banner('vivim-final local CI gate', 'gray')
// [audit] removed: console.log()
// [audit] removed: if (fix) console.log('Running in --fix mode (lint will auto-write).\n')

const startedAt = Date.now()
let allPassed = true
for (const step of steps) {
  const passed = runStep(step)
  if (!passed) {
    allPassed = false
    break
  }
}

const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1)
if (allPassed) {
  banner(`✓ CI gate PASSED in ${elapsed}s`, 'green')
  process.exit(0)
} else {
  banner(`✗ CI gate FAILED in ${elapsed}s`, 'red')
  process.exit(1)
}
