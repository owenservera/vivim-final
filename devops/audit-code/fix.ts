// devops/audit-code/fix.ts
// Debug/fix-instructed outputs: render a finding's fix block and (opt-in)
// apply *safe* auto-fixable findings.

import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { PROJECT_ROOT } from './scan.ts'
import type { Finding, FindingsFile } from './findings.ts'

export function renderFix(f: Finding): string {
  const lines: string[] = []
  lines.push(`# Fix — ${f.id} [${f.priority}] ${f.title}`)
  lines.push('')
  lines.push(`- **Location:** \`${f.file}:${f.line}\``)
  lines.push(`- **Impact:** ${f.impact}`)
  lines.push('')
  lines.push('## Fix Instructions')
  lines.push('')
  lines.push(f.fix.summary)
  lines.push('')
  f.fix.steps.forEach((s, i) => lines.push(`${i + 1}. ${s}`))
  lines.push('')
  lines.push(`- **Effort:** ${f.fix.effort}`)
  lines.push(`- **Auto-fixable:** ${f.fix.autoFixable ? 'yes' : 'no'}`)
  if (f.fix.patchSuggestion) {
    lines.push('')
    lines.push('## Patch suggestion')
    lines.push('')
    lines.push('```ts')
    lines.push(f.fix.patchSuggestion)
    lines.push('```')
  }
  return lines.join('\n')
}

function findById(findings: Finding[], id: string): Finding | undefined {
  return findings.find((f) => f.id === id)
}

// Constrained, safe applier. Only acts on autoFixable findings whose
// patchSuggestion is a recognised safe directive:
//   - "// remove this line"  -> delete the offending line
//   - starts with "export "  -> append the export to the file
export async function applyFix(f: Finding): Promise<{ ok: boolean; reason: string }> {
  if (!f.fix.autoFixable) {
    return { ok: false, reason: 'Finding is not marked autoFixable; apply manually.' }
  }
  if (!f.fix.patchSuggestion) {
    return { ok: false, reason: 'No safe patch directive available.' }
  }
  const abs = join(PROJECT_ROOT, f.file)
  let content: string
  try {
    content = await readFile(abs, 'utf8')
  } catch {
    return { ok: false, reason: `Cannot read ${f.file}` }
  }
  const lines = content.split('\n')

  if (f.fix.patchSuggestion.trim().startsWith('// remove')) {
    if (f.line < 1 || f.line > lines.length) {
      return { ok: false, reason: 'Line number out of range.' }
    }
    lines.splice(f.line - 1, 1)
    await writeFile(abs, lines.join('\n'), 'utf8')
    return { ok: true, reason: `Removed line ${f.line} in ${f.file}` }
  }

  if (f.fix.patchSuggestion.trim().startsWith('export ')) {
    lines.push('', f.fix.patchSuggestion.trim())
    await writeFile(abs, lines.join('\n'), 'utf8')
    return { ok: true, reason: `Appended export to ${f.file}` }
  }

  return { ok: false, reason: 'Patch directive not recognised as safe.' }
}

export async function cmdFix(
  data: FindingsFile,
  id: string,
  apply: boolean,
): Promise<string> {
  const f = findById(data.findings, id)
  if (!f) return `Finding ${id} not found in the last audit run.`
  if (!apply) {
    return renderFix(f)
  }
  const res = await applyFix(f)
  return `apply ${id}: ${res.ok ? 'OK' : 'SKIPPED'} — ${res.reason}`
}
