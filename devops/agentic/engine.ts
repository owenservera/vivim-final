// devops/agentic/engine.ts
// AgenticTaskEngine — orchestrator for the limited-context agent loop.
//
// The engine bridges the decompose → state → execute → compact → handoff cycle.
// It is designed to be DRIVEN BY a CLI command that a limited-context
// agent (opencode, claude code, etc.) calls. The engine itself is stateless
// between calls — all state lives in the filesystem handoff artifacts.
//
// Commands:
//   bun run devops agentic start --objective="..."
//     → decomposes the objective, probes state, writes initial handoff,
//       prints the resume prompt the agent should follow
//
//   bun run devops agentic resume
//     → reads the current handoff, advances past completed tasks (by reading
//       handoff files), prints the resume prompt for the next task
//
//   bun run devops agentic done --task=<id> [--failed]
//     → records a task as done or failed, updates the handoff, prints next
//
//   bun run devops agentic status
//     → prints the current handoff state as JSON

import { type AgenticTask, type TaskDAG, decomposeObjective } from './decomposer.js'
import {
  type AgentHandoff,
  type TaskHandoff,
  advanceHandoff,
  createAgentHandoff,
  generateResumePrompt,
  readAgentHandoff,
  readHandoff,
  writeAgentHandoff,
  writeHandoff,
} from './packager.js'
import { type StateSnapshot, generateStateSnapshot, writeSnapshot } from './probe.js'

export interface StartResult {
  ok: boolean
  objective: string
  phases: number
  tasks: number
  totalEstimatedTokens: number
  /** The resume prompt the agent should immediately follow. */
  resumePrompt: string
  /** Written to .runtime/agentic/agent-handoff.json */
  handoffPath: string
  /** Written to .runtime/state-snapshot.json */
  snapshotPath: string
}

export async function startLoop(objective: string): Promise<StartResult> {
  const dag: TaskDAG = decomposeObjective(objective)
  const snapshot: StateSnapshot = generateStateSnapshot()
  writeSnapshot(snapshot)

  const handoff = createAgentHandoff(objective, dag.tasks, dag.phases, snapshot)
  writeAgentHandoff(handoff)

  // Write individual task files so they can be tracked
  const { writeFileSync, mkdirSync } = require('node:fs')
  const { join } = require('node:path')
  mkdirSync(join(process.cwd(), '.runtime', 'agentic', 'tasks'), { recursive: true })
  for (const t of dag.tasks) {
    writeFileSync(
      join(process.cwd(), '.runtime', 'agentic', 'tasks', `${t.id.replace('.', '-')}.json`),
      JSON.stringify(t, null, 2),
      'utf8',
    )
  }

  const prompt = generateResumePrompt(handoff)

  return {
    ok: true,
    objective,
    phases: dag.phases.length,
    tasks: dag.tasks.length,
    totalEstimatedTokens: dag.totalEstimatedTokens,
    resumePrompt: prompt,
    handoffPath: '.runtime/agentic/agent-handoff.json',
    snapshotPath: '.runtime/state-snapshot.json',
  }
}

export interface ResumeResult {
  ok: boolean
  objective: string
  phase: number
  totalPhases: number
  tasksCompleted: number
  tasksTotal: number
  allDone: boolean
  resumePrompt: string | null
  handoff: AgentHandoff | null
}

