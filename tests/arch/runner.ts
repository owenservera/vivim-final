// tests/arch/runner.ts
// Architectural test runner — standalone CLI entry point.
// Usage: bun run tests/arch/runner.ts

import { resolve } from 'node:path'
import { scanBoundaryViolations } from '../../src/arch/boundary-scanner.js'
import { runCleanupAnalysis } from '../../src/cleanup/index.js'

export async function runArchTests() {
  console.log('=== VIVIM Architectural Test Suite ===\n')

  // 1. Boundary violations
  console.log('1. Boundary Violations:')
  try {
    const rootDir = resolve(import.meta.dir, '..', '..')
    const boundaryResult = await scanBoundaryViolations(rootDir)
    console.log(
      `   Scanned ${boundaryResult.filesScanned} files, ${boundaryResult.importsChecked} imports`,
    )
    console.log(`   Found ${boundaryResult.violations.length} violations`)
    for (const v of boundaryResult.violations.slice(0, 20)) {
      console.log(
        `   [${v.rule}] ${v.file}:${v.line} → ${v.importPath} (${v.fromLayer} → ${v.toLayer})`,
      )
    }
    if (boundaryResult.violations.length > 20) {
      console.log(`   ... and ${boundaryResult.violations.length - 20} more`)
    }
    console.log()
  } catch (err) {
    console.error('   Boundary scan failed:', err)
    console.log()
  }

  // 2. Cleanup analysis
  console.log('2. Cleanup Analysis:')
  try {
    const rootDir = resolve(import.meta.dir, '..', '..')
    const cleanupResult = await runCleanupAnalysis(rootDir)
    console.log(`   Deprecated events: ${cleanupResult.deprecatedEvents.length}`)
    for (const evt of cleanupResult.deprecatedEvents.slice(0, 10)) {
      console.log(`   [DEPRECATED] ${evt.deprecated} — ${evt.migration}`)
    }
    console.log(`   Potentially unused exports: ${cleanupResult.unusedExports.length}`)
    for (const u of cleanupResult.unusedExports.slice(0, 10)) {
      console.log(`   [UNUSED] ${u.name} in ${u.file}`)
    }
    console.log()
  } catch (err) {
    console.error('   Cleanup analysis failed:', err)
    console.log()
  }

  console.log('=== Done ===')
}

// Run if executed directly
if (process.argv[1]?.endsWith('runner.ts')) {
  runArchTests().catch(console.error)
}
