// devops/truth/cli.ts
// CLI entry for truth grounding system — callable from devops/index.ts
// Also acts as barrel for direct `bun run devops/truth/` usage.

import type { GapReport } from './gap-generator.ts'
export type { GapReport }

import { scanRoot } from './scanner.ts'
import { loadDesignDocs, compareDesignToCode } from './design-comparator.ts'
import { compareInterfaces } from './interface-comparator.ts'
import { generateGapReport } from './gap-generator.ts'

import { join } from 'node:path'

const PROJECT_ROOT = join(import.meta.dir, '..', '..')
const DESIGN_DOCS_DIR = join(PROJECT_ROOT, 'docs', 'merged-design-v2')
const ROADMAP_DIR = join(PROJECT_ROOT, 'docs', 'roadmap')

async function cmdScan(args: string[]) {
  // [audit] removed: console.log('Scanning codebase...')
  const scan = await scanRoot(PROJECT_ROOT)
  // [audit] removed: console.log(scan.summary)

  if (args.includes('--verbose')) {
    for (const file of scan.files) {
      if (file.classification !== 'REAL') {
        // [audit] removed: console.log(`  ${file.classification.padEnd(15)} ${file.relativePath} (${file.lines} lines)`)
      }
    }
  }

  return scan
}

async function cmdCompare(args: string[]) {
  // [audit] removed: console.log('Loading design docs...')
  const claims = await loadDesignDocs(DESIGN_DOCS_DIR)
  // [audit] removed: console.log(`Found ${claims.length} design claims across ${DESIGN_DOCS_DIR}`)

  // [audit] removed: console.log('Scanning codebase...')
  const scan = await scanRoot(PROJECT_ROOT)

  // [audit] removed: console.log('Comparing design to code...')
  const result = compareDesignToCode(claims, scan)

  // [audit] removed: console.log(`\nDesign Doc Comparison:`)
  // [audit] removed: console.log(`  Total claims: ${result.totalClaims}`)
  // [audit] removed: console.log(`  Verified: ${result.verified.length}`)
  // [audit] removed: console.log(`  Violated: ${result.violated.length}`)
  // [audit] removed: console.log(`  Unverifiable: ${result.unverifiable.length}`)
  // [audit] removed: console.log(`  Code not in design: ${result.missingFromDesign.length}`)

  if (args.includes('--verbose')) {
    // [audit] removed: console.log('\nViolated claims:')
    for (const v of result.violated) {
      // [audit] removed: console.log(`  ${v.source}:L${v.line} — ${v.name} (${v.detail.slice(0, 60)})`)
    }
    // [audit] removed: console.log('\nUnverifiable claims:')
    for (const v of result.unverifiable) {
      // [audit] removed: console.log(`  ${v.source}:L${v.line} — ${v.name}`)
    }
  }

  return { scan, result }
}

async function cmdInterfaces(args: string[]) {
  // [audit] removed: console.log('Scanning codebase...')
  const scan = await scanRoot(PROJECT_ROOT)

  // [audit] removed: console.log('Comparing interfaces...')
  const result = await compareInterfaces(scan)

  // [audit] removed: console.log(`\nInterface Comparison:`)
  // [audit] removed: console.log(result.summary)

  if (args.includes('--verbose')) {
    // [audit] removed: console.log('\nPartial implementations:')
    for (const p of result.partial) {
      // [audit] removed: console.log(`  ${p.interfaceName}: ${p.implementingFile}`)
      for (const m of p.methods) {
        // [audit] removed: console.log(`    ${m.name}: ${m.implemented ? (m.stub ? 'STUB' : 'OK') : 'MISSING'}`)
      }
    }
    // [audit] removed: console.log('\nMissing implementations:')
    for (const m of result.missing) {
      // [audit] removed: console.log(`  ${m.interfaceName}: ${m.interfaceFile}`)
    }
  }

  return { scan, result }
}

