// src/engines/situation-detector.ts
// SituationDetector — classify user's current task type from message + history.

import { newId } from '../ids.js'
import type { SituationStore } from '../storage/contracts/situation-store.js'
import type { MemoryEngine } from './memory-engine.js'

// ── Types (from atomic 17.1) ───────────────────────────────────────────────

export type TaskType =
  | 'coding'
  | 'writing'
  | 'researching'
  | 'planning'
  | 'debugging'
  | 'learning'
  | 'reviewing'
  | 'designing'
  | 'data_analysis'
  | 'general'

export interface SituationSignal {
  type: TaskType
  confidence: number
  signals: Array<{ indicator: string; weight: number; matched: boolean }>
}

export interface DetectionInput {
  message: string
  conversationId?: string
  recentMessages?: Array<{ role: string; content: string }>
}

// ── Signal patterns (from upgrade-05 / atomic 17.1 §Signal Patterns) ────────

interface SignalPattern {
  type: TaskType
  indicators: Array<{ pattern: RegExp; weight: number; indicator: string }>
}

const SIGNAL_PATTERNS: SignalPattern[] = [
  {
    type: 'debugging',
    indicators: [
      {
        pattern: /\b(error|bug|crash|fix|exception|traceback|stack\s?trace)\b/i,
        weight: 0.4,
        indicator: 'error/bug keywords',
      },
      {
        pattern: /\b(type\s?error|reference\s?error|syntax\s?error|null\s?error)\b/i,
        weight: 0.5,
        indicator: 'specific error type',
      },
      {
        pattern: /\b(not\s?working|broken|fails?|failing|issue|problem)\b/i,
        weight: 0.3,
        indicator: 'failure keywords',
      },
      {
        pattern: /\b(debug|diagnose|investigate|trace)\b/i,
        weight: 0.3,
        indicator: 'debug action',
      },
    ],
  },
  {
    type: 'coding',
    indicators: [
      { pattern: /```[\s\S]*```/, weight: 0.5, indicator: 'code block' },
      {
        pattern: /\b(function|const|let|var|class|import|export|async|await|return)\b/,
        weight: 0.3,
        indicator: 'code keyword',
      },
      {
        pattern: /\b(\.ts|\.js|\.py|\.go|\.rs|\.tsx|\.jsx)\b/,
        weight: 0.3,
        indicator: 'file extension',
      },
      {
        pattern: /\b(implement|write\s+code|create\s+function|build\s+a|add\s+a\s+method)\b/i,
        weight: 0.4,
        indicator: 'coding action',
      },
      {
        pattern: /\b(refactor|optimize|clean\s+up|simplify)\b/i,
        weight: 0.3,
        indicator: 'code improvement',
      },
    ],
  },
  {
    type: 'writing',
    indicators: [
      {
        pattern: /\b(write|draft|article|blog|essay|post|story|copy|content)\b/i,
        weight: 0.4,
        indicator: 'writing action',
      },
      {
        pattern: /\b(rewrite|edit|revise|polish|proofread|improve\s+the\s+text)\b/i,
        weight: 0.4,
        indicator: 'editing action',
      },
      {
        pattern: /\b(paragraph|heading|title|introduction|conclusion|section)\b/i,
        weight: 0.3,
        indicator: 'document structure',
      },
      {
        pattern: /\b(tone|voice|style|audience|reader)\b/i,
        weight: 0.2,
        indicator: 'writing style',
      },
    ],
  },
  {
    type: 'researching',
    indicators: [
      {
        pattern: /\b(search|find|look\s+up|compare|what\s+is|how\s+does|explain)\b/i,
        weight: 0.3,
        indicator: 'research action',
      },
      {
        pattern: /\b(difference\s+between|vs\.?|versus|pros?\s+and\s+cons?|alternatives?)\b/i,
        weight: 0.4,
        indicator: 'comparison',
      },
      {
        pattern: /\b(overview|summary|deep\s+dive|analysis|investigation)\b/i,
        weight: 0.3,
        indicator: 'analysis request',
      },
      {
        pattern: /\b(source|reference|citation|evidence|data\s+shows?)\b/i,
        weight: 0.2,
        indicator: 'evidence request',
      },
    ],
  },
  {
    type: 'planning',
    indicators: [
      {
        pattern: /\b(plan|roadmap|strategy|outline|structure|organize)\b/i,
        weight: 0.4,
        indicator: 'planning action',
      },
      {
        pattern: /\b(phase|milestone|deadline|priority|backlog|sprint)\b/i,
        weight: 0.3,
        indicator: 'project management',
      },
      {
        pattern: /\b(break\s+down|decompose|steps?|tasks?|steps)\b/i,
        weight: 0.3,
        indicator: 'decomposition',
      },
      {
        pattern: /\b(should\s+we|let'?s|how\s+should|what'?s\s+the\s+best\s+way)\b/i,
        weight: 0.2,
        indicator: 'decision request',
      },
    ],
  },
  {
    type: 'learning',
    indicators: [
      {
        pattern: /\b(learn|teach|explain|understand|concept|tutorial)\b/i,
        weight: 0.4,
        indicator: 'learning action',
      },
      {
        pattern: /\b(what\s+is|how\s+does|why\s+does|can\s+you\s+explain)\b/i,
        weight: 0.3,
        indicator: 'question pattern',
      },
      {
        pattern: /\b(example|demo|walkthrough|step\s+by\s+step)\b/i,
        weight: 0.3,
        indicator: 'example request',
      },
      {
        pattern: /\b(basics?|fundamentals?|beginner|introduction|getting\s+started)\b/i,
        weight: 0.3,
        indicator: 'skill level',
      },
    ],
  },
  {
    type: 'reviewing',
    indicators: [
      {
        pattern: /\b(review|check|audit|evaluate|assess|feedback)\b/i,
        weight: 0.4,
        indicator: 'review action',
      },
      {
        pattern: /\b(code\s+review|pull\s+request|PR|diff|changes?)\b/i,
        weight: 0.4,
        indicator: 'code review',
      },
      {
        pattern: /\b(bugs?|issues?|improvements?|suggestions?|concerns?)\b/i,
        weight: 0.2,
        indicator: 'findings',
      },
    ],
  },
  {
    type: 'designing',
    indicators: [
      {
        pattern: /\b(design|ui|ux|layout|interface|component|wireframe|mockup)\b/i,
        weight: 0.4,
        indicator: 'design action',
      },
      {
        pattern: /\b(visual|color|typography|spacing|responsive|grid)\b/i,
        weight: 0.3,
        indicator: 'design element',
      },
      {
        pattern: /\b(figma|sketch|photoshop|css|tailwind|styled)\b/i,
        weight: 0.3,
        indicator: 'design tool',
      },
    ],
  },
  {
    type: 'data_analysis',
    indicators: [
      {
        pattern: /\b(analyze|analysis|data|metrics|statistics|chart|graph|dashboard)\b/i,
        weight: 0.4,
        indicator: 'analysis action',
      },
      {
        pattern: /\b(SQL|query|aggregation|group\s+by|filter|aggregate)\b/i,
        weight: 0.3,
        indicator: 'data operation',
      },
      {
        pattern: /\b(trend|pattern|correlation|distribution|outlier)\b/i,
        weight: 0.3,
        indicator: 'statistical concept',
      },
    ],
  },
]

