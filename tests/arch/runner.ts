// tests/arch/runner.ts
// Architectural test runner — standalone CLI entry point.
// Usage: bun run tests/arch/runner.ts

import { resolve } from 'node:path'
import { scanBoundaryViolations } from '../../src/arch/boundary-scanner.js'
import { runCleanupAnalysis } from '../../src/cleanup/index.js'

export async function runArchTests() {
  // [audit] removed: console.log('=== VIVIM Architectural Test Suite ===\n')

  // 1. Boundary violations
  // [audit] removed: console.log('1. Boundary Violations:')
  try {
    const rootDir = resolve(import.meta.dir, '..', '..')
    const boundaryResult = await scanBoundaryViolations(rootDir)
    // [audit] removed: console.log(
      `   Scanned ${boundaryResult.filesScanned} files, ${boundaryResult.importsChecked} imports`,
    )
    // [audit] removed: console.log(`   Found ${boundaryResult.violations.length} violations`)
    for (const v of boundaryResult.violations.slice(0, 20)) {
      // [audit] removed: console.log(
        `   [${v.rule}] ${v.file}:${v.line} → ${v.importPath} (${v.fromLayer} → ${v.toLayer})`,
      )
    }
    if (boundaryResult.violations.length > 20) {
      // [audit] removed: console.log(`   ... and ${boundaryResult.violations.length - 20} more`)
    }
    // [audit] removed: console.log()
  } catch (err) {
    // [audit] removed: console.error('   Boundary scan failed:', err)
    // [audit] removed: console.log()
  }

  // 2. Cleanup analysis
  // [audit] removed: console.log('2. Cleanup Analysis:')
  try {
    const rootDir = resolve(import.meta.dir, '..', '..')
    const cleanupResult = await runCleanupAnalysis(rootDir)
    // [audit] removed: console.log(`   Deprecated events: ${cleanupResult.deprecatedEvents.length}`)
    for (const evt of cleanupResult.deprecatedEvents.slice(0, 10)) {
      // [audit] removed: console.log(`   [DEPRECATED] ${evt.deprecated} — ${evt.migration}`)
    }
    // [audit] removed: console.log(`   Potentially unused exports: ${cleanupResult.unusedExports.length}`)
    for (const u of cleanupResult.unusedExports.slice(0, 10)) {
      // [audit] removed: console.log(`   [UNUSED] ${u.name} in ${u.file}`)
    }
    // [audit] removed: console.log()
  } catch (err) {
    // [audit] removed: console.error('   Cleanup analysis failed:', err)
    // [audit] removed: console.log()
  }

  // [audit] removed: console.log('=== Done ===')
}

// Run if executed directly
if (process.argv[1]?.endsWith('runner.ts')) {
  // [audit] removed: runArchTests().catch(console.error)
}
