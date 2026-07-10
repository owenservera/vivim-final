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
  console.log('Scanning codebase...')
  const scan = await scanRoot(PROJECT_ROOT)
  console.log(scan.summary)

  if (args.includes('--verbose')) {
    for (const file of scan.files) {
      if (file.classification !== 'REAL') {
        console.log(`  ${file.classification.padEnd(15)} ${file.relativePath} (${file.lines} lines)`)
      }
    }
  }

  return scan
}

async function cmdCompare(args: string[]) {
  console.log('Loading design docs...')
  const claims = await loadDesignDocs(DESIGN_DOCS_DIR)
  console.log(`Found ${claims.length} design claims across ${DESIGN_DOCS_DIR}`)

  console.log('Scanning codebase...')
  const scan = await scanRoot(PROJECT_ROOT)

  console.log('Comparing design to code...')
  const result = compareDesignToCode(claims, scan)

  console.log(`\nDesign Doc Comparison:`)
  console.log(`  Total claims: ${result.totalClaims}`)
  console.log(`  Verified: ${result.verified.length}`)
  console.log(`  Violated: ${result.violated.length}`)
  console.log(`  Unverifiable: ${result.unverifiable.length}`)
  console.log(`  Code not in design: ${result.missingFromDesign.length}`)

  if (args.includes('--verbose')) {
    console.log('\nViolated claims:')
    for (const v of result.violated) {
      console.log(`  ${v.source}:L${v.line} — ${v.name} (${v.detail.slice(0, 60)})`)
    }
    console.log('\nUnverifiable claims:')
    for (const v of result.unverifiable) {
      console.log(`  ${v.source}:L${v.line} — ${v.name}`)
    }
  }

  return { scan, result }
}

async function cmdInterfaces(args: string[]) {
  console.log('Scanning codebase...')
  const scan = await scanRoot(PROJECT_ROOT)

  console.log('Comparing interfaces...')
  const result = await compareInterfaces(scan)

  console.log(`\nInterface Comparison:`)
  console.log(result.summary)

  if (args.includes('--verbose')) {
    console.log('\nPartial implementations:')
    for (const p of result.partial) {
      console.log(`  ${p.interfaceName}: ${p.implementingFile}`)
      for (const m of p.methods) {
        console.log(`    ${m.name}: ${m.implemented ? (m.stub ? 'STUB' : 'OK') : 'MISSING'}`)
      }
    }
    console.log('\nMissing implementations:')
    for (const m of result.missing) {
      console.log(`  ${m.interfaceName}: ${m.interfaceFile}`)
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
  console.log('=== Truth Grounding System — Full Analysis ===\n')

  // 1. Scan
  console.log('Step 1: Scanning codebase...')
  const scan = await scanRoot(PROJECT_ROOT)
  console.log(scan.summary)

  // 2. Design comparison
  console.log('\nStep 2: Loading design docs...')
  const claims = await loadDesignDocs(DESIGN_DOCS_DIR)
  console.log(`Found ${claims.length} design claims`)
  const dc = compareDesignToCode(claims, scan)
  console.log(`Verified: ${dc.verified.length} | Violated: ${dc.violated.length} | Unverifiable: ${dc.unverifiable.length}`)

  // 3. Interface comparison
  console.log('\nStep 3: Comparing interfaces...')
  const ic = await compareInterfaces(scan)
  console.log(ic.summary)

  // 4. Gap report
  console.log('\nStep 4: Generating gap report...')
  const report = generateGapReport(scan, dc, ic)
  console.log(`\n${report.executiveSummary}`)

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

  console.log(`\nReport written to:`)
  console.log(`  ${outPath}`)
  console.log(`  ${datedPath}`)
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
      console.error('usage: bun run devops truth <scan|compare|interfaces|full|report>')
      console.error('  scan        — scan codebase, classify files as REAL/STUB/INTERFACE_ONLY')
      console.error('  compare     — compare design docs to actual code')
      console.error('  interfaces  — compare exported interfaces to implementations')
      console.error('  full        — run all three and produce gap report')
      console.error('  report      — run full analysis and write gap report to docs/roadmap/')
      process.exit(1)
  }
}

// ── Direct entry (when run as `bun run devops/truth/`) ────────────────────

const [cmd, ...args] = process.argv.slice(2)
if (import.meta.path === Bun.main) {
  runTruthCommand([cmd, ...args]).catch((e) => {
    console.error('Truth Grounding System error:', e)
    process.exit(1)
  })
}
