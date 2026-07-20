// devops/goals.ts
// GOALS system — Governing User Journey & Product Goals.
//
// OKR hierarchy: Goal → Objective → Key Result
//   - Goals represent high-level product outcomes
//   - Objectives are measurable outcomes under each goal
//   - Key Results are specific metrics with targets
//
// Progress flows bottom-up:
//   - Key Result: (current / target) * 100
//   - Objective: average of child key results
//   - Goal: average of child objectives
//
// Integration points:
//   - Atomic tracker: key results reference relatedUnits
//   - ADR system: options reference relatedGoals + goalAlignment score
//   - Roadmap: phases map to goals

import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { parseUnits } from './tracker.js'

const PROJECT_ROOT = join(import.meta.dir, '..')
const GOALS_DIR = join(PROJECT_ROOT, 'docs', 'goals')
const GOALS_FILE = join(GOALS_DIR, 'GOALS.md')

// ── Types ─────────────────────────────────────────────────────────────────

export type GoalStatus = 'not_started' | 'in_progress' | 'achieved' | 'blocked'

export interface KeyResult {
  id: string
  title: string
  description: string
  metric: string
  target: number
  current: number
  status: GoalStatus
  relatedUnits: string[]
}

export interface Objective {
  id: string
  title: string
  description: string
  status: GoalStatus
  completion: number
  keyResults: KeyResult[]
}

export interface Goal {
  id: string
  title: string
  description: string
  status: GoalStatus
  completion: number
  owner: string
  timeframe: string
  objectives: Objective[]
}

export interface CreateGoalInput {
  title: string
  description: string
  owner?: string
  timeframe?: string
}

export interface CreateObjectiveInput {
  goalId: string
  title: string
  description: string
}

export interface CreateKeyResultInput {
  goalId: string
  objectiveId: string
  title: string
  description: string
  metric: string
  target: number
  relatedUnits?: string[]
}

export interface UpdateKeyResultInput {
  current?: number
  status?: GoalStatus
  target?: number
}

// ── ID generation ─────────────────────────────────────────────────────────

let nextGoalNumber = 1
let nextObjectiveNumber = 1
let nextKeyResultNumber = 1

function generateGoalId(): string {
  const num = String(nextGoalNumber).padStart(3, '0')
  nextGoalNumber++
  return `G-${num}`
}

function generateObjectiveId(): string {
  const num = String(nextObjectiveNumber).padStart(3, '0')
  nextObjectiveNumber++
  return `O-${num}`
}

function generateKeyResultId(): string {
  const num = String(nextKeyResultNumber).padStart(3, '0')
  nextKeyResultNumber++
  return `KR-${num}`
}

// ── File I/O ──────────────────────────────────────────────────────────────

export async function readGoalsFile(): Promise<Goal[]> {
  try {
    const content = await readFile(GOALS_FILE, 'utf8')
    return parseGoalsMarkdown(content)
  } catch {
    return []
  }
}

export async function writeGoalsFile(goals: Goal[]): Promise<void> {
  await mkdir(GOALS_DIR, { recursive: true })
  const content = renderGoalsMarkdown(goals)
  await writeFile(GOALS_FILE, content, 'utf8')
}

// ── Core operations ───────────────────────────────────────────────────────

export async function createGoal(input: CreateGoalInput): Promise<Goal> {
  const goals = await readGoalsFile()

  const goal: Goal = {
    id: generateGoalId(),
    title: input.title,
    description: input.description,
    status: 'not_started',
    completion: 0,
    owner: input.owner ?? 'user',
    timeframe: input.timeframe ?? '',
    objectives: [],
  }

  goals.push(goal)
  await writeGoalsFile(goals)
  return goal
}

export async function getGoal(id: string): Promise<Goal | null> {
  const goals = await readGoalsFile()
  return goals.find(g => g.id === id) ?? null
}

export async function listGoals(): Promise<Goal[]> {
  return readGoalsFile()
}

export async function updateGoal(id: string, updates: Partial<Pick<Goal, 'title' | 'description' | 'status' | 'owner' | 'timeframe'>>): Promise<Goal> {
  const goals = await readGoalsFile()
  const idx = goals.findIndex(g => g.id === id)
  if (idx === -1) {
    throw new Error(`Goal ${id} not found`)
  }

  goals[idx] = { ...goals[idx], ...updates }
  await writeGoalsFile(goals)
  return goals[idx]
}

