// devops/goals-align.ts
// Goal alignment scoring for ADR system.
//
// Integrates goals with ADRs:
//   - Suggests alignment scores for ADR options
//   - Maps goals → ADRs and ADRs → goals
//   - Validates goal-related invariants
//
// Scoring logic:
//   - Option contributes to goal's key results → +1 per key result
//   - Option directly implements objective → +1
//   - Option's effort/risk affects score (high effort = -0.5, high risk = -0.5)
//   - Final score: clamp(suggested, 1, 5)

import type { Goal } from './goals.ts'
import { readGoalsFile } from './goals.ts'
import type { DecisionRecord, DecisionOption } from './decision.ts'
import { listDecisions } from './decision.ts'

// ── Alignment scoring ─────────────────────────────────────────────────────

export interface AlignmentScore {
  goalId: string
  goalTitle: string
  score: number
  reason: string
}

export function suggestAlignmentScore(
  option: DecisionOption,
  goals: Goal[],
): AlignmentScore[] {
  const scores: AlignmentScore[] = []

  for (const goal of goals) {
    let score = 0
    const reasons: string[] = []

    for (const obj of goal.objectives) {
      for (const kr of obj.keyResults) {
        // Check if option's related units overlap with key result's related units
        if (option.relatedUnits && kr.relatedUnits.length > 0) {
          const overlap = option.relatedUnits.some(ru =>
            kr.relatedUnits.some(kru => ru.startsWith(kru) || kru.startsWith(ru))
          )
          if (overlap) {
            score++
            reasons.push(`contributes to ${kr.id}`)
          }
        }
      }

      // Check if option directly implements objective
      if (option.relatedUnits && obj.id) {
        const implementsObj = option.relatedUnits.some(ru => ru.startsWith(obj.id.replace('O-', '')))
        if (implementsObj) {
          score++
          reasons.push(`implements ${obj.id}`)
        }
      }
    }

    // Effort/risk adjustment
    if (option.effort === 'L' || option.effort === 'XL') {
      score = Math.max(1, score - 0.5)
      reasons.push('high effort penalty')
    }
    if (option.risk === 'high') {
      score = Math.max(1, score - 0.5)
      reasons.push('high risk penalty')
    }

    // Clamp to 1-5
    const finalScore = Math.max(1, Math.min(5, Math.round(score)))

    scores.push({
      goalId: goal.id,
      goalTitle: goal.title,
      score: finalScore,
      reason: reasons.join('; ') || 'no direct alignment found',
    })
  }

  return scores
}

// ── Goal → ADR mapping ───────────────────────────────────────────────────

export interface GoalAdrMapping {
  goalId: string
  goalTitle: string
  adrs: { id: string; title: string; status: string; alignment: number }[]
}

export async function getGoalAdrMappings(): Promise<GoalAdrMapping[]> {
  const goals = await readGoalsFile()
  const decisions = await listDecisions()

  const mappings: GoalAdrMapping[] = []

  for (const goal of goals) {
    const adrs: GoalAdrMapping['adrs'] = []

    for (const decision of decisions) {
      // Check if any option references this goal
      for (const option of decision.options) {
        if (option.relatedGoals?.includes(goal.id)) {
          adrs.push({
            id: decision.id,
            title: decision.title,
            status: decision.status,
            alignment: option.goalAlignment ?? 0,
          })
          break
        }
      }
    }

    mappings.push({
      goalId: goal.id,
      goalTitle: goal.title,
      adrs,
    })
  }

  return mappings
}

// ── ADR → Goal mapping ───────────────────────────────────────────────────

export interface AdrGoalMapping {
  adrId: string
  adrTitle: string
  goals: { id: string; title: string; alignment: number }[]
}

export async function getAdrGoalMappings(adrId: string): Promise<AdrGoalMapping | null> {
  const goals = await readGoalsFile()
  const decisions = await listDecisions()

  const decision = decisions.find(d => d.id === adrId)
  if (!decision) {
    return null
  }

  const goalMappings: AdrGoalMapping['goals'] = []

  for (const option of decision.options) {
    if (option.relatedGoals) {
      for (const goalId of option.relatedGoals) {
        const goal = goals.find(g => g.id === goalId)
        if (goal) {
          goalMappings.push({
            id: goal.id,
            title: goal.title,
            alignment: option.goalAlignment ?? 0,
          })
        }
      }
    }
  }

  return {
    adrId: decision.id,
    adrTitle: decision.title,
    goals: goalMappings,
  }
}

// ── Invariant checks ─────────────────────────────────────────────────────

export interface GoalInvariantResult {
  pass: boolean
  violations: string[]
  warnings: string[]
}

export async function checkGoalInvariants(): Promise<GoalInvariantResult> {
  const goals = await readGoalsFile()
  const decisions = await listDecisions()
  const violations: string[] = []
  const warnings: string[] = []

  // E1: Decisions must reference at least one goal
  for (const decision of decisions) {
    if (decision.status === 'rejected') continue

    const hasGoalReference = decision.options.some(o =>
      o.relatedGoals && o.relatedGoals.length > 0
    )
    if (!hasGoalReference) {
      violations.push(`${decision.id}: no option references any goal`)
    }
  }

  // E2: Key results must have measurable targets
  for (const goal of goals) {
    for (const obj of goal.objectives) {
      for (const kr of obj.keyResults) {
        if (kr.target <= 0) {
          warnings.push(`${kr.id}: target must be > 0`)
        }
      }
    }
  }

  // E3: Goals must have owners
  for (const goal of goals) {
    if (!goal.owner || goal.owner === '') {
      warnings.push(`${goal.id}: owner is required`)
    }
  }

  // E4: Atomic units should reference goals (soft warning)
  // This is checked per-unit in the devops loop

  return {
    pass: violations.length === 0,
    violations,
    warnings,
  }
}

// ── Format alignment for display ──────────────────────────────────────────

export function formatGoalAdrAlignment(goalId: string, mappings: GoalAdrMapping): string {
  const lines: string[] = []

  lines.push(`ADR Alignment for Goal ${mappings.goalId}: ${mappings.goalTitle}`)
  lines.push('')

  if (mappings.adrs.length === 0) {
    lines.push('No ADRs reference this goal.')
    lines.push('')
    lines.push('Run `bun run devops goals score <adr-id>` to score ADRs against this goal.')
  } else {
    lines.push('| ADR | Title | Status | Alignment |')
    lines.push('|-----|-------|--------|-----------|')

    for (const adr of mappings.adrs) {
      lines.push(`| ${adr.id} | ${adr.title} | ${adr.status} | ${adr.alignment}/5 |`)
    }
  }

  return lines.join('\n')
}

export function formatAdrGoalAlignment(adrId: string, mappings: AdrGoalMapping | null): string {
  if (!mappings) {
    return `ADR ${adrId} not found.`
  }

  const lines: string[] = []

  lines.push(`Goal Alignment for ${mappings.adrId}: ${mappings.adrTitle}`)
  lines.push('')

  if (mappings.goals.length === 0) {
    lines.push('No goals reference this ADR.')
    lines.push('')
    lines.push('Add `relatedGoals` to ADR options to establish alignment.')
  } else {
    lines.push('| Goal | Title | Alignment |')
    lines.push('|------|-------|-----------|')

    for (const goal of mappings.goals) {
      lines.push(`| ${goal.id} | ${goal.title} | ${goal.alignment}/5 |`)
    }
  }

  return lines.join('\n')
}
