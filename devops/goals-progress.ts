// devops/goals-progress.ts
// Progress calculation for GOALS system.
//
// Progress flows bottom-up:
//   - Key Result: (current / target) * 100 (clamped 0-100)
//   - Objective: average of child key results
//   - Goal: average of child objectives
//
// When relatedUnits are specified:
//   - Query atomic tracker for unit status
//   - If all related units are [x] (done), key result = 100%
//   - Manual current values take precedence over atomic-derived values

import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { Goal, Objective, KeyResult } from './goals.ts'
import { readGoalsFile, writeGoalsFile } from './goals.ts'

const PROJECT_ROOT = join(import.meta.dir, '..')
const TRACKER_FILE = join(PROJECT_ROOT, 'docs', 'atomic', '01-tracker.md')

// ── Atomic tracker parsing ────────────────────────────────────────────────

interface TrackerUnit {
  id: string
  status: 'pending' | 'in_progress' | 'done' | 'blocked'
}

export async function parseTracker(): Promise<TrackerUnit[]> {
  try {
    const content = await readFile(TRACKER_FILE, 'utf8')
    const units: TrackerUnit[] = []
    const lines = content.split('\n')

    for (const line of lines) {
      // Match patterns like "- [x] 11.1 CDPClient" or "- [~] 12.1 RemuxRouter"
      const match = line.match(/^- \[([ x~!])\]\s+(\S+)/)
      if (match) {
        const statusChar = match[1] as string
        const id = match[2] as string

        let status: TrackerUnit['status'] = 'pending'
        if (statusChar === 'x') status = 'done'
        else if (statusChar === '~') status = 'in_progress'
        else if (statusChar === '!') status = 'blocked'

        units.push({ id, status })
      }
    }

    return units
  } catch {
    return []
  }
}

// ── Progress calculation ──────────────────────────────────────────────────

export function calculateKeyResultProgress(kr: KeyResult, tracker: TrackerUnit[]): number {
  // Manual current values take precedence
  if (kr.target > 0 && kr.current > 0) {
    return Math.round((kr.current / kr.target) * 100)
  }

  // If no related units, return current progress
  if (kr.relatedUnits.length === 0) {
    return kr.target > 0 ? Math.round((kr.current / kr.target) * 100) : 0
  }

  // Calculate from related units
  const relatedTrackerUnits = tracker.filter(t =>
    kr.relatedUnits.some(ru => t.id.startsWith(ru) || ru.startsWith(t.id))
  )

  if (relatedTrackerUnits.length === 0) {
    return kr.target > 0 ? Math.round((kr.current / kr.target) * 100) : 0
  }

  const doneCount = relatedTrackerUnits.filter(t => t.status === 'done').length
  const progress = Math.round((doneCount / relatedTrackerUnits.length) * 100)

  // Use the higher of manual progress or atomic-derived progress
  const manualProgress = kr.target > 0 ? Math.round((kr.current / kr.target) * 100) : 0
  return Math.max(manualProgress, progress)
}

export function calculateObjectiveProgress(obj: Objective, tracker: TrackerUnit[]): number {
  if (obj.keyResults.length === 0) {
    return obj.completion
  }

  const totalProgress = obj.keyResults.reduce(
    (sum, kr) => sum + calculateKeyResultProgress(kr, tracker),
    0
  )
  return Math.round(totalProgress / obj.keyResults.length)
}

export function calculateGoalProgress(goal: Goal, tracker: TrackerUnit[]): number {
  if (goal.objectives.length === 0) {
    return goal.completion
  }

  const totalProgress = goal.objectives.reduce(
    (sum, obj) => sum + calculateObjectiveProgress(obj, tracker),
    0
  )
  return Math.round(totalProgress / goal.objectives.length)
}

// ── Auto-update all progress ──────────────────────────────────────────────

export async function recalculateAllProgress(): Promise<Goal[]> {
  const goals = await readGoalsFile()
  const tracker = await parseTracker()

  for (const goal of goals) {
    goal.completion = calculateGoalProgress(goal, tracker)
    goal.status = goal.completion >= 100 ? 'achieved'
      : goal.completion > 0 ? 'in_progress'
      : 'not_started'

    for (const obj of goal.objectives) {
      obj.completion = calculateObjectiveProgress(obj, tracker)
      obj.status = obj.completion >= 100 ? 'achieved'
        : obj.completion > 0 ? 'in_progress'
        : 'not_started'

      for (const kr of obj.keyResults) {
        const progress = calculateKeyResultProgress(kr, tracker)
        kr.status = progress >= 100 ? 'achieved'
          : progress > 0 ? 'in_progress'
          : 'not_started'

        // Sync current value from tracker when relatedUnits exist
        if (kr.relatedUnits.length > 0 && (kr.current === 0 || kr.current < kr.target)) {
          const relatedTrackerUnits = tracker.filter(t =>
            kr.relatedUnits.some(ru => t.id.startsWith(ru) || ru.startsWith(t.id))
          )
          if (relatedTrackerUnits.length > 0) {
            const doneCount = relatedTrackerUnits.filter(t => t.status === 'done').length
            kr.current = doneCount
          }
        }
      }
    }
  }

  await writeGoalsFile(goals)
  return goals
}

// ── Goal contribution scoring (for selection) ─────────────────────────────

export function calculateGoalContribution(unitId: string, goals: Goal[]): number {
  let score = 0

  for (const goal of goals) {
    for (const obj of goal.objectives) {
      for (const kr of obj.keyResults) {
        if (kr.relatedUnits.some(ru => unitId.startsWith(ru) || ru.startsWith(unitId))) {
          score++
        }
      }
    }
  }

  return score
}

// ── Progress summary ──────────────────────────────────────────────────────

export interface ProgressSummary {
  totalGoals: number
  achievedGoals: number
  totalObjectives: number
  achievedObjectives: number
  totalKeyResults: number
  achievedKeyResults: number
  overallCompletion: number
}

export function generateProgressSummary(goals: Goal[]): ProgressSummary {
  let totalObjectives = 0
  let achievedObjectives = 0
  let totalKeyResults = 0
  let achievedKeyResults = 0

  for (const goal of goals) {
    for (const obj of goal.objectives) {
      totalObjectives++
      if (obj.completion >= 100) achievedObjectives++

      for (const kr of obj.keyResults) {
        totalKeyResults++
        if (kr.status === 'achieved') achievedKeyResults++
      }
    }
  }

  const achievedGoals = goals.filter(g => g.completion >= 100).length
  const overallCompletion = goals.length > 0
    ? Math.round(goals.reduce((sum, g) => sum + g.completion, 0) / goals.length)
    : 0

  return {
    totalGoals: goals.length,
    achievedGoals,
    totalObjectives,
    achievedObjectives,
    totalKeyResults,
    achievedKeyResults,
    overallCompletion,
  }
}
