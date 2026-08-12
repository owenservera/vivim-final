// devops/audit-code/fix.ts
// Debug/fix-instructed outputs: render a finding's fix block and (opt-in)
// apply *safe* auto-fixable findings.

import { readFile, writeFile } from 'node:fs/promises'
import { isAbsolute, join } from 'node:path'
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

// Constrained, safe applier. Only acts on autoFixable findings whose recipe
// is a recognised safe directive:
//   - kind "remove-line" -> replace the offending line with the engine's
//     patchedSnippet (an audit comment). The comment replaces the code, so the
//     line's semantics are gone — that is the intended removal.
//   - kind "insert-log" -> keep the offending line VERBATIM and append the
//     remaining directive lines (the audit log comment) after it. The first
//     directive line must match the file's line (modulo leading whitespace).
//   - patchSuggestion starts with "export " -> append the export to the file
export async function applyFix(f: Finding): Promise<{ ok: boolean; reason: string }> {
  if (!f.fix.autoFixable) {
    return { ok: false, reason: 'Finding is not marked autoFixable; apply manually.' }
  }
  if (!f.fix.patchSuggestion) {
    return { ok: false, reason: 'No safe patch directive available.' }
  }
  const abs = isAbsolute(f.file) ? f.file : join(PROJECT_ROOT, f.file)
  let content: string
  try {
    content = await readFile(abs, 'utf8')
  } catch {
    return { ok: false, reason: `Cannot read ${f.file}` }
  }
  const lines = content.split('\n')
  const directive = f.fix.patchSuggestion.trimEnd()

  if (f.fix.kind === 'remove-line') {
    if (f.line < 1 || f.line > lines.length) {
      return { ok: false, reason: 'Line number out of range.' }
    }
    const replacement = directive.trim()
    const isAuditComment = replacement.startsWith('//')
    if (!isAuditComment) {
      return { ok: false, reason: 'remove-line directive must be an audit comment.' }
    }
    const indent = /^\s*/.exec(lines[f.line - 1])?.[0] ?? ''
    lines[f.line - 1] = indent + replacement
    await writeFile(abs, lines.join('\n'), 'utf8')
    return { ok: true, reason: `Replaced line ${f.line} in ${f.file} with audit comment` }
  }

  if (f.fix.kind === 'insert-log') {
    if (f.line < 1 || f.line > lines.length) {
      return { ok: false, reason: 'Line number out of range.' }
    }
    const currentLine = lines[f.line - 1]
    const directiveLines = directive.split('\n')
    // Safety: the directive's first line must be the original code line
    // (modulo leading whitespace) so we never mutate code — we only insert.
    if ((directiveLines[0] ?? '').trim() !== currentLine.trim()) {
      return { ok: false, reason: 'insert-log directive does not preserve the original line.' }
    }
    lines.splice(f.line - 1, 1, currentLine, ...directiveLines.slice(1))
    await writeFile(abs, lines.join('\n'), 'utf8')
    return { ok: true, reason: `Inserted audit log after line ${f.line} in ${f.file}` }
  }

  if (directive.startsWith('export ')) {
    lines.push('', directive)
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

/**
 * Batch-apply every auto-fixable finding. Findings are grouped per file and
 * applied in descending line order so earlier edits never invalidate the line
 * numbers of later edits in the same file.
 */
export async function cmdFixAll(
  data: FindingsFile,
  apply: boolean,
): Promise<string> {
  const auto = data.findings.filter((f) => f.fix?.autoFixable)
  if (!apply) {
    return `${auto.length} auto-fixable finding(s) ready to apply. Use --apply to commit them.`
  }
  const byFile = new Map<string, Finding[]>()
  for (const f of auto) {
    const list = byFile.get(f.file) ?? []
    list.push(f)
    byFile.set(f.file, list)
  }

  let ok = 0
  let skipped = 0
  const failReasons = new Map<string, number>()
  const perFile: string[] = []
  for (const [file, list] of byFile) {
    list.sort((a, b) => b.line - a.line)
    let fileOk = 0
    let fileSkip = 0
    for (const f of list) {
      const res = await applyFix(f)
      if (res.ok) {
        ok++
        fileOk++
      } else {
        skipped++
        fileSkip++
        failReasons.set(res.reason, (failReasons.get(res.reason) ?? 0) + 1)
      }
    }
    perFile.push(`  ${file}  -> ${fileOk} applied, ${fileSkip} skipped`)
  }

  const out: string[] = [
    `Applied ${ok}/${auto.length} auto-fixable finding(s) across ${byFile.size} file(s).`,
  ]
  if (skipped > 0) {
    out.push(`Skipped ${skipped}:`)
    for (const [r, n] of failReasons) out.push(`  - ${n} x ${r}`)
  }
  out.push('', 'Per-file:')
  out.push(...perFile)
  return out.join('\n')
}
