// devops/agentic/packager.ts
// ContextPackager — produces compact handoff artifacts.
//
// When a limited-context agent completes a task, it produces a <500-token
// handoff that the NEXT agent instance reads INSTEAD of re-reading the full
// codebase. The packager also auto-generates a resume prompt for the next
// instance.
//
// Two output modes:
//   1. Handoff artifact — written after each completed task, ~300-500 tokens
//   2. Resume prompt — the exact text the next agent instance should receive,
//      including: objective, current state, next task, required files, last
//      handoff summary.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { AgenticTask } from './decomposer.js'
import type { StateSnapshot } from './probe.js'

export interface TaskHandoff {
  taskId: string
  objective: string
  status: 'done' | 'failed' | 'blocked'
  /** What was accomplished (compact — ~100 tokens). */
  summary: string
  /** Files created or modified. */
  filesChanged: string[]
  /** Test results summary. */
  testsPassed: number
  testsFailed: number
  /** Gate result. */
  typecheckPassed: boolean
  lintPassed: boolean
  /** Any blockers the next task must resolve first. */
  blockers: string[]
  completedAt: number
}

export interface AgentHandoff {
  /** The overarching objective. */
  objective: string
  /** Current phase (0-based index into TaskDAG.phases). */
  phase: number
  /** Total phases. */
  totalPhases: number
  /** All tasks completed so far. */
  completedTasks: TaskHandoff[]
  /** The next task to execute. */
  nextTask: AgenticTask | null
  /** Compact state snapshot (from StateProbe, updated after each task). */
  stateSnapshot: StateSnapshot | null
  /** Total tokens estimated for the remaining tasks. */
  remainingEstimatedTokens: number
}

const HANDOFF_DIR = '.runtime/agentic'

function ensureDir(): void {
  mkdirSync(join(process.cwd(), HANDOFF_DIR), { recursive: true })
}

export function writeHandoff(handoff: TaskHandoff): void {
  ensureDir()
  writeFileSync(
    join(process.cwd(), HANDOFF_DIR, `handoff-${handoff.taskId.replace('.', '-')}.json`),
    JSON.stringify(handoff, null, 2),
    'utf8',
  )
}

export function readHandoff(taskId: string): TaskHandoff | null {
  const p = join(process.cwd(), HANDOFF_DIR, `handoff-${taskId.replace('.', '-')}.json`)
  try {
    if (!existsSync(p)) return null
    return JSON.parse(readFileSync(p, 'utf8')) as TaskHandoff
  } catch {
    return null
  }
}

export function writeAgentHandoff(handoff: AgentHandoff): void {
  ensureDir()
  writeFileSync(
    join(process.cwd(), HANDOFF_DIR, 'agent-handoff.json'),
    JSON.stringify(handoff, null, 2),
    'utf8',
  )
}

export function readAgentHandoff(): AgentHandoff | null {
  const p = join(process.cwd(), HANDOFF_DIR, 'agent-handoff.json')
  try {
    if (!existsSync(p)) return null
    return JSON.parse(readFileSync(p, 'utf8')) as AgentHandoff
  } catch {
    return null
  }
}

/**
 * Generate the EXACT resume prompt the next agent instance should receive.
 * This is designed to be <2000 tokens so a fresh 150K-token agent has maximum
 * room for implementation.
 */
export function generateResumePrompt(handoff: AgentHandoff): string {
  const completed = handoff.completedTasks
    .map((h) => `- [${h.status === 'done' ? 'x' : '!'}] ${h.taskId}: ${h.summary.slice(0, 100)}`)
    .join('\n')

  const nextTask = handoff.nextTask
  const nextTaskText = nextTask
    ? `
## Next Task: ${nextTask.id} — ${nextTask.objective}

${nextTask.description}

### Required files (read these first):
${nextTask.requiredFiles.map((f) => `- ${f}`).join('\n')}

### Files you will modify/create:
${nextTask.producesFiles.map((f) => `- ${f}`).join('\n')}

### Verification:
\`${nextTask.verification}\`

### Estimated token cost for required files: ${nextTask.estimatedTokens.toLocaleString()}
`
    : 'All tasks complete. Run the gate task to verify.'

  const gaps = handoff.stateSnapshot?.criticalGaps
  const gapsText = gaps?.length
    ? '\n## Known Gaps\n' + gaps.map((g) => `- ${g}`).join('\n')
    : ''

  return `# Agentic Task: ${handoff.objective.slice(0, 80)}

Phase ${handoff.phase + 1}/${handoff.totalPhases} | Remaining tokens: ~${handoff.remainingEstimatedTokens.toLocaleString()}

## Completed (${completed.length})
${completed}
${gapsText}
${nextTaskText}

## Instructions
1. Read ONLY the required files listed above — do not read the entire codebase
2. Implement the changes
3. Run the verification command
4. When done, produce a compact handoff by writing to \`.runtime/agentic/handoff-${nextTask?.id?.replace('.', '-') ?? 'done'}.json\` with: { taskId, status, summary, filesChanged, testsPassed, testsFailed, typecheckPassed, blockers }
5. State "HANDOFF COMPLETE" when the handoff file exists

## Context budget
You have ~150K tokens. Required files cost ~${nextTask?.estimatedTokens?.toLocaleString() ?? '0'} tokens.
You have ~${((150000 - (nextTask?.estimatedTokens ?? 0))).toLocaleString()} tokens remaining for implementation.
If you approach the context limit, produce the handoff EARLY — the next instance will resume.`
}

/** Create a fresh agent handoff from a decomposed objective. */
export function createAgentHandoff(
  objective: string,
  tasks: AgenticTask[],
  phases: number[][],
  snapshot: StateSnapshot,
): AgentHandoff {
  const firstTaskIdx = phases[0]?.[0]
  const nextTask = firstTaskIdx !== undefined ? tasks[firstTaskIdx] ?? null : null

  return {
    objective,
    phase: 0,
    totalPhases: phases.length,
    completedTasks: [],
    nextTask,
    stateSnapshot: snapshot,
    remainingEstimatedTokens: tasks.reduce((s, t) => s + t.estimatedTokens, 0),
  }
}

/** Advance to the next task after a completed handoff. */
export function advanceHandoff(prev: AgentHandoff, completed: TaskHandoff, tasks: AgenticTask[], phases: number[][]): AgentHandoff {
  const newCompleted = [...prev.completedTasks, completed]
  const completedIds = new Set(newCompleted.map((h) => h.taskId))

  // Find next uncompleted task respecting topological order
  let nextTask: AgenticTask | null = null
  let nextPhase = prev.phase

  for (let p = 0; p < phases.length; p++) {
    const taskIndices = phases[p]!
    const allDone = taskIndices.every((i) => completedIds.has(tasks[i]!.id))
    if (!allDone) {
      nextPhase = p
      for (const idx of taskIndices) {
        const t = tasks[idx]!
        if (!completedIds.has(t.id) && t.dependsOn.every((d) => completedIds.has(d))) {
          nextTask = t
          break
        }
      }
      break
    }
    if (p === phases.length - 1 && allDone) {
      nextPhase = phases.length // all done
    }
  }

  const remainingTokens = tasks
    .filter((t) => !completedIds.has(t.id))
    .reduce((s, t) => s + t.estimatedTokens, 0)

  return {
    objective: prev.objective,
    phase: nextPhase,
    totalPhases: phases.length,
    completedTasks: newCompleted,
    nextTask,
    stateSnapshot: prev.stateSnapshot,
    remainingEstimatedTokens: remainingTokens,
  }
}