export function resumeLoop(): ResumeResult {
  const handoff = readAgentHandoff()
  if (!handoff) {
    return {
      ok: false,
      objective: '',
      phase: 0,
      totalPhases: 0,
      tasksCompleted: 0,
      tasksTotal: 0,
      allDone: false,
      resumePrompt: null,
      handoff: null,
    }
  }

  // Scan for completed task handoffs and advance
  let current = handoff
  const { readdirSync, existsSync } = require('node:fs')
  const { join } = require('node:path')
  const taskDir = join(process.cwd(), '.runtime', 'agentic', 'tasks')
  const handoffDir = join(process.cwd(), '.runtime', 'agentic')

  // Load all tasks
  const tasks: AgenticTask[] = []
  const phases: number[][] = []
  if (existsSync(taskDir)) {
    const files = readdirSync(taskDir).filter((f: string) => f.endsWith('.json'))
    for (const f of files.sort()) {
      try {
        const t = JSON.parse(require('node:fs').readFileSync(join(taskDir, f), 'utf8')) as AgenticTask
        tasks.push(t)
      } catch { /* skip */ }
    }
  }

  // Reconstruct phases from task dependencies
  const completedIds = new Set<string>()
  for (const hf of handoff.completedTasks) {
    completedIds.add(hf.taskId)
  }

  // Check for handoff files that aren't in the handoff's completed list
  if (existsSync(handoffDir)) {
    const files = readdirSync(handoffDir).filter((f: string) => f.startsWith('handoff-') && f.endsWith('.json') && f !== 'agent-handoff.json')
    for (const f of files) {
      const taskId = f.replace('handoff-', '').replace('.json', '').replace('-', '.')
      if (!completedIds.has(taskId)) {
        const hf = readHandoff(taskId)
        if (hf && hf.status === 'done') {
          completedIds.add(taskId)
          // Reconstruct phases
          const assigned = new Set(handoff.completedTasks.map((h) => h.taskId))
          assigned.add(taskId)
          while (assigned.size < tasks.length) {
            const phase: number[] = []
            for (let i = 0; i < tasks.length; i++) {
              const t = tasks[i]!
              if (assigned.has(t.id)) continue
              if (t.dependsOn.every((d) => assigned.has(d))) {
                phase.push(i)
                assigned.add(t.id)
              }
            }
            if (phase.length === 0) break
            phases.push(phase)
          }
          // Update completed tasks
          current = {
            ...current,
            completedTasks: [...current.completedTasks, hf],
          }
        }
      }
    }
  }

  // Compute current phase
  if (phases.length === 0 && tasks.length > 0) {
    // Simple reconstruction
    const assigned2 = new Set(current.completedTasks.map((h) => h.taskId))
    while (assigned2.size < tasks.length) {
      const phase: number[] = []
      for (let i = 0; i < tasks.length; i++) {
        const t = tasks[i]!
        if (assigned2.has(t.id)) continue
        if (t.dependsOn.every((d) => assigned2.has(d))) {
          phase.push(i)
          assigned2.add(t.id)
        }
      }
      if (phase.length === 0) break
      phases.push(phase)
    }
  }

  // Find next task
  let nextTask: AgenticTask | null = null
  let phaseIdx = 0
  for (let p = 0; p < phases.length; p++) {
    const indices = phases[p]!
    const allDone = indices.every((i) => completedIds.has(tasks[i]?.id ?? ''))
    if (!allDone) {
      phaseIdx = p
      for (const idx of indices) {
        const t = tasks[idx]!
        if (!completedIds.has(t.id) && t.dependsOn.every((d) => completedIds.has(d))) {
          nextTask = t
          break
        }
      }
      break
    }
    if (p === phases.length - 1 && allDone) {
      phaseIdx = phases.length
    }
  }

  current = { ...current, phase: phaseIdx, totalPhases: phases.length || current.totalPhases, nextTask }
  const remainingTokens = tasks
    .filter((t) => !completedIds.has(t.id))
    .reduce((s, t) => s + t.estimatedTokens, 0)
  current = { ...current, remainingEstimatedTokens: remainingTokens }

  const allDone = completedIds.size >= tasks.length && tasks.length > 0

  const prompt = allDone || !nextTask
    ? '# All tasks complete!\n\nRun `bun run devops gate` to verify all changes.'
    : generateResumePrompt(current)

  return {
    ok: true,
    objective: current.objective,
    phase: current.phase,
    totalPhases: current.totalPhases,
    tasksCompleted: current.completedTasks.length,
    tasksTotal: tasks.length,
    allDone,
    resumePrompt: prompt,
    handoff: current,
  }
}

export interface MarkDoneResult {
  ok: boolean
  taskId: string
  status: string
  nextPrompt: string | null
}

export function markTaskDone(taskId: string, status: 'done' | 'failed' | 'blocked' = 'done'): MarkDoneResult {
  const handoff = readAgentHandoff()
  if (!handoff || !handoff.nextTask) {
    return {
      ok: false,
      taskId,
      status: 'no_active_handoff',
      nextPrompt: null,
    }
  }

  const hf = readHandoff(taskId) ?? readHandoff(handoff.nextTask.id)
  if (!hf) {
    // Create a minimal handoff from what we know
    const now = Date.now()
    const newHf: TaskHandoff = {
      taskId: handoff.nextTask.id,
      objective: handoff.nextTask.objective,
      status,
      summary: status === 'done' ? 'Task completed' : 'Task failed',
      filesChanged: handoff.nextTask.producesFiles,
      testsPassed: 0,
      testsFailed: 0,
      typecheckPassed: false,
      lintPassed: false,
      blockers: [],
      completedAt: now,
    }
    writeHandoff(newHf)

    // Advance the handoff
    const { readdirSync, existsSync } = require('node:fs')
    const { join } = require('node:path')
    const taskDir = join(process.cwd(), '.runtime', 'agentic', 'tasks')
    const tasks: AgenticTask[] = []
    const phases: number[][] = []
    if (existsSync(taskDir)) {
      const files = readdirSync(taskDir).filter((f: string) => f.endsWith('.json'))
      for (const f of files.sort()) {
        try {
          const t = JSON.parse(require('node:fs').readFileSync(join(taskDir, f), 'utf8')) as AgenticTask
          tasks.push(t)
        } catch { /* skip */ }
      }
    }

    const newHandoff = advanceHandoff(handoff, newHf, tasks, phases.length > 0 ? phases : [[0]])
    writeAgentHandoff(newHandoff)

    const prompt = generateResumePrompt(newHandoff)
    return { ok: true, taskId: newHf.taskId, status, nextPrompt: prompt }
  }

  // Already has handoff — just regenerate prompt
  const newHandoff = readAgentHandoff()
  const prompt = newHandoff ? generateResumePrompt(newHandoff) : null

  return { ok: true, taskId: hf.taskId, status: hf.status, nextPrompt: prompt }
}
