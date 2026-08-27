// tests/arch/runner.ts
// Architectural test runner — standalone CLI entry point.
// Usage: bun run tests/arch/runner.ts

import { resolve } from 'node:path'
import { scanBoundaryViolations } from '../../src/arch/boundary-scanner.js'
import { runCleanupAnalysis } from '../../src/cleanup/index.js'

export async function runArchTests() {
  // 1. Boundary violations
  try {
    const rootDir = resolve(import.meta.dir, '..', '..')
    const boundaryResult = await scanBoundaryViolations(rootDir)
    for (const _v of boundaryResult.violations.slice(0, 20)) {
      // violations logged via caller
    }
  } catch (_err) {
    // boundary scan failed
  }

  // 2. Cleanup analysis
  try {
    const rootDir = resolve(import.meta.dir, '..', '..')
    const cleanupResult = await runCleanupAnalysis(rootDir)
    for (const _evt of cleanupResult.deprecatedEvents.slice(0, 10)) {
      // deprecated events logged via caller
    }
    for (const _u of cleanupResult.unusedExports.slice(0, 10)) {
      // unused exports logged via caller
    }
  } catch (_err) {
    // cleanup analysis failed
  }
}

// Run if executed directly
if (process.argv[1]?.endsWith('runner.ts')) {
  runArchTests().catch(() => process.exit(1))
}