export async function createObjective(input: CreateObjectiveInput): Promise<Objective> {
  const goals = await readGoalsFile()
  const goal = goals.find(g => g.id === input.goalId)
  if (!goal) {
    throw new Error(`Goal ${input.goalId} not found`)
  }

  const objective: Objective = {
    id: generateObjectiveId(),
    title: input.title,
    description: input.description,
    status: 'not_started',
    completion: 0,
    keyResults: [],
  }

  goal.objectives.push(objective)
  await writeGoalsFile(goals)
  return objective
}

export async function createKeyResult(input: CreateKeyResultInput): Promise<KeyResult> {
  const goals = await readGoalsFile()
  const goal = goals.find(g => g.id === input.goalId)
  if (!goal) {
    throw new Error(`Goal ${input.goalId} not found`)
  }

  const objective = goal.objectives.find(o => o.id === input.objectiveId)
  if (!objective) {
    throw new Error(`Objective ${input.objectiveId} not found in goal ${input.goalId}`)
  }

  const keyResult: KeyResult = {
    id: generateKeyResultId(),
    title: input.title,
    description: input.description,
    metric: input.metric,
    target: input.target,
    current: 0,
    status: 'not_started',
    relatedUnits: input.relatedUnits ?? [],
  }

  objective.keyResults.push(keyResult)
  await writeGoalsFile(goals)
  return keyResult
}

export async function updateKeyResult(
  goalId: string,
  objectiveId: string,
  keyResultId: string,
  input: UpdateKeyResultInput,
): Promise<KeyResult> {
  const goals = await readGoalsFile()
  const goal = goals.find(g => g.id === goalId)
  if (!goal) {
    throw new Error(`Goal ${goalId} not found`)
  }

  const objective = goal.objectives.find(o => o.id === objectiveId)
  if (!objective) {
    throw new Error(`Objective ${objectiveId} not found in goal ${goalId}`)
  }

  const keyResult = objective.keyResults.find(kr => kr.id === keyResultId)
  if (!keyResult) {
    throw new Error(`KeyResult ${keyResultId} not found in objective ${objectiveId}`)
  }

  if (input.current !== undefined) {
    keyResult.current = Math.max(0, Math.min(input.current, keyResult.target))
  }
  if (input.target !== undefined) {
    keyResult.target = input.target
    keyResult.current = Math.min(keyResult.current, keyResult.target)
  }
  if (input.status !== undefined) {
    keyResult.status = input.status
  }

  // Auto-calculate status from progress
  const progress = keyResult.target > 0 ? (keyResult.current / keyResult.target) * 100 : 0
  if (progress >= 100) {
    keyResult.status = 'achieved'
  } else if (progress > 0) {
    keyResult.status = 'in_progress'
  } else {
    keyResult.status = 'not_started'
  }

  await writeGoalsFile(goals)
  return keyResult
}

// ── Markdown serialization ────────────────────────────────────────────────

export function renderGoalsMarkdown(goals: Goal[]): string {
  const lines: string[] = []

  lines.push('# VIVIM Goals — Governing User Journey & Product Goals')
  lines.push('')
  lines.push('**Status:** ACTIVE')
  lines.push(`**Last Updated:** ${new Date().toISOString().slice(0, 10)}`)
  lines.push('')
  lines.push('---')
  lines.push('')

  for (const goal of goals) {
    lines.push(`## Goal ${goal.id}: ${goal.title}`)
    lines.push('')
    lines.push(`**Status:** ${goal.status.replace('_', ' ').toUpperCase()} | **Completion:** ${goal.completion}% | **Owner:** ${goal.owner} | **Timeframe:** ${goal.timeframe || 'TBD'}`)
    lines.push('')
    lines.push(`> ${goal.description}`)
    lines.push('')
    lines.push('### Objectives')
    lines.push('')

    for (const obj of goal.objectives) {
      lines.push(`#### ${obj.id}: ${obj.title}`)
      lines.push(`**Status:** ${obj.status.replace('_', ' ').toUpperCase()} | **Completion:** ${obj.completion}%`)
      lines.push('')

      for (const kr of obj.keyResults) {
        const progress = kr.target > 0 ? Math.round((kr.current / kr.target) * 100) : 0
        const statusIcon = kr.status === 'achieved' ? '✓' : kr.status === 'in_progress' ? '~' : '·'
        lines.push(`- **${kr.id}:** ${kr.title}`)
        lines.push(`  - Metric: ${kr.metric}`)
        lines.push(`  - Target: ${kr.target} | Current: ${kr.current} | Progress: ${progress}% ${statusIcon}`)
        if (kr.relatedUnits.length > 0) {
          lines.push(`  - Related Units: ${kr.relatedUnits.join(', ')}`)
        }
      }
      lines.push('')
    }

    lines.push('---')
    lines.push('')
  }

  // ADR Alignment Matrix
  lines.push('## ADR Alignment Matrix')
  lines.push('')
  lines.push('| ADR | Options | Goal Alignment | Related Goals |')
  lines.push('|-----|---------|----------------|---------------|')
  lines.push('| *Populated by `goals score` command* | | | |')
  lines.push('')

  return lines.join('\n')
}

