// src/engines/memory-engine.ts
// MemoryEngine — episodic, semantic, and procedural memory with learning

import { newId } from '../ids.js'
import type { CapabilityEventBus } from './capability-event-bus.js'

// ── Types ───────────────────────────────────────────────────────────────

export interface EpisodicMemory {
  id: string
  providerId: string
  capabilityId?: string
  slaveId?: string
  action: string
  input: Record<string, unknown>
  output: Record<string, unknown>
  success: boolean
  durationMs: number
  timestamp: number
  tags: string[]
}

export interface EpisodicMemoryInput {
  providerId: string
  capabilityId?: string
  slaveId?: string
  action: string
  input: Record<string, unknown>
  output: Record<string, unknown>
  success: boolean
  durationMs: number
  tags?: string[]
}

export interface SemanticMemory {
  id: string
  subject: string
  predicate: string
  object: unknown
  confidence: number
  source: string
  timestamp: number
  expiresAt?: number
}

export interface SemanticMemoryInput {
  subject: string
  predicate: string
  object: unknown
  confidence?: number
  source: string
  expiresAt?: number
}

export interface ProceduralRule {
  id: string
  name: string
  condition: string
  action: string
  confidence: number
  successCount: number
  failureCount: number
  lastTriggered?: number
  createdAt: number
  updatedAt: number
}

export interface ProceduralRuleInput {
  name: string
  condition: string
  action: string
  confidence?: number
}

export interface EpisodeQueryOpts {
  providerId?: string
  capabilityId?: string
  action?: string
  since?: number
  limit?: number
  tags?: string[]
  successOnly?: boolean
}

export interface RuleContext {
  providerId?: string
  capabilityId?: string
  action?: string
  currentUrl?: string
}

export interface AgentMemoryContext {
  recentEpisodes: EpisodicMemory[]
  relevantFacts: SemanticMemory[]
  applicableRules: ProceduralRule[]
}

export interface MiningResult {
  patternsFound: number
  rulesCreated: number
  rulesUpdated: number
}

// ── Store Contracts ─────────────────────────────────────────────────────

export interface EpisodicMemoryStore {
  save(episode: EpisodicMemory): Promise<void>
  query(opts: EpisodeQueryOpts): Promise<EpisodicMemory[]>
  count(): Promise<number>
}

export interface SemanticMemoryStore {
  save(fact: SemanticMemory): Promise<void>
  findBySubject(subject: string, predicate?: string): Promise<SemanticMemory[]>
  delete(id: string): Promise<void>
}

export interface ProceduralMemoryStore {
  save(rule: ProceduralRule): Promise<void>
  findByContext(ctx: RuleContext): Promise<ProceduralRule[]>
  findAll(): Promise<ProceduralRule[]>
  delete(id: string): Promise<void>
}

// ── Engine ──────────────────────────────────────────────────────────────

export class MemoryEngine {
  private consolidationTimer?: ReturnType<typeof setInterval>

  constructor(
    private readonly episodic: EpisodicMemoryStore,
    private readonly semantic: SemanticMemoryStore,
    private readonly procedural: ProceduralMemoryStore,
    private readonly eventBus: CapabilityEventBus,
  ) {}

  // ── Recording ───────────────────────────────────────────────────────────

  async recordEpisode(input: EpisodicMemoryInput): Promise<void> {
    const episode: EpisodicMemory = {
      id: newId(),
      ...input,
      tags: input.tags ?? [],
      timestamp: Date.now(),
    }
    await this.episodic.save(episode)
    this.eventBus.emit({ type: 'memory:episode_recorded', data: { id: episode.id } })
  }

  async assertFact(input: SemanticMemoryInput): Promise<void> {
    const fact: SemanticMemory = {
      id: newId(),
      ...input,
      confidence: input.confidence ?? 1.0,
      timestamp: Date.now(),
    }
    await this.semantic.save(fact)
    this.eventBus.emit({ type: 'memory:fact_asserted', data: { id: fact.id } })
  }

