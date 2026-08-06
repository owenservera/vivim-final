/**
 * VIVIM Review System — Run State & Progress Tracker
 *
 * The self-driving layer. Every run has a `run-state.json` recording which
 * deterministic artifacts exist and which agentic review units have produced a
 * report. The driver reads state so the HUMAN NEVER HAS TO REMEMBER anything:
 * re-running with no args resumes exactly where the run left off.
 *
 * State is derived, never hand-maintained: a unit is "done" iff its report file
 * exists and is non-empty. Re-running the driver re-derives this from disk.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import type { ReviewUnit } from './taxonomy.js'

export interface UnitState {
  id: string
  title: string
  done: boolean
  report: string
}

export interface RunState {
  runId: string
  depth: string
  createdAt: string
  updatedAt: string
  /** path to the discovery manifest.json (input for agentic units) */
  manifest: string
  /** path to the quantitative health dashboard (input for agentic units) */
  health: string
  /** path to the changed-surface delta */
  delta: string
  /** deterministic artifacts confirmed present */
  artifacts: { manifest: boolean; health: boolean; delta: boolean }
  units: UnitState[]
  /** free-text note from the last driver run */
  lastNote?: string
}

export function statePath(runDir: string): string {
  return join(runDir, 'run-state.json')
}

/** Derive unit progress from the filesystem. */
export function readState(runDir: string): RunState | null {
  const p = statePath(runDir)
  if (!existsSync(p)) return null
  try {
    return JSON.parse(readFileSync(p, 'utf8')) as RunState
  } catch {
    return null
  }
}

export interface StateInput {
  runId: string
  runDir: string
  depth: string
  units: ReviewUnit[]
  manifest: string
  health: string
  delta: string
}

/** Recompute current unit progress from disk and persist it. */
export function refreshRunState(input: StateInput): RunState {
  const prior = readState(input.runDir)
  const units: UnitState[] = input.units.map((u) => {
    const reportPath = join(input.runDir, u.report)
    const done = existsSync(reportPath) && readFileSync(reportPath, 'utf8').trim().length > 0
    return {
      id: u.id,
      title: u.title,
      done,
      report: u.report,
    }
  })

  const state: RunState = {
    runId: input.runId,
    depth: input.depth,
    createdAt: prior?.createdAt ?? new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    manifest: input.manifest,
    health: input.health,
    delta: input.delta,
    artifacts: {
      manifest: existsSync(input.manifest),
      health: existsSync(input.health),
      delta: existsSync(input.delta),
    },
    units,
  }

  mkdirSync(input.runDir, { recursive: true })
  writeFileSync(statePath(input.runDir), JSON.stringify(state, null, 2))
  return state
}