export function parseGoalsMarkdown(content: string): Goal[] {
  const lines = content.split('\n')
  const goals: Goal[] = []

  let currentGoal: Goal | null = null
  let currentObjective: Objective | null = null
  let currentSection = ''

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] as string
    if (line === undefined) continue

    // Goal header
    if (line.startsWith('## Goal ')) {
      if (currentGoal) {
        if (currentObjective) {
          currentGoal.objectives.push(currentObjective)
          currentObjective = null
        }
        goals.push(currentGoal)
      }

      const match = line.match(/^## Goal (G-\d+):\s+(.+)$/)
      if (match) {
        currentGoal = {
          id: match[1],
          title: match[2],
          description: '',
          status: 'not_started',
          completion: 0,
          owner: 'user',
          timeframe: '',
          objectives: [],
        }
        currentSection = 'goal'
      }
      continue
    }

    // Objective header
    if (line.startsWith('#### ')) {
      if (currentObjective && currentGoal) {
        currentGoal.objectives.push(currentObjective)
      }

      const match = line.match(/^#### (O-\d+):\s+(.+)$/)
      if (match && currentGoal) {
        currentObjective = {
          id: match[1],
          title: match[2],
          description: '',
          status: 'not_started',
          completion: 0,
          keyResults: [],
        }
        currentSection = 'objective'
      }
      continue
    }

    // Parse objective metadata (Status + Completion on same line)
    if (currentObjective && currentSection === 'objective') {
      if (line.includes('|') && line.includes('**Status:**')) {
        const parts = line.split('|').map(p => p.trim())
        for (const part of parts) {
          if (part.startsWith('**Status:**')) {
            const match = part.match(/\*\*Status:\*\*\s*(\w[\w\s]*)/)
            if (match) currentObjective.status = match[1].trim().toLowerCase().replace(' ', '_') as GoalStatus
          }
          if (part.startsWith('**Completion:**')) {
            const match = part.match(/\*\*Completion:\*\*\s*(\d+)%/)
            if (match) currentObjective.completion = Number(match[1])
          }
        }
      }
    }

    // Parse goal metadata (supports both single-line and multi-line formats)
    if (currentGoal && currentSection === 'goal') {
      // Single-line format: **Status:** X | **Completion:** Y% | **Owner:** Z | **Timeframe:** T
      if (line.includes('|') && line.includes('**Status:**')) {
        const parts = line.split('|').map(p => p.trim())
        for (const part of parts) {
          if (part.startsWith('**Status:**')) {
            const match = part.match(/\*\*Status:\*\*\s*(\w[\w\s]*)/)
            if (match) currentGoal.status = match[1].trim().toLowerCase().replace(' ', '_') as GoalStatus
          }
          if (part.startsWith('**Completion:**')) {
            const match = part.match(/\*\*Completion:\*\*\s*(\d+)%/)
            if (match) currentGoal.completion = Number(match[1])
          }
          if (part.startsWith('**Owner:**')) {
            const match = part.match(/\*\*Owner:\*\*\s*(\w+)/)
            if (match) currentGoal.owner = match[1]
          }
          if (part.startsWith('**Timeframe:**')) {
            const match = part.match(/\*\*Timeframe:\*\*\s*(.+)/)
            if (match) currentGoal.timeframe = match[1].trim()
          }
        }
      }
      // Multi-line format: each field on its own line
      else {
        if (line.startsWith('**Status:**')) {
          const match = line.match(/\*\*Status:\*\*\s*(\w[\w\s]*)/)
          if (match) currentGoal.status = match[1].trim().toLowerCase().replace(' ', '_') as GoalStatus
        }
        if (line.startsWith('**Completion:**')) {
          const match = line.match(/\*\*Completion:\*\*\s*(\d+)%/)
          if (match) currentGoal.completion = Number(match[1])
        }
        if (line.startsWith('**Owner:**')) {
          const match = line.match(/\*\*Owner:\*\*\s*(\w+)/)
          if (match) currentGoal.owner = match[1]
        }
        if (line.startsWith('**Timeframe:**')) {
          const match = line.match(/\*\*Timeframe:\*\*\s*(.+)/)
          if (match) currentGoal.timeframe = match[1].trim()
        }
      }
      if (line.startsWith('> ') && !line.startsWith('**')) {
        currentGoal.description = line.slice(2).trim()
      }
    }

    // Parse key results
    if (line.startsWith('- **KR-')) {
      const match = line.match(/^- \*\*(KR-\d+):\*\*\s+(.+)$/)
      if (match && currentObjective) {
        const kr: KeyResult = {
          id: match[1],
          title: match[2],
          description: '',
          metric: '',
          target: 0,
          current: 0,
          status: 'not_started',
          relatedUnits: [],
        }
        currentObjective.keyResults.push(kr)
      }
    }

    // Parse key result metadata
    if (currentObjective && currentObjective.keyResults.length > 0) {
      const kr = currentObjective.keyResults[currentObjective.keyResults.length - 1] as KeyResult

      if (line.trim().startsWith('- Metric:')) {
        const match = line.match(/Metric:\s*(.+)/)
        if (match) {
          kr.metric = match[1].trim()
        }
      }
      if (line.trim().startsWith('- Target:')) {
        const targetMatch = line.match(/Target:\s*(\d+)\s*\|\s*Current:\s*(\d+)/)
        if (targetMatch) {
          kr.target = Number(targetMatch[1])
          kr.current = Number(targetMatch[2])
        }
        const progressMatch = line.match(/Progress:\s*(\d+)%\s*([✓~·])/)
        if (progressMatch) {
          const icon = progressMatch[2]
          kr.status = icon === '✓' ? 'achieved' : icon === '~' ? 'in_progress' : 'not_started'
        }
      }
      if (line.trim().startsWith('- Related Units:')) {
        const match = line.match(/Related Units:\s*(.+)/)
        if (match) {
          kr.relatedUnits = match[1].split(',').map(s => s.trim())
        }
      }
    }
  }

  // Push last goal
  if (currentGoal) {
    if (currentObjective) {
      currentGoal.objectives.push(currentObjective)
    }
    goals.push(currentGoal)
  }

  return goals
}

