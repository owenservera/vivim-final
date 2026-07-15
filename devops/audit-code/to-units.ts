// devops/audit-code/to-units.ts
// Promote P0/P1 findings into atomic-unit *candidates* (mirrors the roadmap
// discovery output). Human approval + merge-gate still required before they
// enter the tracker, so this never mutates docs/atomic on its own.

import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { PROJECT_ROOT } from './scan.ts'
import type { Finding } from './findings.ts'

export interface PromoteResult {
  path: string
  count: number
}

export async function promoteToUnits(findings: Finding[], date: string): Promise<PromoteResult> {
  const candidates = findings.filter((f) => f.priority === 'P0' || f.priority === 'P1')
  const outDir = join(PROJECT_ROOT, 'docs', 'audits')
  const path = join(outDir, `AUDIT-UNITS-${date}.md`)

  const lines: string[] = []
  lines.push(`# Audit-Discovered Unit Candidates — ${date}`)
  lines.push('')
  lines.push(`Generated from \`bun run devops audit-code --to-units\`.`)
  lines.push(`High-priority (P0/P1) findings promoted as candidate units.`)
  lines.push('')
  lines.push('> These are **candidates**. Run the roadmap interview + merge-gate to add them')
  lines.push('> to the tracker. User wins conflicts; auto-merge requires fresh research (< 24h).')
  lines.push('')

  if (candidates.length === 0) {
    lines.push('No P0/P1 findings to promote.')
  } else {
    lines.push(`## Candidates (${candidates.length})`)
    lines.push('')
    for (const f of candidates) {
      lines.push(`### ${f.id} — ${f.title} [${f.priority}]`)
      lines.push('')
      lines.push(`- **Dimension:** ${f.dimension}${f.invariant ? ` (${f.invariant})` : ''}`)
      lines.push(`- **Location:** \`${f.file}:${f.line}\``)
      lines.push(`- **Effort:** ${f.fix.effort}`)
      lines.push(`- **Proposed spec:** ${f.fix.summary}`)
      lines.push(`- **Steps:**`)
      for (const s of f.fix.steps) lines.push(`  - ${s}`)
      lines.push('')
    }
  }

  await writeFile(path, lines.join('\n'), 'utf8')
  return { path, count: candidates.length }
}
