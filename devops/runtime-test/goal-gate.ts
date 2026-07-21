// devops/runtime-test/goal-gate.ts
// Unit 1.5 — Goal-resolution gate.
//
// AGENT-SAFE: prefers offline catalog match (no server); only probes /api/nlcl/interpret if
// the catalog yields nothing AND a server is likely up (bounded fetch). If the goal
// cannot be reduced to a known capability id + slug, the loop must HALT and ask rather
// than build the wrong thing. This enforces the SKILL's "interview-first" rule as code.

import { matchGoalToCapability, readCatalog } from './cap-catalog.js'
import { backendBaseUrl } from './port.js'

const FETCH_TIMEOUT_MS = 8_000

export interface GoalAssessment {
  resolved: boolean
  capabilityId?: string
  slug?: string
  needsClarification: boolean
  reason?: string
}

/**
 * Decide whether `goal` maps to a buildable capability.
 * Returns `needsClarification: true` when nothing matches — the caller should STOP
 * and ask the user instead of proceeding.
 */
export async function assessGoal(goal: string, opts?: { probe?: boolean }): Promise<GoalAssessment> {
  if (!goal || goal.trim().length < 3) {
    return { resolved: false, needsClarification: true, reason: 'goal too short' }
  }

  // 1) Offline catalog match (no server required)
  const cap = matchGoalToCapability(goal)
  if (cap) {
    return { resolved: true, capabilityId: cap.id, slug: cap.slug, needsClarification: false }
  }

  // 2) Optional NL probe (only if caller opted in and a server may be up)
  if (opts?.probe) {
    try {
      const res = await fetch(`${backendBaseUrl()}/api/nlcl/interpret`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: goal }),
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      })
      const data = (await res.json()) as { ok?: boolean; capabilityId?: string; text?: string }
      if (data.ok && data.capabilityId) {
        return { resolved: true, capabilityId: data.capabilityId, needsClarification: false }
      }
    } catch {
      // server down — fall through to clarification
    }
  }

  return {
    resolved: false,
    needsClarification: true,
    reason: `no capability matches "${goal}" in offline catalog${
      opts?.probe ? ' or NL resolver' : ''
    }`,
  }
}