// ── Drift detection ──────────────────────────────────────────────────────

export interface DriftItem {
  severity: 'error' | 'warning' | 'info'
  scope: 'goal' | 'objective' | 'kr'
  id: string
  message: string
  detail?: string
}

export interface DriftReport {
  generatedAt: string
  goalsChecked: number
  krsChecked: number
  drift: DriftItem[]
  pass: boolean
}

/**
 * Cross-check GOALS.md KR/goal state against the real atomic tracker.
 * Detects:
 *   - KR marked ≥100% but related units not all done in tracker
 *   - Goal status "achieved" but completion < 100%
 *   - Goal status "not_started" but completion > 0
 *   - KR target = 0 (no measurable target)
 *   - Related unit IDs that don't exist in tracker
 * Soft signals only — never a hard gate. Reports drift for human review.
 */
export async function checkGoalsDrift(trackerPath?: string): Promise<DriftReport> {
  const goals = await readGoalsFile()
  const trackerFile = trackerPath ?? join(PROJECT_ROOT, 'docs', 'atomic-v3-fork-canon', '01-tracker.md')
  const trackerLines = await readFile(trackerFile, 'utf8').catch(() => '')
  const trackerUnits = parseUnits(trackerLines.split('\n'))

  const unitState = new Map(trackerUnits.map(u => [u.id, u.state]))
  const drift: DriftItem[] = []
  let krsChecked = 0

  for (const goal of goals) {
    if (goal.status === 'achieved' && goal.completion < 100) {
      drift.push({
        severity: 'error',
        scope: 'goal',
        id: goal.id,
        message: `Goal ${goal.id} ("${goal.title}") marked ACHIEVED but completion is ${goal.completion}%`,
        detail: 'Goal status and completion percentage are inconsistent',
      })
    }
    if (goal.status === 'not_started' && goal.completion > 0) {
      drift.push({
        severity: 'warning',
        scope: 'goal',
        id: goal.id,
        message: `Goal ${goal.id} is "not_started" but shows ${goal.completion}% completion`,
        detail: 'Either mark goal in_progress or reset completion to 0',
      })
    }

    for (const obj of goal.objectives) {
      if (obj.status === 'achieved' && obj.completion < 100) {
        drift.push({
          severity: 'warning',
          scope: 'objective',
          id: obj.id,
          message: `Objective ${obj.id} marked ACHIEVED but completion is ${obj.completion}%`,
        })
      }

      for (const kr of obj.keyResults) {
        krsChecked++
        const progress = kr.target > 0 ? Math.round((kr.current / kr.target) * 100) : 0

        if (kr.target <= 0) {
          drift.push({
            severity: 'warning',
            scope: 'kr',
            id: kr.id,
            message: `KR ${kr.id} has target=0 — not measurable`,
            detail: `Title: "${kr.title}"`,
          })
        }

        if (progress >= 100 && kr.status !== 'achieved') {
          drift.push({
            severity: 'warning',
            scope: 'kr',
            id: kr.id,
            message: `KR ${kr.id} is at ${progress}% but status is "${kr.status}" (should be achieved)`,
          })
        }

        if (progress >= 100 && kr.relatedUnits.length > 0) {
          const notDone = kr.relatedUnits.filter(uid => {
            const s = unitState.get(uid)
            return s && s !== 'done'
          })
          if (notDone.length > 0) {
            drift.push({
              severity: 'error',
              scope: 'kr',
              id: kr.id,
              message: `KR ${kr.id} claims 100% progress but ${notDone.length} related unit(s) are not done in tracker`,
              detail: `Not-done units: ${notDone.join(', ')}`,
            })
          }
        }

        for (const uid of kr.relatedUnits) {
          if (!unitState.has(uid)) {
            drift.push({
              severity: 'warning',
              scope: 'kr',
              id: kr.id,
              message: `KR ${kr.id} references unknown unit ${uid}`,
              detail: 'Unit ID not found in tracker — typo or stale reference?',
            })
          }
        }
      }
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    goalsChecked: goals.length,
    krsChecked,
    drift,
    pass: drift.filter(d => d.severity === 'error').length === 0,
  }
}

export function renderDriftReport(report: DriftReport): string {
  const lines: string[] = []
  lines.push('# Goals Drift Report')
  lines.push('')
  lines.push(`**Generated:** ${report.generatedAt}`)
  lines.push(`**Status:** ${report.pass ? 'CLEAN' : 'DRIFT DETECTED'}`)
  lines.push(`**Goals checked:** ${report.goalsChecked} | **KRs checked:** ${report.krsChecked}`)
  lines.push('')
  lines.push('---')
  lines.push('')

  const errors = report.drift.filter(d => d.severity === 'error')
  const warnings = report.drift.filter(d => d.severity === 'warning')

  if (errors.length > 0) {
    lines.push('## Errors')
    lines.push('')
    for (const e of errors) {
      lines.push(`- **${e.id}:** ${e.message}`)
      if (e.detail) lines.push(`  - ${e.detail}`)
    }
    lines.push('')
  }

  if (warnings.length > 0) {
    lines.push('## Warnings')
    lines.push('')
    for (const w of warnings) {
      lines.push(`- **${w.id}:** ${w.message}`)
      if (w.detail) lines.push(`  - ${w.detail}`)
    }
    lines.push('')
  }

  if (report.drift.length === 0) {
    lines.push('No drift detected. Goals and tracker are aligned.')
    lines.push('')
  }

  return lines.join('\n')
}
