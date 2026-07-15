// devops/runtime-test/loop-state.ts
// Persisted progress ledger for the iterative improve->test->debug loop.
//
// The LLM is the IMPLEMENTER; the loop is the COORDINATOR + EVALUATOR. Each run:
//   1. (resume) evaluate what the LLM changed since the last proposed step
//   2. record it in the ledger (on-task continuity across cycles + interruptions)
//   3. propose the next bounded step, or conclude (done/blocked)
// The ledger is the single source of truth that keeps a flexible LLM on-task.

import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs'

export type StepStatus = 'proposed' | 'done' | 'failed' | 'blocked'
export type LoopStatus = 'running' | 'done' | 'blocked' | 'needsClarification'

export interface StepChecks {
  typecheck?: boolean
  tests?: boolean
  backend?: boolean
}

export interface StepRecord {
  cycle: number
  action: string
  status: StepStatus
  checks: StepChecks
  result?: string
}

export interface LoopState {
  objective: string
  maxCycles: number
  cycle: number
  status: LoopStatus
  history: StepRecord[]
  nextStep?: string
  createdAt: number
  updatedAt: number
}

const LEDGER = '.runtime/loop-state.json'

export function loadLoopState(): LoopState | null {
  try {
    if (!existsSync(LEDGER)) return null
    return JSON.parse(readFileSync(LEDGER, 'utf8')) as LoopState
  } catch {
    return null
  }
}

export function saveLoopState(state: LoopState): void {
  state.updatedAt = Date.now()
  try {
    writeFileSync(LEDGER, JSON.stringify(state, null, 2), 'utf8')
  } catch {
    // best-effort
  }
}

export function initLoopState(objective: string, maxCycles = 8): LoopState {
  const now = Date.now()
  return {
    objective,
    maxCycles,
    cycle: 0,
    status: 'running',
    history: [],
    createdAt: now,
    updatedAt: now,
  }
}

export function clearLoopState(): void {
  try {
    if (existsSync(LEDGER)) rmSync(LEDGER, { force: true })
  } catch {
    // ignore
  }
}
