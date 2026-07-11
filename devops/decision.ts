// devops/decision.ts
// Architecture Decision Record (ADR) management.
//
// Multi-round proposal-review-decision workflow:
//   1. Create ADR with problem statement and options
//   2. AI reviews technical tradeoffs
//   3. Human reviews business/product fit
//   4. Revise based on feedback
//   5. Second review round
//   6. Decide (select option)
//   7. Approve
//
// State machine:
//   PROPOSED → IN_REVIEW → REVISED → IN_REVIEW → DECIDED → APPROVED
//                ↓                              ↓
//              REJECTED                       REJECTED

import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'

const PROJECT_ROOT = join(import.meta.dir, '..')
const DECISIONS_DIR = join(PROJECT_ROOT, 'docs', 'decisions')

// ── Types ─────────────────────────────────────────────────────────────────

export type DecisionStatus = 'proposed' | 'in_review' | 'revised' | 'decided' | 'approved' | 'rejected'
export type ReviewerType = 'ai' | 'human'
export type Effort = 'S' | 'M' | 'L' | 'XL'
export type Risk = 'low' | 'medium' | 'high'

export interface DecisionOption {
  id: string
  name: string
  description: string
  pros: string[]
  cons: string[]
  effort: Effort
  risk: Risk
  goalAlignment?: number // 1-5 score, populated when goals system is active
}

export interface ReviewRound {
  round: number
  date: string
  reviewer: string
  type: ReviewerType
  feedback: string
  changesMade: string
}

export interface DecisionRecord {
  id: string
  title: string
  status: DecisionStatus
  date: string
  author: string
  reviewers: string[]
  relatedUnits: string[]
  problemStatement: string
  context: string
  options: DecisionOption[]
  analysis: string
  decidedOption?: string
  rationale?: string
  consequences: string
  reviewHistory: ReviewRound[]
  futureConsiderations?: string
}

export interface CreateDecisionInput {
  title: string
  author: string
  problemStatement: string
  context: string
  options: Omit<DecisionOption, 'id'>[]
  relatedUnits?: string[]
}

export interface AddReviewInput {
  reviewer: string
  type: ReviewerType
  feedback: string
  changesMade: string
}

// ── ID generation ─────────────────────────────────────────────────────────

let nextAdrNumber = 1

function generateAdrId(): string {
  const num = String(nextAdrNumber).padStart(3, '0')
  nextAdrNumber++
  return `ADR-${num}`
}

// ── State validation ──────────────────────────────────────────────────────

const VALID_TRANSITIONS: Record<DecisionStatus, DecisionStatus[]> = {
  proposed: ['in_review', 'rejected'],
  in_review: ['revised', 'decided', 'rejected'],
  revised: ['in_review', 'decided', 'rejected'],
  decided: ['approved', 'rejected'],
  approved: [],
  rejected: [],
}

function canTransition(from: DecisionStatus, to: DecisionStatus): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false
}

function validateTransition(from: DecisionStatus, to: DecisionStatus): void {
  if (!canTransition(from, to)) {
    throw new Error(`Invalid status transition: ${from} → ${to}. Allowed: ${VALID_TRANSITIONS[from]?.join(', ')}`)
  }
}

// ── File I/O ──────────────────────────────────────────────────────────────

function decisionPath(id: string): string {
  return join(DECISIONS_DIR, `${id}.md`)
}

function parseDecisionId(filename: string): string | null {
  const match = filename.match(/^(ADR-\d+)\.md$/)
  return match?.[1] ?? null
}

// ── Core operations ───────────────────────────────────────────────────────

export async function createDecision(input: CreateDecisionInput): Promise<DecisionRecord> {
  await mkdir(DECISIONS_DIR, { recursive: true })

  const id = generateAdrId()
  const now = new Date().toISOString()

  const record: DecisionRecord = {
    id,
    title: input.title,
    status: 'proposed',
    date: now,
    author: input.author,
    reviewers: [],
    relatedUnits: input.relatedUnits ?? [],
    problemStatement: input.problemStatement,
    context: input.context,
    options: input.options.map((opt, i) => ({
      ...opt,
      id: String.fromCharCode(65 + i), // A, B, C, ...
    })),
    analysis: '',
    consequences: '',
    reviewHistory: [],
  }

  await writeDecision(record)
  return record
}

