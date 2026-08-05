// devops/audit-arch/boundary-enforce.ts
// Integration between the architectural boundary guard (src/arch) and the
// existing audit-arch infrastructure. Converts boundary-scanner violations
// into audit findings so they appear alongside other architecture checks.
//
// This can be invoked:
//   - Standalone: `bun run devops/audit-arch/boundary-enforce.ts`
//   - Programmatically: import and call `runBoundaryEnforcement()`

import { relative, resolve } from 'node:path'
import { buildFinding, resetIdCounter, type Finding } from './findings.js'
import { scanBoundaryViolations, type Violation } from '../../src/arch/boundary-scanner.js'
import { BOUNDARY_RULES } from '../../src/arch/boundary-rules.js'

const ROOT = resolve(import.meta.dir, '..', '..')

// ── Finding generation ───────────────────────────────────────────────────────

/**
 * Map a boundary-scanner Violation to an audit Finding.
 *
 * Priority assignment:
 *   - P0: shared/ importing anything (absolute foundation breach)
 *   - P0: storage-contracts importing impls (contract purity breach)
 *   - P1: engines importing storage-impl or executor (wrong direction)
 *   - P1: frontend importing anything beyond shared
 *   - P2: everything else
 */
function violationToFinding(v: Violation): Finding {
  let priority: 'P0' | 'P1' | 'P2' = 'P2'
  const relFile = relative(ROOT, v.file)

  // P0 — critical boundary breaches
  if (v.fromLayer === 'shared' && v.toLayer !== '(external)') {
    priority = 'P0'
  } else if (
    v.fromLayer === 'storage-contracts' &&
    (v.toLayer === 'storage-impl' || v.toLayer === 'engines' || v.toLayer === 'server' || v.toLayer === 'executor' || v.toLayer === 'cli')
  ) {
    priority = 'P0'
  }
  // P1 — wrong-direction or cross-boundary
  else if (
    v.fromLayer === 'engines' &&
    (v.toLayer === 'storage-impl' || v.toLayer === 'server' || v.toLayer === 'cli' || v.toLayer === 'executor')
  ) {
    priority = 'P1'
  } else if (v.fromLayer === 'frontend' && v.toLayer !== 'shared' && v.toLayer !== '(external)') {
    priority = 'P1'
  } else if (v.fromLayer === 'storage-contracts') {
    priority = 'P1'
  } else if (v.fromLayer === 'shared') {
    priority = 'P0'
  }

  return buildFinding({
    priority,
    dimension: 'boundaries',
    title: `Boundary violation: ${v.fromLayer} → ${v.toLayer}`,
    description: v.rule,
    file: relFile,
    line: v.line,
    evidence: `${relFile}:${v.line} — imports ${v.importPath} (layer ${v.toLayer})`,
    impact: `Cross-layer coupling: ${v.fromLayer} layer depends on ${v.toLayer} layer, breaking the dependency direction contract.`,
    fixSummary: `Remove the import from ${v.fromLayer} to ${v.toLayer} and depend on an allowed layer instead.`,
    fixSteps: getFixSteps(v),
    effort: 'M' as const,
    autoFixable: false,
  })
}

/** Generate remediation steps for a violation. */
function getFixSteps(v: Violation): string[] {
  if (v.fromLayer === 'engines' && v.toLayer === 'storage-impl') {
    return [
      `Replace the import of ${v.importPath} with the corresponding contract from storage/contracts/.`,
      'Implement against the Store Contract interface.',
      'Ensure the impl binding is wired at the composition root (server/ or cli/).',
    ]
  }

  if (v.fromLayer === 'frontend' && v.toLayer !== 'shared') {
    return [
      'Move the shared type to the shared/ directory if it is a pure type.',
      'If runtime logic is needed, create an API endpoint and fetch from the frontend.',
      'Alternatively, duplicate a minimal type in the frontend (accepted for now).',
    ]
  }

  if (v.fromLayer === 'storage-contracts') {
    return [
      'Storage contracts must be pure interfaces with no non-foundation dependencies.',
      `Move the dependency on ${v.importPath} to the storage-impl layer.`,
      'If the contract needs a type from another layer, extract the type to shared/.',
    ]
  }

  if (v.fromLayer === 'shared') {
    return [
      'The shared/ directory must have zero in-project dependencies.',
      `Remove the import of ${v.importPath} or inline the needed type.`,
      'If the type is needed by both shared and another layer, consider moving it into shared/.',
    ]
  }

  return [
    `Review the import of ${v.importPath} in ${relative(ROOT, v.file)}.`,
    `Check if the dependency can be satisfied from an allowed layer: ${getAllowedLayers(v.fromLayer)}.`,
    'If the rule is too strict, update the boundary rules in src/arch/boundary-rules.ts.',
  ]
}