// ── SituationDetector ──────────────────────────────────────────────────────

export class SituationDetector {
  constructor(
    private store: SituationStore,
    private memory?: MemoryEngine,
  ) {}

  async detect(input: DetectionInput): Promise<SituationSignal> {
    const text = this.buildAnalysisText(input)
    const scores = this.scorePatterns(text)

    // Check recent conversation history for context boost
    if (input.recentMessages?.length) {
      this.applyHistoryBoost(scores, input.recentMessages)
    }

    // Check learned preferences for user-specific boost
    if (input.conversationId) {
      await this.applyPreferenceBoost(scores, input.conversationId)
    }

    // Find winner
    const sorted = scores.sort((a, b) => b.score - a.score)
    const winner = sorted[0]
    if (!winner || winner.score === 0) {
      return { type: 'general', confidence: 0.3, signals: [] }
    }

    // Normalize confidence to 0-1 range
    const maxPossible = Math.max(
      ...SIGNAL_PATTERNS.map((p) => p.indicators.reduce((s, i) => s + i.weight, 0)),
    )
    const confidence = Math.min(1, winner.score / (maxPossible * 0.6))

    // Build signal detail list
    const signals = winner.pattern.indicators.map((ind) => ({
      indicator: ind.indicator,
      weight: ind.weight,
      matched: ind.pattern.test(text),
    }))

    const result: SituationSignal = {
      type: winner.type,
      confidence: Math.round(confidence * 100) / 100,
      signals,
    }

    // Persist log (best-effort)
    if (input.conversationId) {
      try {
        await this.store.createLog({
          id: newId(),
          conversationId: input.conversationId,
          detectedType: result.type,
          confidence: result.confidence,
          signalsJson: JSON.stringify(result.signals),
          timestamp: Date.now(),
        })
      } catch {
        // Best-effort logging
      }
    }

    return result
  }