export async function getDecision(id: string): Promise<DecisionRecord | null> {
  const path = decisionPath(id)
  try {
    const content = await readFile(path, 'utf8')
    return parseDecisionMarkdown(content, id)
  } catch {
    return null
  }
}

export async function listDecisions(): Promise<DecisionRecord[]> {
  await mkdir(DECISIONS_DIR, { recursive: true })

  const { readdir } = await import('node:fs/promises')
  const files = await readdir(DECISIONS_DIR)
  const decisions: DecisionRecord[] = []

  for (const file of files) {
    if (!file.endsWith('.md')) continue
    const id = parseDecisionId(file)
    if (!id) continue

    const record = await getDecision(id)
    if (record) {
      decisions.push(record)
    }
  }

  return decisions.sort((a, b) => a.date.localeCompare(b.date))
}

export async function updateDecision(id: string, updates: Partial<DecisionRecord>): Promise<DecisionRecord> {
  const existing = await getDecision(id)
  if (!existing) {
    throw new Error(`Decision ${id} not found`)
  }

  if (updates.status && updates.status !== existing.status) {
    validateTransition(existing.status, updates.status)
  }

  // Assign IDs to options if they don't have them
  if (updates.options) {
    updates.options = updates.options.map((opt, i) => ({
      ...opt,
      id: opt.id || String.fromCharCode(65 + i), // A, B, C, ...
    }))
  }

  const merged = { ...existing, ...updates }
  await writeDecision(merged)
  return merged
}

export async function decide(id: string, optionId: string, rationale: string): Promise<DecisionRecord> {
  const existing = await getDecision(id)
  if (!existing) {
    throw new Error(`Decision ${id} not found`)
  }

  const option = existing.options.find(o => o.id === optionId)
  if (!option) {
    throw new Error(`Option ${optionId} not found in decision ${id}`)
  }

  return updateDecision(id, {
    status: 'decided',
    decidedOption: optionId,
    rationale,
  })
}

export async function approve(id: string): Promise<DecisionRecord> {
  const existing = await getDecision(id)
  if (!existing) {
    throw new Error(`Decision ${id} not found`)
  }
  if (existing.status === 'approved') {
    throw new Error(`Decision ${id} is already approved`)
  }
  return updateDecision(id, { status: 'approved' })
}

export async function reject(id: string): Promise<DecisionRecord> {
  return updateDecision(id, { status: 'rejected' })
}

export async function updateAnalysis(
  id: string,
  analysis: string,
  consequences: string,
): Promise<DecisionRecord> {
  const existing = await getDecision(id)
  if (!existing) {
    throw new Error(`Decision ${id} not found`)
  }
  if (existing.status === 'approved' || existing.status === 'rejected') {
    throw new Error(`Decision ${id} is already ${existing.status}`)
  }
  return updateDecision(id, { analysis, consequences })
}

export function compareOptions(record: DecisionRecord): string {
  if (record.options.length === 0) {
    return 'No options to compare.'
  }

  const lines: string[] = []

  // Header
  const header = ['Attribute', ...record.options.map(o => `Option ${o.id}: ${o.name}`)]
  lines.push(`| ${header.join(' | ')} |`)
  lines.push(`| ${header.map(() => '---').join(' | ')} |`)

  // Effort row
  const effortRow = ['Effort', ...record.options.map(o => o.effort)]
  lines.push(`| ${effortRow.join(' | ')} |`)

  // Risk row
  const riskRow = ['Risk', ...record.options.map(o => o.risk)]
  lines.push(`| ${riskRow.join(' | ')} |`)

  // Goal Alignment row (placeholder for future goals system)
  const hasGoalScores = record.options.some(o => o.goalAlignment !== undefined)
  if (hasGoalScores) {
    const goalRow = ['Goal Alignment', ...record.options.map(o =>
      o.goalAlignment !== undefined ? `${o.goalAlignment}/5` : '-'
    )]
    lines.push(`| ${goalRow.join(' | ')} |`)
  } else {
    const goalRow = ['Goal Alignment', ...record.options.map(() => '[pending goals]')]
    lines.push(`| ${goalRow.join(' | ')} |`)
  }

  // Pros row
  const prosRow = ['Pros', ...record.options.map(o => o.pros.join('; ') || '-')]
  lines.push(`| ${prosRow.join(' | ')} |`)

  // Cons row
  const consRow = ['Cons', ...record.options.map(o => o.cons.join('; ') || '-')]
  lines.push(`| ${consRow.join(' | ')} |`)

  // Decision row if decided
  if (record.decidedOption) {
    const decisionRow = ['Decision', ...record.options.map(o =>
      o.id === record.decidedOption ? '**SELECTED**' : ''
    )]
    lines.push(`| ${decisionRow.join(' | ')} |`)
  }

  return lines.join('\n')
}

