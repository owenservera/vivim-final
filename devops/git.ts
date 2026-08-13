// devops/git.ts
// Thin, testable adapter over the git operations the devops tooling needs.
//
// All VCS side-effects live here so domain logic (mark.ts) stays pure and
// unit-testable. A module-level `dryRun` flag makes every mutating call a
// no-op that logs what *would* happen — used by `devops mark --dry-run` and
// `devops run --dry-run` so the loop can be previewed without touching the
// repo.

import { execSync } from 'node:child_process'

let dryRun = false

export function setDryRun(on: boolean): void {
  dryRun = on
}

export function isDryRun(): boolean {
  return dryRun
}

function git(args: string, inherit = false): string {
  if (dryRun && !args.startsWith('rev-parse') && !args.startsWith('write-tree')) {
    console.log(`[git:dry-run] git ${args}`)
    return ''
  }
  return execSync(`git ${args}`, { encoding: 'utf8', stdio: inherit ? 'inherit' : 'pipe' }).trim()
}

/** Stage everything (respects .gitignore via `git add -A`). */
export function addAll(): void {
  git('add -A', true)
}

/** Create a real commit; returns the short sha. */
export function commit(message: string): string {
  git(`commit -m "${message.replace(/"/g, '\\"')}"`, true)
  return headShort()
}

/** Current HEAD short sha. */
export function headShort(): string {
  return git('rev-parse --short HEAD')
}

/** Current HEAD full sha. */
export function headFull(): string {
  return git('rev-parse HEAD')
}

/** Write the current index to a tree object; returns the tree sha. */
export function writeTree(): string {
  return git('write-tree')
}

/** Create a commit object from a tree + parent without moving any ref. */
export function commitTree(tree: string, parent: string, message: string): string {
  return git(`commit-tree ${tree} -p ${parent} -m "${message.replace(/"/g, '\\"')}"`)
}

/** Point HEAD at an arbitrary commit (soft reset — preserves working tree + index). */
export function resetSoft(sha: string): void {
  git(`reset --soft ${sha}`, true)
}
