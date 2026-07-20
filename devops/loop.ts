// devops/loop.ts
// Autonomous closure loop: given a tracker, repeatedly select the next
// implementable unit, run the regression-scoped quality gate, and transition
// the unit's state (in_progress -> done|blocked) — optionally committing a
// passing unit. This removes the manual mark/gate/commit bookkeeping that
// previously required a human in the loop after each unit's implementation.
//
// The implementation of each unit is still performed by the dev-loop agent
// (or a human). `run` only *closes* the loop: it verifies the work against
// the captured baseline and advances tracker state with zero supervision.

import { runGate } from './gate.ts'
import { selectNext } from './select.ts'
import { markUnit, markUnitDoneLoop } from './mark.ts'
import { ensureBaseline } from './baseline.ts'

export interface LoopOptions {
  maxUnits?: number
  commit?: boolean
  strict?: boolean
}

export interface LoopResult {
  processed: number
  done: string[]
  blocked: string[]
  allComplete: boolean
}

export async function runLoop(opts: LoopOptions = {}): Promise<LoopResult> {
  // Regression mode requires a baseline; capture once if missing so
  // pre-existing repo debt is tolerated rather than blocking the loop.
  await ensureBaseline()

  const done: string[] = []
  const blocked: string[] = []
  let processed = 0
  const max = opts.maxUnits ?? Number.POSITIVE_INFINITY

  while (processed < max) {
    const sel = await selectNext()
    if (!sel) break

    await markUnit(sel.id, 'in_progress')
    const gate = await runGate(opts.strict ?? false, false, 'regression')

    if (gate.pass) {
      // Single-pass completion: mark done + append PROGRESS audit line with
      // the resolved sha, folded into ONE git commit (matches the documented
      // invariant — no second commit, no [PENDING-COMMIT] placeholder left behind).
      await markUnitDoneLoop(sel.id, `${sel.name} [autonomous loop]`)
      done.push(sel.id)
      console.log(`[loop] ${sel.id} -> done  (${gate.summary})`)
    } else {
      await markUnit(sel.id, 'blocked')
      blocked.push(sel.id)
      console.error(`[loop] ${sel.id} -> BLOCKED  (${gate.summary})`)
    }
    processed++
  }

  return {
    processed,
    done,
    blocked,
    allComplete: blocked.length === 0,
  }
}