function formatReport(report: GapReport): string {
  const lines: string[] = [
    '# Truth-Grounded Gap Report',
    '',
    `**Generated:** ${report.timestamp}`,
    `**Truth Score:** ${report.truthScore}%`,
    '',
    '---',
    '',
    '## Executive Summary',
    '',
    report.executiveSummary,
    '',
    '---',
    '',
    '## Gaps by Severity',
    '',
  ]

  const severityLabels: Array<'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'> = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']
  for (const severity of severityLabels) {
    const count = report.bySeverity[severity]
    if (count === 0) continue

    lines.push(`### ${severity} (${count})`)
    lines.push('')
    lines.push('| ID | Domain | Summary | File | Effort |')
    lines.push('|---|---|---|---|---|')

    const gaps = report.gaps.filter((g) => g.severity === severity)
    for (const gap of gaps) {
      const fileShort = gap.file ?? '-'
      lines.push(`| ${gap.id} | ${gap.domain} | ${gap.summary} | ${fileShort} | ${gap.estimatedEffort} |`)
    }
    lines.push('')
  }

  lines.push('---')
  lines.push('')
  lines.push('## All Gaps')
  lines.push('')
  for (const gap of report.gaps) {
    lines.push(`### ${gap.id}: ${gap.summary}`)
    lines.push('')
    lines.push('| Field | Value |')
    lines.push('|---|---|')
    lines.push(`| Severity | ${gap.severity} |`)
    lines.push(`| Domain | ${gap.domain} |`)
    lines.push(`| Type | ${gap.type} |`)
    lines.push(`| File | ${gap.file ?? '-'} |`)
    lines.push(`| Interface | ${gap.interface ?? '-'} |`)
    lines.push(`| Design Doc | ${gap.designDoc ?? '-'} |`)
    lines.push(`| Effort | ${gap.estimatedEffort} |`)
    lines.push('')
    lines.push(gap.detail)
    lines.push('')
    lines.push(`**Recommended Action:** ${gap.recommendedAction}`)
    lines.push('')
    lines.push('---')
    lines.push('')
  }

  return lines.join('\n')
}

async function cmdFull(): Promise<GapReport> {
  // [audit] removed: console.log('=== Truth Grounding System — Full Analysis ===\n')

  // 1. Scan
  // [audit] removed: console.log('Step 1: Scanning codebase...')
  const scan = await scanRoot(PROJECT_ROOT)
  // [audit] removed: console.log(scan.summary)

  // 2. Design comparison
  // [audit] removed: console.log('\nStep 2: Loading design docs...')
  const claims = await loadDesignDocs(DESIGN_DOCS_DIR)
  // [audit] removed: console.log(`Found ${claims.length} design claims`)
  const dc = compareDesignToCode(claims, scan)
  // [audit] removed: console.log(`Verified: ${dc.verified.length} | Violated: ${dc.violated.length} | Unverifiable: ${dc.unverifiable.length}`)

  // 3. Interface comparison
  // [audit] removed: console.log('\nStep 3: Comparing interfaces...')
  const ic = await compareInterfaces(scan)
  // [audit] removed: console.log(ic.summary)

  // 4. Gap report
  // [audit] removed: console.log('\nStep 4: Generating gap report...')
  const report = generateGapReport(scan, dc, ic)
  // [audit] removed: console.log(`\n${report.executiveSummary}`)

  return report
}

async function cmdReport() {
  const report = await cmdFull()

  // Write to docs/roadmap/TRUTH-GAPS.md + dated copy
  const dateStr = new Date().toISOString().split('T')[0]!
  const outPath = join(ROADMAP_DIR, `TRUTH-GAPS.md`)
  const datedPath = join(ROADMAP_DIR, `TRUTH-GAPS-${dateStr}.md`)
  const content = formatReport(report)
  await Bun.write(outPath, content)
  await Bun.write(datedPath, content)

  // [audit] removed: console.log(`\nReport written to:`)
  // [audit] removed: console.log(`  ${outPath}`)
  // [audit] removed: console.log(`  ${datedPath}`)
}

// ── Main entry for `bun run devops truth <subcmd>` ────────────────────────

export async function runTruthCommand(args: string[]) {
  const [sub, ...subArgs] = args

  switch (sub) {
    case 'scan':
      await cmdScan(subArgs)
      break

    case 'compare':
      await cmdCompare(subArgs)
      break

    case 'interfaces':
      await cmdInterfaces(subArgs)
      break

    case 'full':
      await cmdFull()
      break

    case 'report':
      await cmdReport()
      break

    default:
      // [audit] removed: console.error('usage: bun run devops truth <scan|compare|interfaces|full|report>')
      // [audit] removed: console.error('  scan        — scan codebase, classify files as REAL/STUB/INTERFACE_ONLY')
      // [audit] removed: console.error('  compare     — compare design docs to actual code')
      // [audit] removed: console.error('  interfaces  — compare exported interfaces to implementations')
      // [audit] removed: console.error('  full        — run all three and produce gap report')
      // [audit] removed: console.error('  report      — run full analysis and write gap report to docs/roadmap/')
      process.exit(1)
  }
}

// ── Direct entry (when run as `bun run devops/truth/`) ────────────────────

const [cmd, ...args] = process.argv.slice(2)
if (import.meta.path === Bun.main) {
  runTruthCommand([cmd, ...args]).catch((e) => {
    // [audit] removed: console.error('Truth Grounding System error:', e)
    process.exit(1)
  })
}