  async detectFromMessage(message: string): Promise<SituationSignal> {
    return this.detect({ message })
  }

  async learnFromCorrection(
    _conversationId: string,
    detectedType: TaskType,
    actualType: TaskType,
  ): Promise<void> {
    // Store correction as user preference for future boosting
    await this.store.createUserPreference({
      id: newId(),
      userId: 'default',
      key: `correction:${detectedType}`,
      value: actualType,
      learnedAt: Date.now(),
    })
  }

  // ── Private ────────────────────────────────────────────────────────────

  private buildAnalysisText(input: DetectionInput): string {
    const parts = [input.message]
    if (input.recentMessages) {
      for (const msg of input.recentMessages.slice(-5)) {
        parts.push(msg.content)
      }
    }
    return parts.join(' ')
  }

  private scorePatterns(
    text: string,
  ): Array<{ type: TaskType; score: number; pattern: SignalPattern }> {
    return SIGNAL_PATTERNS.map((pattern) => {
      let score = 0
      for (const ind of pattern.indicators) {
        if (ind.pattern.test(text)) {
          score += ind.weight
        }
      }
      return { type: pattern.type, score, pattern }
    })
  }

  private applyHistoryBoost(
    scores: Array<{ type: TaskType; score: number; pattern: SignalPattern }>,
    recentMessages: Array<{ role: string; content: string }>,
  ): void {
    const recentText = recentMessages
      .slice(-3)
      .map((m) => m.content)
      .join(' ')
    for (const entry of scores) {
      for (const ind of entry.pattern.indicators) {
        if (ind.pattern.test(recentText)) {
          entry.score += ind.weight * 0.3 // 30% history boost
        }
      }
    }
  }

  private async applyPreferenceBoost(
    scores: Array<{ type: TaskType; score: number; pattern: SignalPattern }>,
    conversationId: string,
  ): Promise<void> {
    try {
      const recent = await this.store.getRecentForConversation(conversationId, 5)
      if (recent.length === 0) return

      // Count recent detected types
      const typeCounts: Record<string, number> = {}
      for (const log of recent) {
        typeCounts[log.detectedType] = (typeCounts[log.detectedType] ?? 0) + 1
      }

      // Boost matching types by 15%
      for (const entry of scores) {
        const count = typeCounts[entry.type] ?? 0
        if (count > 0) {
          entry.score *= 1 + count * 0.15
        }
      }
    } catch {
      // Best-effort preference boost
    }
  }
}
