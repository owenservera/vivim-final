// devops/audit-code/checks/testing.ts
// Testing dimension: engines with no corresponding unit test (D1).

import { readdir, stat } from 'node:fs/promises'
import { join, relative } from 'node:path'
import { buildFinding, type Finding } from '../findings.ts'
import { PROJECT_ROOT, walkTs } from '../scan.ts'

export async function checkTesting(): Promise<Finding[]> {
  const out: Finding[] = []
  const enginesDir = join(PROJECT_ROOT, 'src', 'engines')
  const testsDir = join(PROJECT_ROOT, 'tests', 'unit')

  let engineFiles: string[]
  try {
    engineFiles = await walkTs(enginesDir, PROJECT_ROOT)
  } catch {
    return out
  }

  // Build a set of test file stems (minus .test / .spec) for quick lookup.
  let testStems = new Set<string>()
  try {
    const testFiles = await walkTs(testsDir, PROJECT_ROOT)
    for (const t of testFiles) {
      const base = t.split(/[\\/]/).pop()!.replace(/\.(test|spec)\.ts$/, '')
      testStems.add(base)
    }
  } catch {
    testStems = new Set()
  }

  for (const ef of engineFiles) {
    const base = ef.split(/[\\/]/).pop()!.replace(/\.ts$/, '')
    if (testStems.has(base)) continue
    out.push(
      buildFinding({
        priority: 'P1',
        dimension: 'testing',
        invariant: 'D1',
        title: `Engine has no unit test: ${base}`,
        description: `No test file matches the engine module ${base}. Engines require unit-test coverage.`,
        file: relative(PROJECT_ROOT, ef),
        line: 1,
        evidence: `missing tests/unit/${base}.test.ts`,
        impact: 'Regressions in engine logic go undetected by the gate.',
        fixSummary: `Add tests/unit/${base}.test.ts with mocked store contract.`,
        fixSteps: [
          'Create tests/unit/${base}.test.ts.',
          'Mock the Store Contract the engine depends on.',
          'Cover the Interface + Store Contract + Test Contract from the atomic spec.',
        ],
        effort: 'M',
        autoFixable: false,
      }),
    )
  }

  return out
}
