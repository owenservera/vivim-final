import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

interface DriftIssue {
  type: 'missing-from-cli'
  command: string
  skillFile: string
  skillLine: string
  suggestion: string
}

/**
 * Known valid devops CLI command tree — the source of truth.
 * Synced with devops/index.ts dispatch.
 */
const KNOWN_COMMANDS: Record<string, string[]> = {
  // Top-level
  select: [],
  mark: [],
  gate: [],
  fmt: [],
  run: [],
  audit: [],
  gc: [],
  report: [],
  truth: [],
  roadmap: [],
  research: [],
  invariants: [],
  context: [],
  'audit-arch': [],
  'audit-code': [],
  'verify-cross-surface': [],
  'discover-protocol': [],
  automerge: [],
  'shell-completions': [],

  // agentic { ... }
  agentic: ['start', 'resume', 'done', 'status', 'probe', 'preflight', 'reset', 'adopt'],

  // runtime-test { ... }
  'runtime-test': [
    'bootstrap', 'preflight', 'engage', 'discover-backend', 'discover-frontend',
    'test-cap', 'discover-cdp', 'stop', 'status', 'report', 'catalog-gen',
    'migrate', 'ensure-browser', 'watchdog', 'guard', 'discover-protocol',
    'test', 'debug', 'build', 'loop', 'setup', 'health', 'discover',
    'selectors', 'verify', 'verify-pipeline', 'onboard',
  ],

  // decision { ... }
  decision: ['create', 'show', 'compare', 'list', 'review', 'prompt', 'prompt-review', 'decide', 'approve', 'reject', 'analyze'],

  // goals { ... }
  goals: ['list', 'show', 'create', 'update', 'progress', 'align', 'score', 'report', 'dashboard'],

  // speckit { ... }
  speckit: ['map-task', 'map-unit', 'sync', 'sync-feature', 'sync-unit', 'sync-all', 'validate', 'gate', 'find-brief', 'export-brief', 'import-research', 'audit', 'converge', 'help'],

  // ui-test { ... }
  'ui-test': ['list', 'status', 'record'],

  // automate { ... }
  automate: [],
}

/** Recursively find all SKILL.md files under .opencode/skill/ */
function findSkillFiles(): string[] {
  const root = join(process.cwd(), '.opencode', 'skill')
  const results: string[] = []
  function walk(dir: string) {
    let entries: string[]
    try { entries = readdirSync(dir) } catch { return }
    for (const entry of entries) {
      const full = join(dir, entry)
      try {
        if (statSync(full).isDirectory()) walk(full)
        else if (entry === 'SKILL.md') results.push(full)
      } catch { /* skip */ }
    }
  }
  walk(root)
  return results
}

/** Extract `bun run devops <cmd>` references from a string */
function extractRefs(line: string): string[] {
  const refs: string[] = []

  // `bun run devops <arg> <arg>`
  const btMatches = line.matchAll(/`bun run devops\s+([a-z][a-z0-9_-]+(?:\s+[a-z][a-z0-9_-]+)*)`/g)
  for (const m of btMatches) refs.push(m[1])

  // also match `bunx devops`
  const bxMatches = line.matchAll(/`bunx devops\s+([a-z][a-z0-9_-]+(?:\s+[a-z][a-z0-9_-]+)*)`/g)
  for (const m of bxMatches) refs.push(m[1])

  // also match without backticks
  const rawMatches = line.matchAll(/\bbun run devops\s+([a-z][a-z0-9_-]+(?:\s+[a-z][a-z0-9_-]+)*)\b/g)
  for (const m of rawMatches) {
    const ref = m[1]
    // only add if not already captured via backtick
    if (!refs.includes(ref)) refs.push(ref)
  }

  return refs
}

/**
 * Verify that every `bun run devops <cmd>` in skill files corresponds to
 * a known CLI command group + subcommand.
 */
export function verifySkillCliDrift(): DriftIssue[] {
  const issues: DriftIssue[] = []
  const skillFiles = findSkillFiles()

  for (const skillPath of skillFiles) {
    const src = readFileSync(skillPath, 'utf8')
    const lines = src.split('\n')

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      const refs = extractRefs(line)
      if (refs.length === 0) continue

      for (const ref of refs) {
        const parts = ref.split(/\s+/)
        const group = parts[0]
        const sub = parts[1]

        if (!KNOWN_COMMANDS[group]) {
          issues.push({
            type: 'missing-from-cli',
            command: ref,
            skillFile: skillPath,
            skillLine: line.trim(),
            suggestion: `'${group}' is not a known devops CLI group`,
          })
          continue
        }

        if (sub && KNOWN_COMMANDS[group].length > 0 && !KNOWN_COMMANDS[group].includes(sub)) {
          issues.push({
            type: 'missing-from-cli',
            command: ref,
            skillFile: skillPath,
            skillLine: line.trim(),
            suggestion: `known subcommands for '${group}': ${KNOWN_COMMANDS[group].join(', ')}`,
          })
        }
      }
    }
  }

  return issues
}

// Run directly
if (process.argv[1]?.endsWith('skill-cli-verifier.ts')) {
  const issues = verifySkillCliDrift()
  if (issues.length === 0) {
    console.log('OK — No skill↔CLI drift detected')
    process.exit(0)
  } else {
    console.error(`Found ${issues.length} drift issue(s) in skill files:\n`)
    for (const issue of issues) {
      console.error(`  [MISSING] ${issue.command}`)
      console.error(`           file: ${issue.skillFile}`)
      console.error(`           line: ${issue.skillLine}`)
      console.error(`           hint: ${issue.suggestion}`)
      console.error('')
    }
    process.exit(1)
  }
}
