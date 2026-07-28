// devops/fmt.ts
// Scoped formatter: only rewrites files touched in the current unit.
// Safe to run during the loop — unlike `bun run format` (biome check --write
// over the whole repo), which aborts on pre-existing errors in untouched files.

import { spawnSync } from 'node:child_process'
import { getChangedFiles } from './changed.ts'

export function fmt(): void {
  const files = getChangedFiles()
  if (files.length === 0) {
    console.log('devops fmt: no changed .ts files to format')
    return
  }
  const res = spawnSync('bun', ['x', '@biomejs/biome', 'check', '--write', ...files], {
    stdio: 'inherit',
  })
  if (res.status !== 0) {
    console.error('devops fmt: biome reported errors in changed files')
    process.exit(res.status ?? 1)
  }
}