  async createRule(input: ProceduralRuleInput): Promise<void> {
    const rule: ProceduralRule = {
      id: newId(),
      ...input,
      confidence: input.confidence ?? 0.5,
      successCount: 0,
      failureCount: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    await this.procedural.save(rule)
    this.eventBus.emit({ type: 'memory:rule_created', data: { id: rule.id } })
  }

  // ── Querying ────────────────────────────────────────────────────────────

  async recallEpisodes(opts: EpisodeQueryOpts): Promise<EpisodicMemory[]> {
    return this.episodic.query({ ...opts, limit: opts.limit ?? 50 })
  }

  async recallFacts(subject: string, predicate?: string): Promise<SemanticMemory[]> {
    return this.semantic.findBySubject(subject, predicate)
  }

  async findRules(ctx: RuleContext): Promise<ProceduralRule[]> {
    return this.procedural.findByContext(ctx)
  }

  // ── Learning ────────────────────────────────────────────────────────────

  async learnFromEpisode(episode: EpisodicMemory): Promise<void> {
    if (episode.success) {
      const existingRules = await this.procedural.findByContext({
        providerId: episode.providerId,
        capabilityId: episode.capabilityId,
        action: episode.action,
      })

      if (existingRules.length > 0) {
        const rule = existingRules[0]
        if (rule) {
          rule.successCount++
          rule.confidence = Math.min(1.0, rule.confidence + 0.05)
          rule.lastTriggered = Date.now()
          rule.updatedAt = Date.now()
          await this.procedural.save(rule)
        }
      } else {
        await this.createRule({
          name: `auto_${episode.providerId}_${episode.action}`,
          condition: `provider="${episode.providerId}" AND action="${episode.action}"`,
          action: episode.action,
          confidence: 0.3,
        })
      }
    }
  }

  async minePatterns(opts?: { providerId?: string; since?: number }): Promise<MiningResult> {
    const since = opts?.since ?? Date.now() - 24 * 60 * 60 * 1000
    const episodes = await this.episodic.query({
      providerId: opts?.providerId,
      since,
      limit: 1000,
    })

    const actionCounts = new Map<string, { success: number; fail: number }>()
    for (const ep of episodes) {
      const key = `${ep.providerId}:${ep.action}`
      const existing = actionCounts.get(key) ?? { success: 0, fail: 0 }
      if (ep.success) existing.success++
      else existing.fail++
      actionCounts.set(key, existing)
    }

    let rulesCreated = 0
    let rulesUpdated = 0
    const existingRules = await this.procedural.findAll()

    for (const [key, counts] of actionCounts) {
      const parts = key.split(':')
      const providerId = parts[0] ?? ''
      const action = parts[1] ?? ''
      const total = counts.success + counts.fail
      const successRate = counts.success / total

      if (total < 3) continue

      const existing = existingRules.find(
        (r) => r.condition.includes(providerId) && r.condition.includes(action),
      )

      if (existing) {
        existing.successCount = counts.success
        existing.failureCount = counts.fail
        existing.confidence = successRate
        existing.updatedAt = Date.now()
        await this.procedural.save(existing)
        rulesUpdated++
      } else if (successRate > 0.7) {
        await this.createRule({
          name: `mined_${providerId}_${action}`,
          condition: `provider="${providerId}" AND action="${action}"`,
          action,
          confidence: successRate,
        })
        rulesCreated++
      }
    }

    return { patternsFound: actionCounts.size, rulesCreated, rulesUpdated }
  }

  async consolidate(): Promise<void> {
    const now = Date.now()
    const pruneThreshold = now - 30 * 24 * 60 * 60 * 1000
    const rules = await this.procedural.findAll()

    for (const rule of rules) {
      if (rule.confidence < 0.2 && rule.failureCount > rule.successCount * 2) {
        await this.procedural.delete(rule.id)
      } else if (rule.lastTriggered && rule.lastTriggered < pruneThreshold) {
        rule.confidence *= 0.9
        rule.updatedAt = now
        await this.procedural.save(rule)
      }
    }

    this.eventBus.emit({
      type: 'memory:consolidated',
      data: { rulesPruned: rules.length },
    })
  }

  // ── Knowledge types (Phase 15) ────────────────────────────────────────

  async recordEntity(input: {
    name: string
    type: string
    description?: string
    conversationId?: string
    messageId?: string
  }): Promise<void> {
    this.eventBus.emit({
      type: 'memory:entity_recorded',
      data: { name: input.name, type: input.type },
    })
  }

  async recordDecision(input: {
    conversationId: string
    messageId: string
    decisionText: string
    rationale?: string
    alternatives?: string[]
  }): Promise<void> {
    this.eventBus.emit({
      type: 'memory:decision_recorded',
      data: { conversationId: input.conversationId, decisionText: input.decisionText },
    })
  }

  async recordPattern(input: {
    name: string
    description: string
    patternType: string
  }): Promise<void> {
    this.eventBus.emit({
      type: 'memory:pattern_recorded',
      data: { name: input.name, patternType: input.patternType },
    })
  }

  async getTopics(): Promise<Array<{ id: string; name: string; description: string | null }>> {
    return []
  }

  async getProjects(): Promise<
    Array<{ id: string; name: string; description: string | null; status: string }>
  > {
    return []
  }

  async assignTopic(conversationId: string, topicId: string): Promise<void> {
    this.eventBus.emit({
      type: 'memory:topic_assigned',
      data: { conversationId, topicId },
    })
  }

  // ── Agent support ─────────────────────────────────────────────────────

  async getAgentContext(providerId: string, capabilityId: string): Promise<AgentMemoryContext> {
    const recentEpisodes = await this.recallEpisodes({
      providerId,
      capabilityId,
      limit: 10,
    })

    const relevantFacts = await this.recallFacts(providerId)

    const applicableRules = await this.findRules({ providerId, capabilityId })

    return { recentEpisodes, relevantFacts, applicableRules }
  }

  // ── Lifecycle ───────────────────────────────────────────────────────

  startConsolidation(intervalMs = 300_000): void {
    this.consolidationTimer = setInterval(async () => {
      await this.minePatterns()
      await this.consolidate()
    }, intervalMs)
  }

  stopConsolidation(): void {
    if (this.consolidationTimer) {
      clearInterval(this.consolidationTimer)
      this.consolidationTimer = undefined
    }
  }
}