// ── Markdown serialization ────────────────────────────────────────────────

async function writeDecision(record: DecisionRecord): Promise<void> {
  const content = renderDecisionMarkdown(record)
  await writeFile(decisionPath(record.id), content, 'utf8')
}

export function renderDecisionMarkdown(record: DecisionRecord): string {
  const lines: string[] = []

  lines.push(`# ${record.id}: ${record.title}`)
  lines.push('')
  lines.push(`**Status:** ${record.status.toUpperCase()}`)
  lines.push(`**Date:** ${record.date.slice(0, 10)}`)
  lines.push(`**Author:** ${record.author}`)
  lines.push(`**Reviewers:** ${record.reviewers.length > 0 ? record.reviewers.join(', ') : 'None yet'}`)
  if (record.relatedUnits.length > 0) {
    lines.push(`**Related Units:** ${record.relatedUnits.join(', ')}`)
  }
  lines.push('')

  // Problem Statement
  lines.push('## Problem Statement')
  lines.push('')
  lines.push(record.problemStatement)
  lines.push('')

  // Context
  lines.push('## Context')
  lines.push('')
  lines.push(record.context)
  lines.push('')

  // Options
  lines.push('## Options Considered')
  lines.push('')
  for (const opt of record.options) {
    lines.push(`### Option ${opt.id}: ${opt.name}`)
    lines.push('')
    lines.push(`**Description:** ${opt.description}`)
    lines.push('')
    lines.push('**Pros:**')
    for (const pro of opt.pros) {
      lines.push(`- ${pro}`)
    }
    lines.push('')
    lines.push('**Cons:**')
    for (const con of opt.cons) {
      lines.push(`- ${con}`)
    }
    lines.push('')
    lines.push(`**Effort:** ${opt.effort}`)
    lines.push(`**Risk:** ${opt.risk}`)
    if (opt.goalAlignment !== undefined) {
      lines.push(`**Goal Alignment:** ${opt.goalAlignment}/5`)
    }
    lines.push('')
  }

  // Analysis
  lines.push('## Analysis')
  lines.push('')
  lines.push(record.analysis || '[To be filled during review rounds]')
  lines.push('')

  // Decision
  lines.push('## Decision')
  lines.push('')
  if (record.decidedOption) {
    const opt = record.options.find(o => o.id === record.decidedOption)
    lines.push(`**Selected Option:** ${record.decidedOption} — ${opt?.name ?? 'Unknown'}`)
    lines.push('')
    lines.push(`**Rationale:** ${record.rationale ?? '[Not specified]'}`)
  } else {
    lines.push('**Selected Option:** [Pending]')
    lines.push('')
    lines.push('**Rationale:** [Pending]')
  }
  lines.push('')

  // Consequences
  lines.push('## Consequences')
  lines.push('')
  lines.push(record.consequences || '[To be filled during review rounds]')
  lines.push('')

  // Review History
  lines.push('## Review History')
  lines.push('')
  if (record.reviewHistory.length === 0) {
    lines.push('[No reviews yet]')
  } else {
    for (const review of record.reviewHistory) {
      lines.push(`### Round ${review.round}: ${review.date.slice(0, 10)}`)
      lines.push('')
      lines.push(`**Reviewer:** ${review.type === 'ai' ? 'AI (technical analysis)' : 'Human (product/business)'}`)
      lines.push('')
      lines.push('**Feedback:**')
      lines.push(review.feedback)
      lines.push('')
      if (review.changesMade) {
        lines.push('**Changes Made:**')
        lines.push(review.changesMade)
        lines.push('')
      }
    }
  }

  // Future Considerations
  if (record.futureConsiderations) {
    lines.push('## Future Considerations')
    lines.push('')
    lines.push(record.futureConsiderations)
    lines.push('')
  }

  return lines.join('\n')
}

