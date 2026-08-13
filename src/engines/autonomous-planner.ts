// src/engines/autonomous-planner.ts
// Pure planner helpers for AutonomousExecutionEngine.
//
// Extracted from autonomous-execution.ts (Phase 1.3 monolith split) so the
// planner logic is independently testable without the engine's CDP / governor
// dependencies. Re-exported from autonomous-execution.ts for backward compat.

import { ConsentViolationError } from '../errors.js'
import { newId } from '../ids.js'
import type {
  ActionClassification,
  AutonomousGoal,
  AutonomousStep,
} from './autonomous-types.js'
import { classificationAtLeast, toAutonomousClassification } from './autonomous-types.js'
import type { ParsedIntent } from './nlcl/types.js'

// ── Pure planner helpers (exported for unit tests) ───────────────────────

// Build an AutonomousStep from a resolved intent node.
function assembleStep(
  index: number,
  goal: AutonomousGoal,
  description: string,
  action: string,
  input: Record<string, unknown>,
): AutonomousStep {
  const classification = toAutonomousClassification((input.classification as string) ?? 'read')
  return {
    id: newId(),
    taskId: '',
    stepIndex: index,
    description,
    action,
    actionInput: input,
    classification,
    status: 'pending',
    result: null,
    error: null,
    startedAt: null,
    completedAt: null,
    requiresHumanApproval: classificationAtLeast(classification, goal.requireApprovalAbove),
    parentStepId: null,
    isCompositeRoot: false,
  }
}

// Unit 36.2: resolves which LLM provider the planner should use for a goal.
// - no override (or 'local') → LocalModelAdapter (offline, always allowed)
// - any other provider is an outbound/cloud model and is only honored when the
//   user has consented; otherwise a ConsentViolationError is raised.

export interface PlannerResolution {
  provider: string
  local: boolean
}

export function resolvePlanner(
  goal: AutonomousGoal,
  opts: { airgap: boolean; consented: boolean },
): PlannerResolution {
  const override = goal.llmProvider
  if (!override || override === 'local') {
    return { provider: 'local', local: true }
  }
  if (!opts.consented) {
    throw new ConsentViolationError(override)
  }
  return { provider: override, local: false }
}

// Maps a resolved intent (CapabilityDAG root + alternatives) into
// AutonomousSteps. Empty/null intent → 0 steps.
export function planStepsFromIntent(
  goal: AutonomousGoal,
  intent: ParsedIntent | null,
): AutonomousStep[] {
  if (!intent || !intent.capabilityId) return []
  const nodes: ParsedIntent[] = [intent, ...(intent.alternatives ?? [])]
  const steps: AutonomousStep[] = []
  for (const node of nodes) {
    if (!node.capabilityId) continue
    const classification = toAutonomousClassification(node.classification ?? 'read')
    steps.push(
      assembleStep(steps.length, goal, node.intent || goal.description, node.capabilityId, {
        ...node.input,
        inputMapping: node.input,
        classification,
      }),
    )
  }
  if (steps.length > goal.maxSteps) return steps.slice(0, goal.maxSteps)
  return steps
}

// Built-in offline planner used when no LLM resolver is injected. Always runs
// locally (no outbound model): it parses the goal description for browser /
// destructive / read keywords into concrete AutonomousSteps the engine can
// execute directly via the governor or capability registry.
export function planStepsLocally(goal: AutonomousGoal): AutonomousStep[] {
  const text = goal.description.toLowerCase()
  const steps: AutonomousStep[] = []
  const add = (
    action: string,
    classification: ActionClassification,
    extra: Record<string, unknown> = {},
  ) => {
    if (steps.length >= goal.maxSteps) return
    steps.push(
      assembleStep(steps.length, goal, goal.description, action, { ...extra, classification }),
    )
  }

  // Unit 8.9: composite actions — if description starts with 'composite:', emit a single composite step
  const compositeMatch = goal.description.match(/^composite:(.+)$/i)
  if (compositeMatch) {
    add(`composite:${compositeMatch[1]}`, 'read')
    return steps
  }

  const urlMatch = goal.description.match(/https?:\/\/[^\s]+|(?:\b[a-z0-9-]+\.)+[a-z]{2,}\b/i)
  const url = urlMatch ? (urlMatch[0] as string) : undefined
  if (url) add('navigate', 'navigate', { url })
  if (/\bscreenshot\b/.test(text)) add('screenshot', 'read')
  if (/\b(delete|remove|permanent|drop|truncate|wipe)\b/.test(text))
    add('destructive', 'destructive')
  if (/\b(summar|summarize)\b/.test(text)) add('summarize', 'read')
  if (/\b(search|find)\b/.test(text) && !url) add('search', 'read', { query: goal.description })
  if (steps.length === 0) add('task', 'read')
  return steps
}
