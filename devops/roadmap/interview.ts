// devops/roadmap/interview.ts
// Interview Protocol — human-AI conversation to refine discovered units
// into proper atomic specs.
//
// The interview:
//   1. AI presents discovered unit candidate
//   2. AI asks contextualizing questions
//   3. User answers (or says "skip" / "not needed")
//   4. AI synthesizes into atomic spec draft
//   5. User reviews spec draft
//   6. If approved → add to atomic list (via merge gate)
//
// Interactive workflow:
//   1. Call generateInterviewQuestions(gapId) → returns questions + unit context
//   2. Present questions to user, collect answers
//   3. Call synthesizeInterview(gapId, answers, decision) → writes spec + log

import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import type { DiscoveredUnit } from './discover.ts'

const PROJECT_ROOT = join(import.meta.dir, '..', '..')
const INTERVIEW_LOG_DIR = join(PROJECT_ROOT, 'docs', 'roadmap')

// ── Types ─────────────────────────────────────────────────────────────────

export interface InterviewEntry {
  gapId: string
  timestamp: string
  questions: string[]
  answers: string[]
  decision: 'approved' | 'rejected' | 'deferred'
  spec?: string
  notes: string
}

export interface InterviewLog {
  entries: InterviewEntry[]
}

export interface InterviewQuestions {
  unit: DiscoveredUnit
  questions: string[]
}

// ── Question templates ────────────────────────────────────────────────────

function generateQuestions(unit: DiscoveredUnit): string[] {
  const questions: string[] = []

  // Core purpose
  questions.push(`What should "${unit.suggestedUnit}" do?`)

  // Interface
  questions.push('What is the expected interface? (method names, params, return types)')

  // Dependencies
  questions.push('What dependencies does it have? (other units, external libs)')

  // Source
  if (unit.file?.includes('executor')) {
    questions.push('Is this a build against vivim-final core or a new implementation?')
  }

  // Scope
  questions.push('What is the minimum viable implementation? (MVP scope)')

  // Skip conditions
    questions.push('Are there any prior-art-specific concerns to skip? (cookies, singleton locks, etc.)')

  return questions
}

// ── Interactive interview API ──────────────────────────────────────────────

export async function generateInterviewQuestions(gapId: string): Promise<InterviewQuestions> {
  // Load discovered units
  const discoveredPath = join(INTERVIEW_LOG_DIR, 'DISCOVERED-UNITS.md')
  let discoveredContent: string
  try {
    discoveredContent = await readFile(discoveredPath, 'utf8')
  } catch {
    throw new Error('No DISCOVERED-UNITS.md found. Run `bun run devops roadmap --discover` first.')
  }

  // Parse discovered units
  const discovered = parseDiscoveredUnits(discoveredContent)
  const target = discovered.find(d => d.gapId === gapId)

  if (!target) {
    throw new Error(`Gap ${gapId} not found in DISCOVERED-UNITS.md`)
  }

  const questions = generateQuestions(target)

  return { unit: target, questions }
}

export async function synthesizeInterview(
  gapId: string,
  answers: string[],
  decision: 'approved' | 'rejected' | 'deferred',
): Promise<InterviewEntry> {
  // Load discovered units to get context
  const discoveredPath = join(INTERVIEW_LOG_DIR, 'DISCOVERED-UNITS.md')
  let discoveredContent: string
  try {
    discoveredContent = await readFile(discoveredPath, 'utf8')
  } catch {
    throw new Error('No DISCOVERED-UNITS.md found.')
  }

  const discovered = parseDiscoveredUnits(discoveredContent)
  const target = discovered.find(d => d.gapId === gapId)
  if (!target) {
    throw new Error(`Gap ${gapId} not found in DISCOVERED-UNITS.md`)
  }

  const questions = generateQuestions(target)
  const spec = synthesizeSpec(target, questions, answers, decision)

  const entry: InterviewEntry = {
    gapId,
    timestamp: new Date().toISOString(),
    questions,
    answers,
    decision,
    spec,
    notes: '',
  }

  await appendInterviewLog(entry)

  return entry
}

// ── CLI convenience wrapper ────────────────────────────────────────────────

export async function runInterview(gapId: string): Promise<void> {
  const { unit, questions } = await generateInterviewQuestions(gapId)

  console.log(`\n=== Interview for ${gapId}: ${unit.summary} ===\n`)
  console.log('AI will ask questions. Answer each one, or type "skip" to skip.')
  console.log('Type "not needed" to reject this unit entirely.\n')

  for (let i = 0; i < questions.length; i++) {
    console.log(`Q${i + 1}: ${questions[i]}`)
  }

  console.log('\n---')
  console.log('Enter your answers below (one per line, empty line to finish):')
  console.log('Format: A1: <answer>, A2: <answer>, etc.\n')

  // Placeholder answers for non-interactive use
  const answers: string[] = []
  for (let i = 0; i < questions.length; i++) {
    answers.push(`[Answer to Q${i + 1} — implement in CLI]`)
  }

  const decision = answers.some(a => a.toLowerCase() === 'not needed')
    ? 'rejected'
    : answers.some(a => a.toLowerCase() === 'skip')
    ? 'deferred'
    : 'approved'

  const entry = await synthesizeInterview(gapId, answers, decision)

  console.log(`\n=== Interview Complete ===`)
  console.log(`Decision: ${entry.decision}`)
  if (entry.decision === 'approved') {
    console.log('Spec draft generated. Review and run `bun run devops roadmap --merge-unit <id>` to add to tracker.')
  } else if (entry.decision === 'rejected') {
    console.log('Unit rejected. Not adding to tracker.')
  } else {
    console.log('Unit deferred. Will be revisited later.')
  }
}