function parseDecisionMarkdown(content: string, id: string): DecisionRecord {
  const lines = content.split('\n')

  let title = ''
  let status: DecisionStatus = 'proposed'
  let date = ''
  let author = ''
  let reviewers: string[] = []
  let relatedUnits: string[] = []
  let problemStatement = ''
  let context = ''
  let options: DecisionOption[] = []
  let analysis = ''
  let decidedOption: string | undefined
  let rationale: string | undefined
  let consequences = ''
  let reviewHistory: ReviewRound[] = []
  let futureConsiderations: string | undefined

  let currentSection = ''
  let currentOption: Partial<DecisionOption> | null = null
  let currentList: string[] | null = null
  let currentListTarget: 'pros' | 'cons' | null = null
  let reviewRound: Partial<ReviewRound> | null = null
  let feedbackLines: string[] = []
  let changesLines: string[] = []
  let inReview = false

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] as string
    if (line === undefined) continue

    // Title
    if (i === 0 && line.startsWith('# ')) {
      const titleMatch = line.match(/^#\s+ADR-\d+:\s+(.+)$/)
      if (titleMatch?.[1]) {
        title = titleMatch[1]
      }
      continue
    }

    // Metadata
    if (line.startsWith('**Status:**')) {
      status = (line.match(/\*\*Status:\*\*\s*(\w+)/)?.[1]?.toLowerCase() ?? 'proposed') as DecisionStatus
      continue
    }
    if (line.startsWith('**Date:**')) {
      date = line.match(/\*\*Date:\*\*\s*(.+)/)?.[1]?.trim() ?? ''
      continue
    }
    if (line.startsWith('**Author:**')) {
      author = line.match(/\*\*Author:\*\*\s*(.+)/)?.[1]?.trim() ?? ''
      continue
    }
    if (line.startsWith('**Reviewers:**')) {
      const r = line.match(/\*\*Reviewers:\*\*\s*(.+)/)?.[1]?.trim()
      if (r && r !== 'None yet') {
        reviewers = r.split(',').map(s => s.trim())
      }
      continue
    }
    if (line.startsWith('**Related Units:**')) {
      const u = line.match(/\*\*Related Units:\*\*\s*(.+)/)?.[1]?.trim()
      if (u) {
        relatedUnits = u.split(',').map(s => s.trim())
      }
      continue
    }

    // Sections
    if (line.startsWith('## ')) {
      // Save previous option
      if (currentOption?.name) {
        options.push(currentOption as DecisionOption)
        currentOption = null
      }
      // Save previous list
      if (currentList && currentListTarget && currentOption) {
        // This won't happen now but kept for safety
      }
      currentList = null
      currentListTarget = null

      // Save previous review
      if (inReview && reviewRound) {
        reviewRound.feedback = feedbackLines.join('\n').trim()
        reviewRound.changesMade = changesLines.join('\n').trim()
        reviewHistory.push(reviewRound as ReviewRound)
        reviewRound = null
      }
      inReview = false
      feedbackLines = []
      changesLines = []

      const section = line.replace('## ', '').toLowerCase()
      if (section === 'problem statement') currentSection = 'problem'
      else if (section === 'context') currentSection = 'context'
      else if (section === 'options considered') currentSection = 'options'
      else if (section === 'analysis') currentSection = 'analysis'
      else if (section === 'decision') currentSection = 'decision'
      else if (section === 'consequences') currentSection = 'consequences'
      else if (section === 'review history') currentSection = 'reviews'
      else if (section === 'future considerations') currentSection = 'future'
      else currentSection = section
      continue
    }

    // Option sub-headers
    if (currentSection === 'options' && line.startsWith('### Option ')) {
      if (currentOption?.name) {
        options.push(currentOption as DecisionOption)
      }
      const optMatch = line.match(/### Option\s+(\w+):\s+(.+)/)
      if (optMatch) {
        currentOption = { id: optMatch[1], name: optMatch[2], description: '', pros: [], cons: [], effort: 'M', risk: 'medium' }
      }
      continue
    }

    // Review sub-headers
    if (currentSection === 'reviews' && line.startsWith('### Round ')) {
      // Save previous review
      if (reviewRound) {
        reviewRound.feedback = feedbackLines.join('\n').trim()
        reviewRound.changesMade = changesLines.join('\n').trim()
        reviewHistory.push(reviewRound as ReviewRound)
      }
      feedbackLines = []
      changesLines = []
      inReview = true

      const roundMatch = line.match(/### Round\s+(\d+):\s+(.+)/)
      if (roundMatch) {
        reviewRound = {
          round: Number(roundMatch[1]),
          date: roundMatch[2],
          reviewer: '',
          type: 'ai',
          feedback: '',
          changesMade: '',
        }
      }
      continue
    }

    // Review metadata
    if (inReview && reviewRound) {
      if (line.startsWith('**Reviewer:**')) {
        const rev = line.match(/\*\*Reviewer:\*\*\s*(.+)/)?.[1]?.trim() ?? ''
        reviewRound.reviewer = rev
        reviewRound.type = rev.toLowerCase().includes('ai') ? 'ai' : 'human'
        continue
      }
      if (line.startsWith('**Feedback:**')) {
        // Next lines are feedback
        continue
      }
      if (line.startsWith('**Changes Made:**')) {
        // Next lines are changes
        continue
      }
      if (reviewRound.reviewer && !line.startsWith('**') && line.trim()) {
        if (changesLines.length > 0 || line.toLowerCase().includes('change')) {
          changesLines.push(line)
        } else {
          feedbackLines.push(line)
        }
        continue
      }
    }

    // Option metadata
    if (currentSection === 'options' && currentOption) {
      if (line.startsWith('**Description:**')) {
        currentOption.description = line.replace('**Description:**', '').trim()
        continue
      }
      if (line === '**Pros:**') {
        currentList = currentOption.pros ?? []
        currentListTarget = 'pros'
        continue
      }
      if (line === '**Cons:**') {
        currentList = currentOption.cons ?? []
        currentListTarget = 'cons'
        continue
      }
      if (line.startsWith('**Effort:**')) {
        currentOption.effort = (line.match(/\*\*Effort:\*\*\s*(\w+)/)?.[1] ?? 'M') as Effort
        continue
      }
      if (line.startsWith('**Risk:**')) {
        currentOption.risk = (line.match(/\*\*Risk:\*\*\s*(\w+)/)?.[1] ?? 'medium') as Risk
        continue
      }
      if (line.startsWith('**Goal Alignment:**')) {
        const match = line.match(/\*\*Goal Alignment:\*\*\s*(\d+)/)
        if (match?.[1]) {
          currentOption.goalAlignment = Number(match[1])
        }
        continue
      }
      if (line.startsWith('- ') && currentList) {
        currentList.push(line.replace('- ', '').trim())
        continue
      }
    }

    // Decision metadata
    if (currentSection === 'decision') {
      if (line.startsWith('**Selected Option:**')) {
        const optMatch = line.match(/\*\*Selected Option:\*\*\s*(\w+)/)
        if (optMatch && optMatch[1] !== '[Pending]') {
          decidedOption = optMatch[1]
        }
        continue
      }
      if (line.startsWith('**Rationale:**')) {
        const r = line.replace('**Rationale:**', '').trim()
        if (r && r !== '[Pending]') {
          rationale = r
        }
        continue
      }
    }

    // Content sections
    if (currentSection === 'problem' && line.trim()) {
      problemStatement += (problemStatement ? '\n' : '') + line
    }
    if (currentSection === 'context' && line.trim()) {
      context += (context ? '\n' : '') + line
    }
    if (currentSection === 'analysis' && line.trim()) {
      analysis += (analysis ? '\n' : '') + line
    }
    if (currentSection === 'consequences' && line.trim()) {
      consequences += (consequences ? '\n' : '') + line
    }
    if (currentSection === 'future' && line.trim()) {
      futureConsiderations = (futureConsiderations ?? '') + (futureConsiderations ? '\n' : '') + line
    }
  }

  // Save last option
  if (currentOption?.name) {
    options.push(currentOption as DecisionOption)
  }

  // Save last review
  if (reviewRound) {
    reviewRound.feedback = feedbackLines.join('\n').trim()
    reviewRound.changesMade = changesLines.join('\n').trim()
    reviewHistory.push(reviewRound as ReviewRound)
  }

  return {
    id,
    title,
    status,
    date,
    author,
    reviewers,
    relatedUnits,
    problemStatement: problemStatement.trim(),
    context: context.trim(),
    options,
    analysis: analysis.trim(),
    decidedOption,
    rationale,
    consequences: consequences.trim(),
    reviewHistory,
    futureConsiderations: futureConsiderations?.trim(),
  }
}
