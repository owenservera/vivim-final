// devops/onboard-ledger.ts
// Resumable onboarding ledger (mirrors devops/runtime-test/loop-state.ts).
// Persisted to .runtime/onboard-ledger.json so `onboard run --resume` and
// `--from=<phase>` can recover without redoing completed phases.

import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { dirname } from 'node:path'

export type OnboardPhase =
  | 'discover'
  | 'infer'
  | 'test-selectors'
  | 'test-parse'
  | 'test-cap'
  | 'test-frontend'
  | 'verify'
  | 'converge'

export const ONBOARD_PHASES: OnboardPhase[] = [
  'discover',
  'infer',
  'test-selectors',
  'test-parse',
  'test-cap',
  'test-frontend',
  'verify',
  'converge',
]

export type PhaseStatus = 'pending' | 'running' | 'done' | 'failed'

export interface LedgerPhase {
  phase: OnboardPhase
  status: PhaseStatus
  detail?: string
  startedAt?: number
  finishedAt?: number
}

export interface OnboardingLedger {
  goal: string
  provider: string
  url?: string
  phases: LedgerPhase[]
  createdAt: number
  updatedAt: number
}

const LEDGER_PATH = '.runtime/onboard-ledger.json'

export function initOnboardLedger(goal: string, provider: string, url?: string): OnboardingLedger {
  const now = Date.now()
  const ledger: OnboardingLedger = {
    goal,
    provider,
    url,
    phases: ONBOARD_PHASES.map((phase) => ({ phase, status: 'pending' })),
    createdAt: now,
    updatedAt: now,
  }
  return ledger
}

export async function loadOnboardLedger(): Promise<OnboardingLedger | null> {
  if (!existsSync(LEDGER_PATH)) return null
  try {
    const raw = await readFile(LEDGER_PATH, 'utf8')
    return JSON.parse(raw) as OnboardingLedger
  } catch {
    return null
  }
}

export async function saveOnboardLedger(ledger: OnboardingLedger): Promise<void> {
  ledger.updatedAt = Date.now()
  await mkdir(dirname(LEDGER_PATH), { recursive: true })
  await writeFile(LEDGER_PATH, JSON.stringify(ledger, null, 2), 'utf8')
}

export function markPhase(
  ledger: OnboardingLedger,
  phase: OnboardPhase,
  status: PhaseStatus,
  detail?: string,
): void {
  const entry = ledger.phases.find((p) => p.phase === phase)
  if (!entry) return
  entry.status = status
  if (detail != null) entry.detail = detail
  if (status === 'running' && entry.startedAt == null) entry.startedAt = Date.now()
  if (status === 'done' || status === 'failed') entry.finishedAt = Date.now()
  ledger.updatedAt = Date.now()
}

/** Index of the first non-done phase (for --resume). */
export function nextPendingIndex(ledger: OnboardingLedger): number {
  const idx = ledger.phases.findIndex((p) => p.status !== 'done')
  return idx === -1 ? ledger.phases.length : idx
}

/** Slice phases for --from=<phase> or --resume. */
export function phasesFrom(ledger: OnboardingLedger, fromPhase?: OnboardPhase, resume = false): OnboardPhase[] {
  let startIndex = 0
  if (resume) {
    startIndex = nextPendingIndex(ledger)
  } else if (fromPhase) {
    const idx = ONBOARD_PHASES.indexOf(fromPhase)
    if (idx >= 0) startIndex = idx
  }
  return ONBOARD_PHASES.slice(startIndex)
}
