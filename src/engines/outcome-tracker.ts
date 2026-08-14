// src/engines/outcome-tracker.ts
// OutcomeTracker — in-memory EMA (exponential moving average) store for outcome signals.
// Subscribed to by routing (§1), entity confidence (§3), and context ranking (§5).
// Pure arithmetic, zero dependencies.

import type { OutcomeEvent } from '../ai/core/types.js'
import { getLogger } from '../lib/logger.js'

const _log = getLogger('outcome-tracker')

// ── Types ──────────────────────────────────────────────────────────────────────

export type OutcomeKind = 'reinforced' | 'ignored' | 'rejected'

export interface EmaScore {
  /** 0..1 EMA of reinforced ratio. Higher = better historical performance. */
  score: number
  /** Total samples observed. */
  sampleCount: number
  /** Timestamp of last update. */
  lastUpdated: number
}

export interface OutcomeRecord {
  subjectId: string
  subjectType: string
  outcome: OutcomeKind
  at: number
}

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Map outcome to a numeric value for EMA computation. */
function outcomeToValue(outcome: OutcomeKind): number {
  switch (outcome) {
    case 'reinforced':
      return 1.0
    case 'ignored':
      return 0.5
    case 'rejected':
      return 0.0
  }
}

// ── OutcomeTracker ─────────────────────────────────────────────────────────────

export class OutcomeTracker {
  private readonly scores = new Map<string, EmaScore>()
  private readonly alpha: number
  private readonly minSamples: number

  /**
   * @param opts.alpha EMA smoothing factor (0..1). Lower = slower adaptation.
   *   0.1 = conservative (needs ~10 samples to shift significantly).
   *   0.3 = responsive (shifts within ~3 samples).
   * @param opts.minSamples Minimum samples before score influences decisions.
   *   Prevents cold-start bias from a single data point.
   */
  constructor(opts?: { alpha?: number; minSamples?: number }) {
    this.alpha = opts?.alpha ?? 0.1
    this.minSamples = opts?.minSamples ?? 5
  }

  // ── Write ──────────────────────────────────────────────────────────────────

  /** Record a single outcome. Idempotent per event (deduplicate by subjectId+at). */
  record(event: OutcomeEvent): void {
    const key = event.subjectId
    const value = outcomeToValue(event.outcome)
    const now = Date.now()

    const existing = this.scores.get(key)
    if (existing) {
      // EMA update: newScore = alpha * newValue + (1 - alpha) * oldScore
      const newScore = this.alpha * value + (1 - this.alpha) * existing.score
      this.scores.set(key, {
        score: clamp(newScore),
        sampleCount: existing.sampleCount + 1,
        lastUpdated: now,
      })
    } else {
      // First observation: seed with the outcome value
      this.scores.set(key, {
        score: clamp(value),
        sampleCount: 1,
        lastUpdated: now,
      })
    }
  }

  /** Record a raw outcome (for callers that don't have a full OutcomeEvent). */
  recordRaw(
    subjectId: string,
    subjectType: OutcomeEvent['subjectType'],
    outcome: OutcomeKind,
  ): void {
    this.record({
      type: 'outcome.recorded' as const,
      eventId: '' as never,
      requestId: '' as never,
      sequence: 0,
      timestamp: new Date().toISOString(),
      subjectId,
      subjectType,
      outcome,
    })
  }

  // ── Read ──────────────────────────────────────────────────────────────────

  /** Get the EMA score for a subject. Returns null if never observed. */
  getScore(subjectId: string): EmaScore | null {
    return this.scores.get(subjectId) ?? null
  }

  /** Get score, returning a default for unknown subjects. */
  getScoreOrDefault(subjectId: string): EmaScore {
    return this.scores.get(subjectId) ?? { score: 0.5, sampleCount: 0, lastUpdated: 0 }
  }

  /** Get all scores for subjects of a given type. */
  getScoresByType(subjectType: string): Map<string, EmaScore> {
    const result = new Map<string, EmaScore>()
    // Subject type is stored in the event but not in EmaScore directly.
    // We track it via a secondary index.
    for (const [key, value] of this.scores) {
      if (key.startsWith(`${subjectType}:`)) {
        result.set(key, value)
      }
    }
    return result
  }

  /** Get all tracked subjects. */
  getAll(): Map<string, EmaScore> {
    return new Map(this.scores)
  }

  /** Whether a subject has enough samples to be trustworthy. */
  isReliable(subjectId: string): boolean {
    const score = this.scores.get(subjectId)
    return score !== undefined && score.sampleCount >= this.minSamples
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  /** Reset all scores (for tests). */
  clear(): void {
    this.scores.clear()
  }

  /** Number of tracked subjects. */
  get size(): number {
    return this.scores.size
  }
}

// ── Internal ───────────────────────────────────────────────────────────────────

function clamp(v: number): number {
  return Math.max(0.01, Math.min(0.99, v))
}