/** Get a human-readable list of allowed import targets for a layer. */
function getAllowedLayers(fromLayer: string): string {
  const rule = BOUNDARY_RULES.find((r) => r.layer === fromLayer)
  if (!rule) return '(unknown layer)'
  if (rule.mayImportFrom.length === 0) return '(none — this layer has zero allowed in-repo imports)'
  return rule.mayImportFrom.join(', ')
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Run the boundary enforcement scan and return audit-compatible findings.
 *
 * @param rootDir  Project root (defaults to monorepo root)
 */
export async function runBoundaryEnforcement(rootDir: string = ROOT): Promise<Finding[]> {
  resetIdCounter()

  const result = await scanBoundaryViolations(rootDir)
  const findings = result.violations.map(violationToFinding)

  const rank: Record<string, number> = { P0: 0, P1: 1, P2: 2, P3: 3 }
  findings.sort((a, b) => {
    const ra = rank[a.priority] ?? 9
    const rb = rank[b.priority] ?? 9
    if (ra !== rb) return ra - rb
    return a.file.localeCompare(b.file)
  })

  return findings
}

/**
 * Run boundary enforcement and print a summary to stdout.
 */
export async function runBoundaryEnforcementWithReport(rootDir: string = ROOT): Promise<void> {
  const result = await scanBoundaryViolations(rootDir)
  const findings = result.violations.map(violationToFinding)

  const rank: Record<string, number> = { P0: 0, P1: 1, P2: 2, P3: 3 }
  findings.sort((a, b) => {
    const ra = rank[a.priority] ?? 9
    const rb = rank[b.priority] ?? 9
    if (ra !== rb) return ra - rb
    return a.file.localeCompare(b.file)
  })

  console.log(`\n${'═'.repeat(60)}`)
  console.log('  ARCHITECTURAL BOUNDARY ENFORCEMENT REPORT')
  console.log(`${'═'.repeat(60)}`)
  console.log(`  Files scanned:   ${result.filesScanned}`)
  console.log(`  Imports checked:  ${result.importsChecked}`)
  console.log(`  Violations found: ${result.violations.length}`)
  console.log(`${'─'.repeat(60)}`)

  if (findings.length === 0) {
    console.log('  ✅ No boundary violations detected.')
    console.log(`${'═'.repeat(60)}\n`)
    return
  }

  const byPriority = new Map<string, Finding[]>()
  for (const f of findings) {
    const arr = byPriority.get(f.priority) ?? []
    arr.push(f)
    byPriority.set(f.priority, arr)
  }

  for (const [priority, items] of byPriority) {
    console.log(`\n  ${priority} (${items.length} violation${items.length === 1 ? '' : 's'})`)
    console.log(`${'─'.repeat(40)}`)
    for (const f of items) {
      console.log(`    ${f.file}:${f.line}  ${f.title}`)
      console.log(`      → ${f.evidence}`)
    }
  }

  console.log(`\n${'═'.repeat(60)}\n`)
}

// ── CLI entry point ──────────────────────────────────────────────────────────

if (import.meta.main) {
  const [, , ...args] = process.argv
  const root = args[0] ?? ROOT
  runBoundaryEnforcementWithReport(root).catch((e) => {
    console.error(e)
    process.exit(1)
  })
}
