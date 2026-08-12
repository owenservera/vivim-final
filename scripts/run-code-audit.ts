// scripts/run-code-audit.ts
// CLI for the SOTA 10-phase agentic code audit engine. Supports targeting a
// sub-path, live streaming to console, gate thresholds (non-zero exit), rule
// filtering, and LLM debate wiring.
//
// Usage:
//   bun run scripts/run-code-audit.ts [--target <path>] [--stream]
//     [--gate-threshold <0-100>] [--rules id1,id2] [--no-dynamic]
//     [--no-verify] [--format json|sarif|md] [--out <dir>]

import * as fs from 'node:fs'
import * as path from 'node:path'
import { CodeAuditEngine } from '../src/engines/code-audit/index.js'
import type { StreamEvent } from '../src/engines/code-audit/types.js'

interface CliArgs {
  target: string
  stream: boolean
  gateThreshold: number | null
  rules: string[] | null
  noDynamic: boolean
  noVerify: boolean
  format: 'json' | 'sarif' | 'md'
  out: string
  scope: string
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {
    target: path.resolve(process.cwd()),
    stream: false,
    gateThreshold: null,
    rules: null,
    noDynamic: false,
    noVerify: false,
    format: 'json',
    out: path.resolve(process.cwd()),
    scope: 'sota',
  }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!
    switch (a) {
      case '--target':
        args.target = path.resolve(argv[++i]!)
        break
      case '--stream':
        args.stream = true
        break
      case '--gate-threshold': {
        const v = Number(argv[++i])
        if (Number.isFinite(v) && v >= 0 && v <= 100) args.gateThreshold = v
        break
      }
      case '--rules':
        args.rules = argv[++i]!.split(',').map((s) => s.trim()).filter(Boolean)
        break
      case '--no-dynamic':
        args.noDynamic = true
        break
      case '--no-verify':
        args.noVerify = true
        break
      case '--format':
        args.format = (argv[++i] as CliArgs['format']) ?? 'json'
        break
      case '--out':
        args.out = path.resolve(argv[++i]!)
        break
      case '--scope':
        args.scope = argv[++i]!
        break
      case '--help':
      case '-h':
        // [audit] removed: console.log(help())
        process.exit(0)
      default:
        break
    }
  }
  return args
}

function help(): string {
  return `vivim code-audit (SOTA 10-phase engine)

Usage:
  bun run scripts/run-code-audit.ts [flags]

Flags:
  --target <path>          Root to audit (default: cwd)
  --stream                 Live-stream phase/finding events to console
  --gate-threshold <0-100> Exit non-zero if health score is below threshold
  --rules id1,id2          Only run specific rule ids
  --no-dynamic             Skip real bun-test dynamic probes
  --no-verify              Skip patch re-run verification
  --format json|sarif|md   Report output format (default: json)
  --out <dir>              Output directory (default: cwd)
  --scope <label>          Scope label on the report (default: sota)
  -h, --help               Show this help
`
}

function formatMd(report: Awaited<ReturnType<CodeAuditEngine['executeAudit']>>): string {
  const lines: string[] = []
  lines.push(`# Code Audit Report — ${report.scope ?? 'sota'}`)
  lines.push('')
  lines.push(`- **ID:** ${report.id}`)
  lines.push(`- **Target:** ${report.targetPath}`)
  lines.push(`- **Health:** ${report.overallHealthScore}/100 (risk ${report.risk})`)
  lines.push(`- **SLOC:** ${report.slocTotal} | **Files:** ${report.ingestionStats.totalFiles}`)
  lines.push(`- **Findings:** ${report.findings.length}`)
  lines.push('')
  lines.push('## Summary by severity')
  lines.push('')
  lines.push('| Severity | Count |')
  lines.push('| --- | --- |')
  for (const [sev, n] of Object.entries(report.summary)) {
    lines.push(`| ${sev} | ${n} |`)
  }
  lines.push('')
  lines.push('## Top findings')
  lines.push('')
  for (const f of report.findings.slice(0, 25)) {
    lines.push(`- **[${f.severity}]** \`${f.ruleId}\` — ${f.title}`)
    lines.push(`  - ${f.location.filePath}:${f.location.lineNumber ?? 1}`)
    if (f.falsePositive) lines.push('  - ⚠ false positive (debate refuted)')
  }
  lines.push('')
  lines.push('## Phases')
  lines.push('')
  for (const p of report.phaseResults) {
    lines.push(`- ${p.phase}: ${p.status} (${p.durationMs}ms, ${p.findingsCount} findings)`)
  }
  return lines.join('\n')
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  // [audit] removed: console.log(`=== SOTA 10-Phase Agentic Code Audit ===`)
  // [audit] removed: console.log(`Target: ${args.target}`)
  // [audit] removed: console.log(`Stream: ${args.stream ? 'on' : 'off'} | Dynamic probes: ${args.noDynamic ? 'off' : 'on'} | Patch verify: ${args.noVerify ? 'off' : 'on'}`)

  const engine = new CodeAuditEngine({
    targetPath: args.target,
    enableDynamicTesting: true,
    runDynamicTests: !args.noDynamic,
    enablePatchGeneration: true,
    verifyPatches: !args.noVerify,
    enableSarifExport: true,
    rulesFilter: args.rules ?? undefined,
    scope: args.scope,
    stream: args.stream
      ? {
          onPhase: (phase, result) => {
            // [audit] removed: console.log(
              `[phase] ${phase} ${result.status} ${result.durationMs}ms (${result.findingsCount} findings)`,
            )
          },
          onFinding: (f) => {
            // [audit] removed: console.log(
              `[finding] ${f.severity} ${f.ruleId} @ ${f.location.filePath}:${f.location.lineNumber ?? 1}`,
            )
          },
        }
      : undefined,
  })

  const report = await engine.executeAudit()

  // [audit] removed: console.log('\n=== Audit Complete ===')
  // [audit] removed: console.log(`Health: ${report.overallHealthScore}/100 (risk ${report.risk})`)
  // [audit] removed: console.log(`Findings: ${report.findings.length}`)
  // [audit] removed: console.log('Summary:', JSON.stringify(report.summary))
  // [audit] removed: console.log('By dimension:', JSON.stringify(report.byDimension))

  if (args.gateThreshold !== null && report.overallHealthScore < args.gateThreshold) {
    // [audit] removed: console.error(`\nGate FAILED: health ${report.overallHealthScore} < threshold ${args.gateThreshold}`)
    process.exitCode = 1
  }

  fs.mkdirSync(args.out, { recursive: true })
  const base = path.join(args.out, `audit-report-${report.id.slice(0, 8)}`)
  if (args.format === 'json' || args.format === 'md') {
    fs.writeFileSync(`${base}.json`, JSON.stringify(report, null, 2), 'utf-8')
    // [audit] removed: console.log(`JSON report: ${base}.json`)
  }
  if (args.format === 'sarif' || args.format === 'md') {
    const sarif = engine.generateSarifReport(report)
    const sarifPath = `${base}.sarif`
    fs.writeFileSync(sarifPath, JSON.stringify(sarif, null, 2), 'utf-8')
    // [audit] removed: console.log(`SARIF report: ${sarifPath}`)
  }
  if (args.format === 'md') {
    const mdPath = `${base}.md`
    fs.writeFileSync(mdPath, formatMd(report), 'utf-8')
    // [audit] removed: console.log(`Markdown report: ${mdPath}`)
  }
}

main().catch((err) => {
  // [audit] removed: console.error('Audit execution error:', err)
  process.exit(1)
})
