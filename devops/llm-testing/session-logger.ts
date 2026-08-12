// devops/llm-testing/session-logger.ts
// Sequential findings logger for LLM-as-Human testing sessions.
// Append-only JSONL log that survives context compaction.
//
// Usage:
//   bun run devops llm-testing-log finding --provider=gemini --severity=P0 --category=chrome-launch --detail="..."
//   bun run devops llm-testing-log phase --provider=gemini --phase=discover --status=pass --durationMs=1234
//   bun run devops llm-testing-log decision --provider=gemini --decision="Quote user-agent" --rationale="..."
//   bun run devops llm-testing-log summary --provider=gemini
//   bun run devops llm-testing-log read --provider=gemini

import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const BASE_DIR = join(process.cwd(), '.runtime', 'llm-testing')
const LOG_FILE = join(BASE_DIR, 'session-log.jsonl')

// ── Types ──────────────────────────────────────────────────────────────────

export type Severity = 'P0' | 'P1' | 'P2' | 'P3'

export type FindingCategory =
  | 'chrome-launch'
  | 'chrome-cdp'
  | 'selector'
  | 'parser'
  | 'capability'
  | 'api'
  | 'frontend'
  | 'parity'
  | 'edge-case'
  | 'performance'
  | 'other'

export interface FindingEntry {
  type: 'finding'
  timestamp: string
  provider: string
  severity: Severity
  category: FindingCategory
  detail: string
  file?: string
  line?: number
  fix?: string
  sessionId?: string
}

export interface PhaseEntry {
  type: 'phase'
  timestamp: string
  provider: string
  phase: string
  status: 'pass' | 'fail' | 'skip' | 'error'
  durationMs?: number
  detail?: string
  sessionId?: string
}

export interface DecisionEntry {
  type: 'decision'
  timestamp: string
  provider: string
  decision: string
  rationale: string
  file?: string
  line?: number
  sessionId?: string
}

export interface CapabilityTestEntry {
  type: 'capability_test'
  timestamp: string
  provider: string
  capabilitySlug: string
  status: 'pass' | 'fail' | 'skip' | 'error'
  durationMs?: number
  input?: Record<string, unknown>
  error?: string
  fix?: string
  sessionId?: string
}

export interface ChromeEntry {
  type: 'chrome'
  timestamp: string
  provider: string
  detail: string
  composerSelector?: string
  sendMethod?: string
  enterKeyBroken?: boolean
  streamFormat?: string
  quirks?: string[]
  sessionId?: string
}

export interface SessionSummaryEntry {
  type: 'summary'
  timestamp: string
  provider: string
  totalFindings: number
  p0Count: number
  p1Count: number
  p2Count: number
  p3Count: number
  phasesRun: number
  phasesPassed: number
  capabilitiesTested: number
  capabilitiesPassed: number
  sessionId?: string
}

export type LogEntry =
  | FindingEntry
  | PhaseEntry
  | DecisionEntry
  | CapabilityTestEntry
  | ChromeEntry
  | SessionSummaryEntry

// ── SessionLogger ───────────────────────────────────────────────────────────

export class SessionLogger {
  private provider: string
  private sessionId: string
  private findings: LogEntry[] = []

  constructor(provider: string, sessionId?: string) {
    this.provider = provider
    this.sessionId = sessionId ?? `session_${provider}_${Date.now()}`
    if (!existsSync(BASE_DIR)) mkdirSync(BASE_DIR, { recursive: true })
  }

  /** Log a finding (P0-P3 severity issue discovered during testing) */
  logFinding(input: {
    severity: Severity
    category: FindingCategory
    detail: string
    file?: string
    line?: number
    fix?: string
  }): void {
    const entry: FindingEntry = {
      type: 'finding',
      timestamp: new Date().toISOString(),
      provider: this.provider,
      sessionId: this.sessionId,
      ...input,
    }
    this.append(entry)
  }

  /** Log a phase result (discover, infer, test-selectors, etc.) */
  logPhase(input: {
    phase: string
    status: 'pass' | 'fail' | 'skip' | 'error'
    durationMs?: number
    detail?: string
  }): void {
    const entry: PhaseEntry = {
      type: 'phase',
      timestamp: new Date().toISOString(),
      provider: this.provider,
      sessionId: this.sessionId,
      ...input,
    }
    this.append(entry)
  }

