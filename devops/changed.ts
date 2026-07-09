// devops/changed.ts
// Resolve the set of source files touched in the current unit so that
// `fmt` and the strict gate only operate on what the agent is working on
// (not pre-existing warnings/debt in unrelated files).

import { execSync } from 'node:child_process'

function git(args: string): string[] {
  try {
    return execSync(`git ${args}`, { encoding: 'utf8' })
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean)
  } catch {
    return []
  }
}

// Files that differ from HEAD (staged + unstaged) plus untracked, source only.
export function getChangedFiles(base = 'HEAD'): string[] {
  const tracked = git(`diff --name-only ${base}`)
  const untracked = git('ls-files --others --exclude-standard')
  const seen = new Set<string>()
  const out: string[] = []
  for (const f of [...tracked, ...untracked]) {
    if (!f.endsWith('.ts')) continue
    const norm = f.replace(/\\/g, '/')
    if (seen.has(norm)) continue
    seen.add(norm)
    out.push(norm)
  }
  return out
}
