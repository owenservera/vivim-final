// src/cleanup/index.ts
// Code cleanup utilities.
//
// This module provides tools for identifying dead code, deprecated events,
// and unused exports.  It is deliberately CONSERVATIVE — it never deletes
// anything, only annotates and reports.

export {
  DEPRECATED_EVENTS,
  deprecationWarning,
  getActiveDeprecatedEvents,
  isEventDeprecated,
} from './deprecated-events.js'
export { analyzeBarrelExports } from './unused-exports.js'
export type { DeprecatedEvent } from './deprecated-events.js'
export type { UnusedExport } from './unused-exports.js'

// ── Composite runner ──────────────────────────────────────────────────

/**
 * Run all cleanup analyses and return a consolidated report.
 *
 * @param rootDir  Absolute path to the project root (where `src/` lives).
 */
export async function runCleanupAnalysis(rootDir: string): Promise<{
  deprecatedEvents: import('./deprecated-events.js').DeprecatedEvent[]
  unusedExports: import('./unused-exports.js').UnusedExport[]
}> {
  const { getActiveDeprecatedEvents } = await import('./deprecated-events.js')
  const { analyzeBarrelExports } = await import('./unused-exports.js')

  const activeDeprecated = getActiveDeprecatedEvents()

  let unusedExports: import('./unused-exports.js').UnusedExport[] = []
  try {
    const barrelPath = import.meta.dirname
      ? `${import.meta.dirname}/index.ts`
      : `${rootDir}/src/index.ts`
    unusedExports = await analyzeBarrelExports(barrelPath, rootDir)
  } catch {
    // If barrel analysis fails (e.g. in bundled contexts), return empty.
  }

  return {
    deprecatedEvents: activeDeprecated,
    unusedExports,
  }
}