  /** Log a decision (architectural or debugging choice made during testing) */
  logDecision(input: {
    decision: string
    rationale: string
    file?: string
    line?: number
  }): void {
    const entry: DecisionEntry = {
      type: 'decision',
      timestamp: new Date().toISOString(),
      provider: this.provider,
      sessionId: this.sessionId,
      ...input,
    }
    this.append(entry)
  }

  /** Log a capability test result */
  logCapabilityTest(input: {
    capabilitySlug: string
    status: 'pass' | 'fail' | 'skip' | 'error'
    durationMs?: number
    input?: Record<string, unknown>
    error?: string
    fix?: string
  }): void {
    const entry: CapabilityTestEntry = {
      type: 'capability_test',
      timestamp: new Date().toISOString(),
      provider: this.provider,
      sessionId: this.sessionId,
      ...input,
    }
    this.append(entry)
  }

  /** Log Chrome-specific knowledge (selector, send method, quirks) */
  logChrome(input: {
    detail: string
    composerSelector?: string
    sendMethod?: string
    enterKeyBroken?: boolean
    streamFormat?: string
    quirks?: string[]
  }): void {
    const entry: ChromeEntry = {
      type: 'chrome',
      timestamp: new Date().toISOString(),
      provider: this.provider,
      sessionId: this.sessionId,
      ...input,
    }
    this.append(entry)
  }

  /** Generate and log a session summary */
  logSummary(): void {
    const entries = this.readLog().filter(
      (e) => e.provider === this.provider && e.sessionId === this.sessionId
    )

    const findings = entries.filter((e): e is FindingEntry => e.type === 'finding')
    const phases = entries.filter((e): e is PhaseEntry => e.type === 'phase')
    const capTests = entries.filter(
      (e): e is CapabilityTestEntry => e.type === 'capability_test'
    )

    const entry: SessionSummaryEntry = {
      type: 'summary',
      timestamp: new Date().toISOString(),
      provider: this.provider,
      sessionId: this.sessionId,
      totalFindings: findings.length,
      p0Count: findings.filter((f) => f.severity === 'P0').length,
      p1Count: findings.filter((f) => f.severity === 'P1').length,
      p2Count: findings.filter((f) => f.severity === 'P2').length,
      p3Count: findings.filter((f) => f.severity === 'P3').length,
      phasesRun: phases.length,
      phasesPassed: phases.filter((p) => p.status === 'pass').length,
      capabilitiesTested: capTests.length,
      capabilitiesPassed: capTests.filter((c) => c.status === 'pass').length,
    }
    this.append(entry)
  }

  /** Read all log entries */
  readLog(): LogEntry[] {
    if (!existsSync(LOG_FILE)) return []
    const lines = readFileSync(LOG_FILE, 'utf8').split('\n').filter(Boolean)
    return lines.map((line) => JSON.parse(line) as LogEntry)
  }

  /** Read log entries for this provider/session */
  readOwn(): LogEntry[] {
    return this.readLog().filter(
      (e) => e.provider === this.provider && e.sessionId === this.sessionId
    )
  }

