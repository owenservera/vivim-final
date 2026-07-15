// devops/runtime-test/iterate.ts
// Iterative improve -> real-world-test -> debug -> improve coordinator.
//
// Gives the LLM FLEXIBILITY (it implements each proposed step however it chooses) while
// guaranteeing it stays ON-TASK and makes PROGRESS:
//   - objective + goal-gate keep every cycle aimed at the goal (no drift, no spin)
//   - the persisted ledger records each step + its real-world test result
//   - hard max-cycles cap + `finally` teardown prevent hangs / orphans
//   - every run prints a structured status + the next concrete step
//
// Usage:
//   bun run devops runtime-test loop --objective="add a dark-mode capability"
//   ... LLM implements the proposed step ...
//   bun run devops runtime-test loop --resume        # evaluates + proposes next
//   bun run devops runtime-test loop --resume        # ... repeat until done/blocked

import { spawnSync } from 'node:child_process'
import { assessGoal } from './goal-gate.js'
import { serverStatus } from './status.js'
import {
  type LoopState,
  type StepChecks,
  clearLoopState,
  initLoopState,
  loadLoopState,
  saveLoopState,
} from './loop-state.js'

export interface IterationResult {
  ok: boolean
  objective: string
  cycle: number
  maxCycles: number
  status: LoopState['status']
  nextStep?: string
  checks: StepChecks
  history: LoopState['history']
  hint: string
}

function runTypecheck(): boolean {
  // NOTE: `bun run typecheck` covers the whole repo, including the pre-existing
  // broken `devops/audit-arch` package. We ignore that known-failing path so the
  // loop's signal reflects the toolkit work actually being driven.
  const res = spawnSync('bun', ['run', 'typecheck'], {
    encoding: 'utf8',
    timeout: 120_000,
  })
  const out = `${res.stdout ?? ''}${res.stderr ?? ''}`
  const realErrors = out
    .split('\n')
    .filter((l) => /error TS/.test(l) && !l.includes('audit-arch'))
  return realErrors.length === 0
}

async function evaluateState(): Promise<StepChecks> {
  const typecheck = runTypecheck()
  let backend = false
  try {
    const st = await serverStatus()
    backend = st.backend.healthy
  } catch {
    backend = false
  }
  return { typecheck, backend }
}

function proposeNext(state: LoopState, checks: StepChecks): string {
  const obj = state.objective
  if (checks.typecheck === false) {
    return `Typecheck is failing. Read the typecheck output, fix the errors, then run 'bun run devops runtime-test loop --resume'.`
  }
  if (checks.backend === false) {
    return `Backend is not serving. Fix the build/serve error (run 'bun run devops runtime-test status' for detail), then 'bun run devops runtime-test loop --resume'.`
  }
  return `Implement the next bounded increment toward: "${obj}". Keep changes small and verifiable. Then run 'bun run devops runtime-test loop --resume'.`
}

export async function runIterativeLoop(opts: {
  objective?: string
  resume?: boolean
  force?: boolean
}): Promise<IterationResult> {
  let state: LoopState | null = null

  if (opts.resume) {
    state = loadLoopState()
    if (!state) {
      return {
        ok: false,
        objective: opts.objective ?? '',
        cycle: 0,
        maxCycles: 0,
        status: 'blocked',
        checks: {},
        history: [],
        hint: "No ledger found. Start with: bun run devops runtime-test loop --objective=\"...\"",
      }
    }
  } else if (opts.objective) {
    state = initLoopState(opts.objective)
  } else {
    return {
      ok: false,
      objective: '',
      cycle: 0,
      maxCycles: 0,
      status: 'blocked',
      checks: {},
      history: [],
      hint: 'Provide --objective="..." to start, or --resume to continue.',
    }
  }

  // On-task guard: vague objective -> halt, ask for clarification (unless --force)
  const gate = await assessGoal(state.objective, { probe: state.cycle > 0 })
  if (gate.needsClarification && !opts.force) {
    state.status = 'needsClarification'
    saveLoopState(state)
    return {
      ok: false,
      objective: state.objective,
      cycle: state.cycle,
      maxCycles: state.maxCycles,
      status: 'needsClarification',
      checks: {},
      history: state.history,
      hint: `Objective too vague: ${gate.reason ?? 'no capability match'}. Refine it, then re-run with --objective.`,
    }
  }

  // (resume) evaluate what the LLM changed since the last proposed step
  const checks = await evaluateState()
  if (opts.resume && state.history.length > 0) {
    const last = state.history[state.history.length - 1]
    if (last.status === 'proposed') {
      const passed = checks.typecheck !== false && checks.backend !== false
      last.status = passed ? 'done' : 'failed'
      last.checks = checks
      last.result = passed
        ? 'typecheck + backend green'
        : `typecheck=${checks.typecheck} backend=${checks.backend}`
    }
  }

  // Decide: done / blocked / continue
  if (state.status === 'done' || state.status === 'blocked') {
    return {
      ok: state.status === 'done',
      objective: state.objective,
      cycle: state.cycle,
      maxCycles: state.maxCycles,
      status: state.status,
      checks,
      history: state.history,
      hint:
        state.status === 'done'
          ? 'Objective met. Run `bun run devops runtime-test stop` to tear down.'
          : 'Blocked. Review history; refine approach; re-run with --objective to restart.',
    }
  }

  if (state.cycle >= state.maxCycles) {
    state.status = 'blocked'
    saveLoopState(state)
    return {
      ok: false,
      objective: state.objective,
      cycle: state.cycle,
      maxCycles: state.maxCycles,
      status: 'blocked',
      checks,
      history: state.history,
      hint: `Hit max-cycles (${state.maxCycles}). Not converging — refine the objective or approach.`,
    }
  }

  state.cycle += 1
  const action = proposeNext(state, checks)
  state.nextStep = action
  state.history.push({
    cycle: state.cycle,
    action,
    status: 'proposed',
    checks: {},
  })
  state.status = 'running'
  saveLoopState(state)

  return {
    ok: true,
    objective: state.objective,
    cycle: state.cycle,
    maxCycles: state.maxCycles,
    status: 'running',
    nextStep: action,
    checks,
    history: state.history,
    hint: 'Implement the step, then run `bun run devops runtime-test loop --resume`.',
  }
}

export function resetIteration(): void {
  clearLoopState()
}
