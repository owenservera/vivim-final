// src/engines/harness-feedback-coordinator.ts
// Harness Feedback Coordinator (017-harness-command-registry, US3).
//
// Drives multi-round LLM refinement of harness I/O. Defect fixed from the pasted
// design: it re-sent the SAME prompt every round. We apply BACKOFF + DIFF — each
// round N>1 receives (a) the prior failed/partial output, (b) only the delta
// diff of what was wrong, and (c) an escalated strategy. Repeating the identical
// prompt would never converge.

export type FeedbackStrategy = 'initial' | 'repair' | 'elaborate' | 'decompose'

export interface FeedbackTurn {
  round: number
  prompt: string
  strategy: FeedbackStrategy
  produced?: string
  accepted: boolean
}

export interface FeedbackConfig {
  maxRounds?: number
  baseBackoffMs?: number
}

export interface FeedbackOutcome {
  ok: boolean
  rounds: number
  turns: FeedbackTurn[]
  finalContent?: string
  acceptedIndex: number
}

export class HarnessFeedbackCoordinator {
  private readonly maxRounds: number
  private readonly baseBackoffMs: number

  constructor(config: FeedbackConfig = {}) {
    this.maxRounds = config.maxRounds ?? 3
    this.baseBackoffMs = config.baseBackoffMs ?? 300
  }

  /**
   * Build the prompt for a given round. `priorFailed` is the last produced
   * content (if any); `diff` is the delta describing what was wrong. The prompt
   * is DIFFERENT every round — never a verbatim repeat.
   */
  buildRoundPrompt(
    round: number,
    basePrompt: string,
    priorFailed?: string,
    diff?: string,
  ): {
    prompt: string
    strategy: FeedbackStrategy
  } {
    if (round <= 1) {
      return { prompt: basePrompt, strategy: 'initial' }
    }
    const strategy: FeedbackStrategy =
      round === 2 ? 'repair' : round === 3 ? 'elaborate' : 'decompose'
    const parts: string[] = []
    parts.push(`[Round ${round}] Prior attempt did not satisfy constraints.`)
    if (priorFailed) parts.push(`Prior output:\n---\n${priorFailed}\n---`)
    if (diff) parts.push(`What was wrong (delta):\n${diff}`)
    parts.push(
      strategy === 'repair'
        ? 'Repair the specific issues above and return corrected output only.'
        : strategy === 'elaborate'
          ? 'The output was incomplete. Elaborate the missing parts and return the full corrected output.'
          : 'The task is too large for one shot. Decompose and return the first self-contained piece.',
    )
    return { prompt: parts.join('\n\n'), strategy }
  }

  /**
   * Run the refinement loop. `produce` is a callback that takes the round
   * prompt + strategy and returns the LLM content. `accept` decides whether the
   * produced content is good enough to stop. Backoff grows between rounds.
   */
  async run(
    basePrompt: string,
    produce: (prompt: string, strategy: FeedbackStrategy, round: number) => Promise<string>,
    accept: (content: string, round: number) => boolean | Promise<boolean>,
  ): Promise<FeedbackOutcome> {
    const turns: FeedbackTurn[] = []
    let priorFailed: string | undefined
    let lastDiff: string | undefined
    let acceptedIndex = -1
    let finalContent: string | undefined

    for (let round = 1; round <= this.maxRounds; round++) {
      const { prompt, strategy } = this.buildRoundPrompt(round, basePrompt, priorFailed, lastDiff)
      const produced = await produce(prompt, strategy, round)
      const accepted = await accept(produced, round)
      turns.push({ round, prompt, strategy, produced, accepted })

      if (accepted) {
        acceptedIndex = round - 1
        finalContent = produced
        break
      }

      // Not accepted: carry forward for the next (different) round.
      priorFailed = produced
      lastDiff = this.diff(priorFailed)
      if (round < this.maxRounds) {
        await new Promise((r) => setTimeout(r, this.baseBackoffMs * round))
      }
    }

    return {
      ok: acceptedIndex >= 0,
      rounds: turns.length,
      turns,
      finalContent,
      acceptedIndex,
    }
  }

  /** Cheap heuristic diff of what's likely wrong (placeholder for a real diff). */
  private diff(content: string): string {
    if (!content.trim()) return 'Output was empty.'
    if (content.includes('```') && !content.includes('```')) return 'Code fence was not closed.'
    return 'Output did not match the expected schema/constraints.'
  }
}