  /** Generate a markdown summary (all entries for this provider across sessions) */
  generateMarkdown(): string {
    const entries = this.readLog().filter((e) => e.provider === this.provider)
    const findings = entries.filter((e): e is FindingEntry => e.type === 'finding')
    const phases = entries.filter((e): e is PhaseEntry => e.type === 'phase')
    const decisions = entries.filter((e): e is DecisionEntry => e.type === 'decision')
    const capTests = entries.filter(
      (e): e is CapabilityTestEntry => e.type === 'capability_test'
    )
    const chrome = entries.filter((e): e is ChromeEntry => e.type === 'chrome')

    const lines: string[] = []
    lines.push(`# Session Report: ${this.provider}`)
    lines.push(``)
    lines.push(`**Session**: ${this.sessionId}`)
    lines.push(`**Date**: ${new Date().toISOString()}`)
    lines.push(`**Provider**: ${this.provider}`)
    lines.push(``)

    // Findings summary
    lines.push(`## Findings`)
    lines.push(``)
    lines.push(`| Severity | Count |`)
    lines.push(`|----------|-------|`)
    lines.push(`| P0 (Blocker) | ${findings.filter((f) => f.severity === 'P0').length} |`)
    lines.push(`| P1 (Degraded) | ${findings.filter((f) => f.severity === 'P1').length} |`)
    lines.push(`| P2 (Cosmetic) | ${findings.filter((f) => f.severity === 'P2').length} |`)
    lines.push(`| P3 (Info) | ${findings.filter((f) => f.severity === 'P3').length} |`)
    lines.push(``)

    if (findings.length > 0) {
      lines.push(`### Findings Detail`)
      lines.push(``)
      for (const f of findings) {
        lines.push(`- **[${f.severity}]** ${f.category}: ${f.detail}`)
        if (f.file) lines.push(`  - File: ${f.file}${f.line ? `:${f.line}` : ''}`)
        if (f.fix) lines.push(`  - Fix: ${f.fix}`)
      }
      lines.push(``)
    }

    // Phase results
    if (phases.length > 0) {
      lines.push(`## Phases`)
      lines.push(``)
      lines.push(`| Phase | Status | Duration |`)
      lines.push(`|-------|--------|----------|`)
      for (const p of phases) {
        const dur = p.durationMs ? `${p.durationMs}ms` : '-'
        lines.push(`| ${p.phase} | ${p.status} | ${dur} |`)
      }
      lines.push(``)
    }

    // Capability tests
    if (capTests.length > 0) {
      lines.push(`## Capability Tests`)
      lines.push(``)
      lines.push(`| Capability | Status | Duration |`)
      lines.push(`|------------|--------|----------|`)
      for (const c of capTests) {
        const dur = c.durationMs ? `${c.durationMs}ms` : '-'
        lines.push(`| ${c.capabilitySlug} | ${c.status} | ${dur} |`)
      }
      lines.push(``)
    }

    // Chrome knowledge
    if (chrome.length > 0) {
      lines.push(`## Chrome / CDP Knowledge`)
      lines.push(``)
      for (const c of chrome) {
        lines.push(`- ${c.detail}`)
        if (c.composerSelector) lines.push(`  - Composer: \`${c.composerSelector}\``)
        if (c.sendMethod) lines.push(`  - Send: ${c.sendMethod}`)
        if (c.enterKeyBroken) lines.push(`  - Enter key: broken`)
        if (c.streamFormat) lines.push(`  - Stream: ${c.streamFormat}`)
        if (c.quirks?.length) lines.push(`  - Quirks: ${c.quirks.join(', ')}`)
      }
      lines.push(``)
    }

    // Decisions
    if (decisions.length > 0) {
      lines.push(`## Decisions`)
      lines.push(``)
      for (const d of decisions) {
        lines.push(`- **${d.decision}**`)
        lines.push(`  - Rationale: ${d.rationale}`)
        if (d.file) lines.push(`  - File: ${d.file}${d.line ? `:${d.line}` : ''}`)
      }
      lines.push(``)
    }

    return lines.join('\n')
  }

  private append(entry: LogEntry): void {
    this.findings.push(entry)
    appendFileSync(LOG_FILE, JSON.stringify(entry) + '\n', 'utf8')
  }
}

// ── CLI Entry Point ─────────────────────────────────────────────────────────

function parseArgs(argv: string[]): Record<string, string> {
  const args: Record<string, string> = {}
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i]
    if (arg.startsWith('--')) {
      const [key, ...rest] = arg.slice(2).split('=')
      args[key] = rest.length > 0 ? rest.join('=') : argv[i + 1] ?? ''
      if (rest.length === 0) i++ // consume next arg as value
    } else if (!args._subcommand) {
      args._subcommand = arg
    }
  }
  return args
}

