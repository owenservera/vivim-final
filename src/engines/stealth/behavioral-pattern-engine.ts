// src/engines/stealth/behavioral-pattern-engine.ts
// Unit 14.4 — BehavioralPatternEngine: request timing + interaction rhythm.

import type { StealthContext, StealthModule } from './stealth-module-engine.js'

interface BehavioralConfig {
  thinkTimeMinMs: number
  thinkTimeMaxMs: number
  betweenActionsMinMs: number
  betweenActionsMaxMs: number
  readingPauseProbability: number
  readingPauseMs: number
  jitterMs: number
  pageLoadSettleMs: number
}

const DEFAULT_CONFIG: BehavioralConfig = {
  thinkTimeMinMs: 1500,
  thinkTimeMaxMs: 5000,
  betweenActionsMinMs: 300,
  betweenActionsMaxMs: 1500,
  readingPauseProbability: 0.3,
  readingPauseMs: 2000,
  jitterMs: 200,
  pageLoadSettleMs: 1000,
}

export class BehavioralPatternModule implements StealthModule {
  name = 'behavioral_pattern'
  detectionVector = 'Behavioral timing analysis (request rhythm, interaction cadence, think-time)'
  description =
    'Adds human-like delays between operations: reading pauses, think-time, mouse wandering'
  priority = 25

  private config: BehavioralConfig = DEFAULT_CONFIG

  async apply(config: Record<string, unknown>, _ctx: StealthContext): Promise<void> {
    this.config = {
      thinkTimeMinMs: (config.thinkTimeMinMs as number) ?? DEFAULT_CONFIG.thinkTimeMinMs,
      thinkTimeMaxMs: (config.thinkTimeMaxMs as number) ?? DEFAULT_CONFIG.thinkTimeMaxMs,
      betweenActionsMinMs:
        (config.betweenActionsMinMs as number) ?? DEFAULT_CONFIG.betweenActionsMinMs,
      betweenActionsMaxMs:
        (config.betweenActionsMaxMs as number) ?? DEFAULT_CONFIG.betweenActionsMaxMs,
      readingPauseProbability:
        (config.readingPauseProbability as number) ?? DEFAULT_CONFIG.readingPauseProbability,
      readingPauseMs: (config.readingPauseMs as number) ?? DEFAULT_CONFIG.readingPauseMs,
      jitterMs: (config.jitterMs as number) ?? DEFAULT_CONFIG.jitterMs,
      pageLoadSettleMs: (config.pageLoadSettleMs as number) ?? DEFAULT_CONFIG.pageLoadSettleMs,
    }
  }

  async waitForThinkTime(): Promise<void> {
    const delay =
      this.config.thinkTimeMinMs +
      Math.random() * (this.config.thinkTimeMaxMs - this.config.thinkTimeMinMs)
    await this.sleep(delay)
  }

  async waitForBetweenActions(): Promise<void> {
    const delay =
      this.config.betweenActionsMinMs +
      Math.random() * (this.config.betweenActionsMaxMs - this.config.betweenActionsMinMs) +
      (Math.random() - 0.5) * this.config.jitterMs
    await this.sleep(Math.max(0, delay))

    // Occasional reading pause
    if (Math.random() < this.config.readingPauseProbability) {
      await this.sleep(this.config.readingPauseMs)
    }
  }

  async waitForPageSettle(): Promise<void> {
    await this.sleep(this.config.pageLoadSettleMs)
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, Math.max(0, ms)))
  }
}
