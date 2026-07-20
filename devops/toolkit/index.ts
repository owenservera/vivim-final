// devops/toolkit/index.ts
//
// `bun run devops toolkit <subcommand>` — the dedicated devops toolkit for
// maximising vivim-final reprogrammability / configurability, with a hard
// FRONTEND = BACKEND = SDK = CLI = API parity guarantee.
//
// Subcommands:
//   regen     Re-derive every surface projection from the capability pool.
//   parity    Verify every capability resolves across all declared surfaces.
//   config    Inspect / set runtime tunables (persisted to .runtime).
//   diff      Show surface projection deltas vs the last regenerated manifest.
//   verify    Alias for parity (unified cross-surface gate).
//
// This is additive: it composes with scripts/verify-cross-surface.ts (the
// read-only gate) by reusing the same pool + SLOT_IDS contract.

import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { TUNABLE_SCHEMA, getTunable, listTunables, setTunable } from '../../src/config.js'
import { type RegenResult, loadPool, regenerate } from './regen.js'
import { parityReport } from './surface-parity.js'

const PROJECTIONS_FILE = join(process.cwd(), 'seeds', 'taxonomy', 'surface-projections.json')

function printParity(): number {
  const nodes = loadPool()
  const report = parityReport(nodes)
  console.log('═══════════════════════════════════════════════════════════════')
  console.log('              DEVOPS TOOLKIT — CROSS-SURFACE PARITY')
  console.log('═══════════════════════════════════════════════════════════════')
  console.log(`Capabilities: ${report.total}  In parity: ${report.passed}  Out: ${report.failed}`)
  console.log('')
  console.log('Surface coverage (resolved / required):')
  for (const [surface, { required, ok }] of Object.entries(report.bySurface)) {
    const icon = ok === required ? '✓' : '✗'
    console.log(`  ${icon} ${surface.padEnd(8)}: ${ok}/${required}`)
  }
  if (report.failed > 0) {
    console.log('')
    console.log('Out-of-parity capabilities:')
    for (const f of report.findings) {
      console.log(`  ✗ ${f.slug}${f.capId ? ` (${f.capId})` : ''}`)
      for (const issue of f.issues) console.log(`      - ${issue}`)
    }
  }
  console.log('═══════════════════════════════════════════════════════════════')
  return report.failed > 0 ? 1 : 0
}

function printRegen(result: RegenResult): void {
  console.log(
    `[toolkit:regen] ${result.nodeCount} capabilities → ${result.regeneratedSurfaces} surface projections`,
  )
  console.log('[toolkit:regen] wrote seeds/taxonomy/surface-projections.json')
}

function printConfig(cmd: string, rest: string[]): void {
  if (cmd === 'list' || rest.length === 0) {
    console.log('Runtime tunables (override > default):')
    for (const t of listTunables()) {
      console.log(`  ${t.source === 'override' ? '*' : ' '} ${t.key} = ${JSON.stringify(t.value)}`)
    }
    return
  }
  if (cmd === 'get') {
    const key = rest[0]
    if (!key) throw new Error('usage: devops toolkit config get <key>')
    console.log(JSON.stringify(getTunable(key)))
    return
  }
  if (cmd === 'set') {
    const [key, ...valParts] = rest
    if (!key || valParts.length === 0)
      throw new Error('usage: devops toolkit config set <key> <value>')
    const meta = TUNABLE_SCHEMA.find((t) => t.key === key)
    if (!meta) throw new Error(`unknown tunable: ${key}`)
    const raw = valParts.join(' ')
    const value =
      meta.type === 'number'
        ? Number(raw)
        : meta.type === 'boolean'
          ? raw === 'true'
          : meta.type === 'string[]'
            ? raw.split(',')
            : raw
    setTunable(key, value)
    console.log(
      `[toolkit:config] ${key} = ${JSON.stringify(value)} (persisted to .runtime/config.tunables.json)`,
    )
    return
  }
  if (cmd === 'describe') {
    for (const t of TUNABLE_SCHEMA) {
      console.log(
        `  ${t.key} (${t.type}) — ${t.description} [default: ${JSON.stringify(t.default)}]`,
      )
    }
    return
  }
  throw new Error(`unknown config subcommand: ${cmd}`)
}

function printDiff(): number {
  if (!existsSync(PROJECTIONS_FILE)) {
    console.error('[toolkit:diff] no regenerated manifest — run `devops toolkit regen` first')
    return 2
  }
  const before = JSON.parse(readFileSync(PROJECTIONS_FILE, 'utf-8')) as {
    projections: Record<string, Record<string, unknown>>
  }
  const after = regenerate()
  const beforeSlugs = new Set(Object.keys(before.projections))
  const afterSlugs = new Set(Object.keys(after.projections))
  let changes = 0
  for (const slug of afterSlugs) {
    if (!beforeSlugs.has(slug)) {
      console.log(`  + ${slug} (new)`)
      changes++
      continue
    }
    const b = JSON.stringify(before.projections[slug])
    const a = JSON.stringify(after.projections[slug])
    if (b !== a) {
      console.log(`  ~ ${slug} (changed surface projection)`)
      changes++
    }
  }
  for (const slug of beforeSlugs) {
    if (!afterSlugs.has(slug)) {
      console.log(`  - ${slug} (removed)`)
      changes++
    }
  }
  console.log(`[toolkit:diff] ${changes} delta(s). rerun \`regen\` to persist.`)
  return changes > 0 ? 1 : 0
}

export async function runToolkit(args: string[]): Promise<number> {
  const [cmd, ...rest] = args
  switch (cmd) {
    case 'regen':
      printRegen(regenerate())
      return 0
    case 'parity':
    case 'verify':
      return printParity()
    case 'config':
      printConfig(rest[0] ?? 'list', rest.slice(1))
      return 0
    case 'diff':
      return printDiff()
    case undefined:
    case 'help':
    case '--help':
    case '-h':
      console.log(`devops toolkit — reprogrammability + cross-surface parity toolkit

Usage: bun run devops toolkit <subcommand> [args]

  regen     Re-derive CLI/API/SDK/UI/MCP/Workflow from the capability pool
  parity    Verify every capability resolves across all declared surfaces
  config    Inspect/set runtime tunables (list|get|set|describe)
  diff      Show surface projection deltas vs last regen
  verify    Alias for parity

Invariant: FRONTEND = BACKEND = SDK = CLI = API (derived from single slug).`)
      return 0
    default:
      console.error(`[toolkit] unknown subcommand: ${cmd}`)
      return 2
  }
}