export async function mainCli(argv: string[] = process.argv): Promise<void> {
  const args = parseArgs(argv)
  const subcommand = args._subcommand
  const provider = args.provider ?? 'unknown'

  if (!subcommand || subcommand === 'help') {
    // [audit] removed: console.log(`
Usage: bun run devops llm-testing-log <subcommand> [options]

Subcommands:
  finding    Log a P0-P3 finding
  phase      Log a phase result
  decision   Log an architectural decision
  capability Log a capability test result
  chrome     Log Chrome/CDP knowledge
  summary    Generate session summary
  read       Read all log entries
  markdown   Generate markdown report

Common Options:
  --provider=<slug>    Provider name (required)
  --sessionId=<id>     Session ID (default: auto-generated)

Finding Options:
  --severity=<P0-P3>   Severity level
  --category=<cat>     Category (chrome-launch, parser, capability, etc.)
  --detail=<text>      Finding description
  --file=<path>        Source file
  --line=<number>      Line number
  --fix=<text>         Suggested fix

Phase Options:
  --phase=<name>       Phase name (discover, infer, test-selectors, etc.)
  --status=<status>    pass, fail, skip, error
  --durationMs=<ms>    Duration in milliseconds

Decision Options:
  --decision=<text>    Decision made
  --rationale=<text>   Why this decision

Capability Options:
  --capabilitySlug=<slug>  Capability slug
  --status=<status>        pass, fail, skip, error
  --durationMs=<ms>        Duration
  --error=<text>           Error message
  --fix=<text>             Suggested fix
`)
    return
  }

  const logger = new SessionLogger(provider, args.sessionId)

  switch (subcommand) {
    case 'finding': {
      if (!args.severity || !args.category || !args.detail) {
        // [audit] removed: console.error('Error: --severity, --category, and --detail are required')
        process.exit(1)
      }
      logger.logFinding({
        severity: args.severity.toUpperCase() as Severity,
        category: args.category as FindingCategory,
        detail: args.detail,
        file: args.file,
        line: args.line ? Number.parseInt(args.line, 10) : undefined,
        fix: args.fix,
      })
      // [audit] removed: console.log(`Finding logged: [${args.severity}] ${args.category}: ${args.detail}`)
      break
    }

    case 'phase': {
      if (!args.phase || !args.status) {
        // [audit] removed: console.error('Error: --phase and --status are required')
        process.exit(1)
      }
      logger.logPhase({
        phase: args.phase,
        status: args.status as 'pass' | 'fail' | 'skip' | 'error',
        durationMs: args.durationMs ? Number.parseInt(args.durationMs, 10) : undefined,
        detail: args.detail,
      })
      // [audit] removed: console.log(`Phase logged: ${args.phase} = ${args.status}`)
      break
    }

    case 'decision': {
      if (!args.decision || !args.rationale) {
        // [audit] removed: console.error('Error: --decision and --rationale are required')
        process.exit(1)
      }
      logger.logDecision({
        decision: args.decision,
        rationale: args.rationale,
        file: args.file,
        line: args.line ? Number.parseInt(args.line, 10) : undefined,
      })
      // [audit] removed: console.log(`Decision logged: ${args.decision}`)
      break
    }

    case 'capability': {
      if (!args.capabilitySlug || !args.status) {
        // [audit] removed: console.error('Error: --capabilitySlug and --status are required')
        process.exit(1)
      }
      logger.logCapabilityTest({
        capabilitySlug: args.capabilitySlug,
        status: args.status as 'pass' | 'fail' | 'skip' | 'error',
        durationMs: args.durationMs ? Number.parseInt(args.durationMs, 10) : undefined,
        error: args.error,
        fix: args.fix,
      })
      // [audit] removed: console.log(`Capability test logged: ${args.capabilitySlug} = ${args.status}`)
      break
    }

    case 'chrome': {
      if (!args.detail) {
        // [audit] removed: console.error('Error: --detail is required')
        process.exit(1)
      }
      logger.logChrome({
        detail: args.detail,
        composerSelector: args.composerSelector,
        sendMethod: args.sendMethod,
        enterKeyBroken: args.enterKeyBroken === 'true',
        streamFormat: args.streamFormat,
        quirks: args.quirks?.split(','),
      })
      // [audit] removed: console.log(`Chrome knowledge logged: ${args.detail}`)
      break
    }

    case 'summary': {
      logger.logSummary()
      // [audit] removed: console.log('Summary logged to session-log.jsonl')
      break
    }

    case 'read': {
      // Read ALL entries for this provider across all sessions
      const entries = logger.readLog().filter((e) => e.provider === provider)
      if (entries.length === 0) {
        // [audit] removed: console.log(`No entries found for provider=${provider}`)
      } else {
        for (const e of entries) {
          // [audit] removed: console.log(JSON.stringify(e))
        }
      }
      break
    }

    case 'markdown': {
      const md = logger.generateMarkdown()
      // Write to a file too
      const mdPath = join(BASE_DIR, `session-${provider}-${Date.now()}.md`)
      writeFileSync(mdPath, md, 'utf8')
      // [audit] removed: console.log(md)
      // [audit] removed: console.log(`\nWritten to: ${mdPath}`)
      break
    }

    default:
      // [audit] removed: console.error(`Unknown subcommand: ${subcommand}`)
      process.exit(1)
  }
}

// Run if invoked directly (not imported as library)
if (import.meta.url === `file://${process.argv[1]}`) {
  mainCli().catch((e) => {
    // [audit] removed: console.error(e)
    process.exit(1)
  })
}
