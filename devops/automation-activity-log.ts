// devops/automation-activity-log.ts
// Unified automation activity log. Composes with the existing AuditTrail engine
// (Unit 9.4). Every automation run — onboarding modes AND the broader devops/speckit
// loops — emits a structured AuditEntry so the automation system itself can be
// post-mortemed and improved holistically.
//
// Actions follow a dotted namespace:
//   onboard.discover | onboard.infer | onboard.test-selectors | onboard.test-parse
//   onboard.test-cap | onboard.test-frontend | onboard.verify | onboard.converge
//   loop.step | loop.objective
//
// details carry whatever the mode produced: confidence, selector, rawBodyHash,
// llmCommand, etc. (AuditTrail already redacts password/token/secret.)

import { AuditTrail } from '../src/engines/audit-trail.js'
import { FileAuditSink } from './activity-sink.js'

export const automationLog = new AuditTrail()

// Register the JSONL sink. Path is overridable for tests via env.
const ACTIVITY_PATH = process.env.AUTOMATION_ACTIVITY_LOG ?? '.runtime/activity.log'
automationLog.addSink(new FileAuditSink(ACTIVITY_PATH))

export type ActivityResult = 'success' | 'failure' | 'denied'

export interface ActivityDetails {
  /** Free-form structured payload. Avoid secrets — AuditTrail redacts known fields. */
  [k: string]: unknown
}

/**
 * Emit a single structured activity entry.
 * @param action   dotted namespace, e.g. "onboard.test-selectors"
 * @param targetType  what the action targeted, e.g. "provider", "iteration", "parser"
 * @param details  structured payload (confidence, selector, rawBodyHash, llmCommand...)
 * @param result   defaults to "success"; set "failure" on gate failures / errors
 */
export function activity(
  action: string,
  targetType: string,
  details: ActivityDetails,
  result: ActivityResult = 'success',
): void {
  automationLog.record({
    actor: 'automation',
    action,
    targetType,
    result,
    details,
  })
}

// ── Query API for post-mortems ─────────────────────────────────

export interface ActivityQuery {
  action?: string
  targetType?: string
  /** Inclusive lower bound (ms epoch). */
  from?: number
  /** Inclusive upper bound (ms epoch). */
  to?: number
}

/**
 * Read back recorded activities from the JSONL sink for post-mortem analysis.
 * Best-effort: returns [] if the file cannot be read.
 */
export async function queryActivity(filter: ActivityQuery = {}): Promise<import('../src/engines/audit-trail.js').AuditEntry[]> {
  const { readFile } = await import('node:fs/promises')
  try {
    const raw = await readFile(ACTIVITY_PATH, 'utf8')
    const entries = raw
      .split('\n')
      .filter(Boolean)
      .map((l) => {
        try {
          return JSON.parse(l) as import('../src/engines/audit-trail.js').AuditEntry
        } catch {
          return null
        }
      })
      .filter((e): e is import('../src/engines/audit-trail.js').AuditEntry => e !== null)

    return entries.filter((e) => {
      if (filter.action && e.action !== filter.action) return false
      if (filter.targetType && e.targetType !== filter.targetType) return false
      if (filter.from != null && e.ts < filter.from) return false
      if (filter.to != null && e.ts > filter.to) return false
      return true
    })
  } catch {
    return []
  }
}
