// devops/audit-code/checks/dependencies.ts
// Dependencies dimension: top-level deps declared in package.json but never
// imported anywhere in src/scripts/seeds.

import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { buildFinding, type Finding } from '../findings.ts'
import { PROJECT_ROOT, SRC_DIRS, scanForPattern } from '../scan.ts'

export async function checkDependencies(): Promise<Finding[]> {
  const out: Finding[] = []
  const pkgPath = join(PROJECT_ROOT, 'package.json')
  let pkg: { dependencies?: Record<string, string>; devDependencies?: Record<string, string> }
  try {
    pkg = JSON.parse(await readFile(pkgPath, 'utf8'))
  } catch {
    return out
  }

  const declared = Object.keys(pkg.dependencies ?? {})
  // devDeps are expected to be build-only; only flag runtime deps that are unused.
  for (const dep of declared) {
    // Skip meta-packages that are referenced by config, not import.
    if (dep === 'zod' || dep === 'ulid' || dep === 'alasql') {
      // still verify, but these are commonly used; only flag if truly absent
    }
    const importRe = new RegExp(`(?:from|import)\\s+['"]${dep.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:/[^'"]*)?['"]`)
    const matches = await scanForPattern(PROJECT_ROOT, SRC_DIRS, importRe)
    if (matches.length === 0) {
      out.push(
        buildFinding({
          priority: 'P2',
          dimension: 'dependencies',
          title: `Unused dependency: ${dep}`,
          description: `Declared in package.json dependencies but never imported in src/scripts/seeds.`,
          file: 'package.json',
          line: 1,
          evidence: `"${dep}": "${pkg.dependencies?.[dep] ?? ''}"`,
          impact: 'Unnecessary install size and supply-chain surface.',
          fixSummary: 'Remove the dependency if it is genuinely unused, or add the missing import.',
          fixSteps: [
            'Confirm the package is not used transitively via config.',
            'If unused, remove it from package.json and reinstall.',
          ],
          effort: 'S',
          autoFixable: false,
        }),
      )
    }
  }

  return out
}
