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
 * Parsed devops CLI command tree, derived directly from `devops/index.ts`
 * (the single source of truth). Replaces a hand-maintained allowlist that
 * drifted (it listed fictional commands like `speckit`, `ui-test`,
 * `automerge`, `shell-completions`, `research` and omitted real ones like
 * `features`, `production-build`, and the `agentic` / `runtime-test onboard`
 * dispatchers). The verifier is now self-correcting: any command added to
 * index.ts is automatically recognized.
 *
 * Structure: `Map<group, Set<subcommand>>`. A group with an empty subcommand
 * set accepts no second token (or is a leaf command with no subcommands).
 */
export interface CliTree {
  groups: Map<string, Set<string>>
}

/**
 * Brace-aware scan of `devops/index.ts`. The first `switch (...)` in the file
 * is treated as the main dispatcher. Cases at the main-switch body depth are
 * top-level command groups; cases nested deeper (inside a group's own
 * `switch`) are subcommands of the most recently seen group.
 */
export function parseCliTree(indexTsPath?: string): CliTree {
  const path = indexTsPath ?? join(process.cwd(), 'devops', 'index.ts')
  const src = readFileSync(path, 'utf8')
  const groups = new Map<string, Set<string>>()

  let braceDepth = 0
  let mainSwitchDepth = -1
  let currentGroup: string | null = null

  // Tokenize significant lexemes in file order.
  const tokenRe =
    /(\bswitch\s*\()|(case\s+'([^']+)':)|(case\s+"([^"]+)":)|(default\s*:)|(\{)|(\})/g
  let m = tokenRe.exec(src)
  while (m !== null) {
    if (m[1] !== undefined) {
      // `switch (`
      if (mainSwitchDepth === -1) {
        // First switch → main dispatcher. Its body opens at braceDepth+1.
        mainSwitchDepth = braceDepth + 1
      }
    } else if (m[7] !== undefined) {
      braceDepth++
    } else if (m[8] !== undefined) {
      braceDepth--
      // Leaving a group's body → forget current group so sibling groups don't
      // inherit each other's subcases.
      if (braceDepth < mainSwitchDepth && currentGroup !== null) {
        currentGroup = null
      }
    } else if (m[6] !== undefined) {
      // `default:` — not a command group.
    } else if (m[2] !== undefined || m[4] !== undefined) {
      const name = m[3] ?? m[5]
      if (braceDepth === mainSwitchDepth) {
        // Top-level group.
        if (!groups.has(name)) groups.set(name, new Set())
        currentGroup = name
      } else if (currentGroup !== null && braceDepth > mainSwitchDepth) {
        // Subcommand of the current group.
        groups.get(currentGroup)?.add(name)
      }
    }
    m = tokenRe.exec(src)
  }

  return { groups }
}

// Backwards-compatible accessor used by verifySkillCliDrift.
function getKnownCommands(): Record<string, string[]> {
  const tree = parseCliTree()
  const out: Record<string, string[]> = {}
  for (const [group, subs] of tree.groups) out[group] = [...subs]
  return out
}
const KNOWN_COMMANDS = getKnownCommands()

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
