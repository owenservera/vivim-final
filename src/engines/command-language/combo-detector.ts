// ─── Combo Detector ─────────────────────────────────────────────────
// Analyzes dependency graph between commands, determines sequential vs parallel.

import type { ComboStep, CommandCombo, CommandContext, CommandIntent } from './types.js'

/**
 * Dependencies between command categories.
 * If category A depends on category B, then B must execute first.
 */
const CATEGORY_DEPENDENCIES: Record<string, string[]> = {
  conversation: ['provider'], // Sending a message depends on provider being set
  send: ['provider'],
  draft: ['provider'],
  tag: ['conversation'],
  export: ['conversation'],
  review: ['conversation'],
}

/**
 * Detect combo execution plan from multiple intents.
 */
export function detectCombo(intents: CommandIntent[], _ctx: CommandContext): CommandCombo {
  if (intents.length === 0) {
    return { steps: [], executionMode: 'sequential' }
  }

  if (intents.length === 1) {
    return {
      steps: [
        {
          intent: intents[0]!,
          dependsOn: [],
          parallel: false,
        },
      ],
      executionMode: 'sequential',
    }
  }

  // Build dependency graph
  const steps: ComboStep[] = intents.map((intent) => ({
    intent,
    dependsOn: [] as string[],
    parallel: false,
  }))

  // Analyze dependencies
  for (let i = 0; i < intents.length; i++) {
    const intent = intents[i]!
    const deps = CATEGORY_DEPENDENCIES[intent.category] ?? []

    for (let j = 0; j < intents.length; j++) {
      if (i === j) continue
      const other = intents[j]!

      if (deps.includes(other.category)) {
        steps[i]!.dependsOn.push(`step-${j}`)
      }
    }
  }

  // Determine execution mode
  const hasDeps = steps.some((s) => s.dependsOn.length > 0)
  const executionMode = hasDeps ? 'sequential' : 'parallel'

  // Mark independent steps as parallel
  if (executionMode === 'parallel') {
    for (const step of steps) {
      step.parallel = true
    }
  }

  // Topological sort for sequential execution
  if (executionMode === 'sequential') {
    const sorted = topologicalSort(steps)
    return { steps: sorted, executionMode }
  }

  return { steps, executionMode }
}

/**
 * Topological sort of combo steps based on dependencies.
 */
function topologicalSort(steps: ComboStep[]): ComboStep[] {
  const sorted: ComboStep[] = []
  const visited = new Set<number>()
  const visiting = new Set<number>()

  const stepMap = new Map<string, ComboStep>()
  for (let i = 0; i < steps.length; i++) {
    stepMap.set(`step-${i}`, steps[i]!)
  }

  function visit(index: number) {
    if (visited.has(index)) return
    if (visiting.has(index)) {
      return
    }
    visiting.add(index)

    const step = steps[index]!
    for (const dep of step.dependsOn) {
      const depIndex = Number.parseInt(dep.replace('step-', ''), 10)
      if (!Number.isNaN(depIndex)) {
        visit(depIndex)
      }
    }

    visiting.delete(index)
    visited.add(index)
    sorted.push(step)
  }

  for (let i = 0; i < steps.length; i++) {
    visit(i)
  }

  return sorted
}