// ── Spec synthesis ────────────────────────────────────────────────────────

function synthesizeSpec(
  unit: DiscoveredUnit,
  questions: string[],
  answers: string[],
  decision: 'approved' | 'rejected' | 'deferred',
): string | undefined {
  if (decision !== 'approved') return undefined

  // Build spec from answers
  const lines: string[] = [
    `# Unit [TBD] — ${unit.suggestedUnit}`,
    '',
    `**Phase:** ${unit.suggestedPhase} (TBD)`,
    `**Domain:** ${unit.domain}`,
    `**Source:** ${unit.file ? `Build against vivim-final: ${unit.file}` : 'New implementation'}`,
    `**Effort:** ${unit.effort}`,
    '',
    `## Depends`,
    '',
    unit.suggestedDependencies.length > 0
      ? unit.suggestedDependencies.join(', ')
      : '(none)',
    '',
    `## Interface`,
    '',
    '```typescript',
    `// TODO: Define interface based on interview answers`,
    '```',
    '',
    `## Store Contract`,
    '',
    '```typescript',
    `// TODO: Define store contract if needed`,
    '```',
    '',
    `## Test Contract`,
    '',
    '```typescript',
    `// TODO: Define test contract`,
    '```',
    '',
    `## Gate`,
    '',
    '- [ ] typecheck passes',
    '- [ ] lint passes',
    '- [ ] tests pass',
    '',
    `## Notes`,
    '',
    `Original gap: ${unit.gapId} — ${unit.summary}`,
    '',
    `## Interview Answers`,
    '',
  ]

  for (let i = 0; i < questions.length; i++) {
    lines.push(`**Q${i + 1}:** ${questions[i]}`)
    lines.push(`**A${i + 1}:** ${answers[i]}`)
    lines.push('')
  }

  return lines.join('\n')
}

// ── Interview log persistence ─────────────────────────────────────────────

async function appendInterviewLog(entry: InterviewEntry): Promise<void> {
  const logPath = join(INTERVIEW_LOG_DIR, 'INTERVIEW-LOG.md')
  let content: string

  try {
    content = await readFile(logPath, 'utf8')
  } catch {
    content = '# Interview Log\n\n'
  }

  // Append entry
  const entryContent = [
    `## ${entry.gapId} — ${entry.timestamp}`,
    '',
    `**Decision:** ${entry.decision}`,
    '',
    '### Questions & Answers',
    '',
  ]

  for (let i = 0; i < entry.questions.length; i++) {
    entryContent.push(`**Q${i + 1}:** ${entry.questions[i]}`)
    entryContent.push(`**A${i + 1}:** ${entry.answers[i]}`)
    entryContent.push('')
  }

  if (entry.notes) {
    entryContent.push('### Notes')
    entryContent.push('')
    entryContent.push(entry.notes)
    entryContent.push('')
  }

  entryContent.push('---')
  entryContent.push('')

  content += entryContent.join('\n')
  await writeFile(logPath, content, 'utf8')
}

// ── Parse discovered units from markdown ──────────────────────────────────

function parseDiscoveredUnits(content: string): DiscoveredUnit[] {
  const units: DiscoveredUnit[] = []
  const lines = content.split('\n')

  let current: Partial<DiscoveredUnit> | null = null

  for (const line of lines) {
    // Match table rows: | GAP-001 | chrome-management | ... |
    const tableMatch = line.match(/^\|\s*(GAP-\d+)\s*\|\s*(\w[\w-]*)\s*\|\s*(\w+)\s*\|\s*(.+?)\s*\|\s*(.+?)\s*\|\s*(\w+)\s*\|$/)
    if (tableMatch) {
      if (current?.gapId) {
        units.push(current as DiscoveredUnit)
      }
      current = {
        gapId: tableMatch[1],
        domain: tableMatch[2],
        severity: tableMatch[3] as DiscoveredUnit['severity'],
        summary: tableMatch[4],
        suggestedUnit: tableMatch[5],
        effort: tableMatch[6] as DiscoveredUnit['effort'],
      }
    }
  }

  if (current?.gapId) {
    units.push(current as DiscoveredUnit)
  }

  return units
}
