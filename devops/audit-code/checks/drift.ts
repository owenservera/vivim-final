// devops/audit-code/checks/drift.ts
// Drift dimension (deep/full): incomplete implementations (stub/mixed files)
// and engines not exported from the public barrel (D4). Reuses the truth
// scanner for REAL/STUB/MIXED classification.

import { readFile } from 'node:fs/promises'
import { join, relative } from 'node:path'
import { buildFinding, type Finding } from '../findings.ts'
import { PROJECT_ROOT, walkTs } from '../scan.ts'
import { scanRoot, type FileReport } from '../../truth/scanner.ts'

export async function checkDrift(): Promise<Finding[]> {
  const out: Finding[] = []

  // 1. Incomplete implementations (STUB / MIXED) flagged by the truth scanner.
  const result = await scanRoot(PROJECT_ROOT)
  for (const f of result.files as FileReport[]) {
    if (f.classification === 'STUB' || f.classification === 'MIXED') {
      out.push(
        buildFinding({
          priority: 'P2',
          dimension: 'drift',
          title: `Incomplete implementation: ${f.relativePath}`,
          description: `Truth scanner classifies this file as ${f.classification} (${f.stubCount} stub marker(s)). The code has not caught up to its spec intent.`,
          file: f.relativePath,
          line: 1,
          evidence: (f.stubMarkers[0] ?? 'stub markers present'),
          impact: 'Feature gaps surface only at runtime; breaks the gate-before-done guarantee.',
          fixSummary: 'Complete the stubbed methods against the atomic spec.',
          fixSteps: [
            'Open the atomic spec for this module.',
            'Implement each stub marker with real logic.',
            'Add a unit test proving the method.',
          ],
          effort: 'L',
          autoFixable: false,
        }),
      )
    }
  }

  // 2. Engines not exported from the public barrel (D4).
  const enginesDir = join(PROJECT_ROOT, 'src', 'engines')
  const indexTs = join(PROJECT_ROOT, 'src', 'index.ts')
  let engineFiles: string[]
  let indexContent = ''
  try {
    engineFiles = await walkTs(enginesDir, PROJECT_ROOT)
    indexContent = await readFile(indexTs, 'utf8')
  } catch {
    return out
  }
  for (const ef of engineFiles) {
    const base = ef.split(/[\\/]/).pop()!.replace(/\.ts$/, '')
    const isClass = /export\s+(?:class|abstract class)\s+/.test(
      await readFile(ef, 'utf8').catch(() => ''),
    )
    if (!isClass) continue
    if (!indexContent.includes(base)) {
      out.push(
        buildFinding({
          priority: 'P2',
          dimension: 'drift',
          invariant: 'D4',
          title: `Engine not exported from barrel: ${base}`,
          description: 'Engine class is not re-exported from src/index.ts, so it is not part of the public API.',
          file: relative(PROJECT_ROOT, ef),
          line: 1,
          evidence: `missing export in src/index.ts`,
          impact: 'Consumers (and tests) cannot import the engine via the barrel.',
          fixSummary: `Add \`export { <ClassName> } from './engines/${base}.js'\` to src/index.ts.`,
          fixSteps: ['Add the export line to src/index.ts.', 'Re-run gate to confirm it typechecks.'],
          effort: 'S',
          autoFixable: true,
        }),
      )
    }
  }

  return out
}
