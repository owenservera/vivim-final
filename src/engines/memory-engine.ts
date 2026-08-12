// src/engines/memory-engine.ts
// MemoryEngine — episodic, semantic, and procedural memory with learning

import { NotFoundError } from '../errors.js'
import { newId } from '../ids.js'
import type { MemoryIntelligenceStore } from '../storage/contracts/memory-intelligence-store.js'
import type { NodeStoreContract } from '../storage/contracts/node-store.js'
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

export interface ConsolidationConfig {
  decayDays: number
  decayFactor: number
  minConfidence: number
  promoteThreshold: number
}

export interface ConsolidationReport {
  merged: number
  decayed: number
  deprecated: number
  promoted: number
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
  /** Frozen per-agent memory snapshot injected as the identity layer (spec 024 FR-005). */
  identityContext?: string
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
  findAll(): Promise<EpisodicMemory[]>
}

export interface SemanticMemoryStore {
  save(fact: SemanticMemory): Promise<void>
  findBySubject(subject: string, predicate?: string): Promise<SemanticMemory[]>
  delete(id: string): Promise<void>
  findAll(): Promise<SemanticMemory[]>
  updateConfidence(id: string, confidence: number): Promise<void>
  update(
    id: string,
    patch: Partial<Pick<SemanticMemory, 'subject' | 'predicate' | 'object' | 'confidence'>>,
  ): Promise<void>
  findById(id: string): Promise<SemanticMemory | null>
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
  private intelligenceStore?: MemoryIntelligenceStore

  constructor(
    private readonly episodic: EpisodicMemoryStore,
    private readonly semantic: SemanticMemoryStore,
    private readonly procedural: ProceduralMemoryStore,
    private readonly eventBus: CapabilityEventBus,
    intelligenceStore?: MemoryIntelligenceStore,
  ) {
    this.intelligenceStore = intelligenceStore
  }

  setIntelligenceStore(store: MemoryIntelligenceStore): void {
    this.intelligenceStore = store
  }

  // ── Export helpers ───────────────────────────────────────────────────────

  async getAllFacts(): Promise<SemanticMemory[]> {
    return this.semantic.findAll()
  }

  async getAllEpisodes(): Promise<EpisodicMemory[]> {
    return this.episodic.findAll()
  }

  async getAllRules(): Promise<ProceduralRule[]> {
    return this.procedural.findAll()
  }

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

  async forgetFact(id: string): Promise<void> {
    await this.semantic.delete(id)
    this.eventBus.emit({ type: 'memory:fact_forgotten', data: { id } })
  }

  // ── Curation (unit 7.7) ────────────────────────────────────────────────

  async verifyFact(id: string, by: string): Promise<void> {
    const fact = await this.semantic.findById(id)
    if (!fact) throw new NotFoundError(`Fact ${id} not found`)
    const newConfidence = Math.min(1, fact.confidence + 0.15)
    await this.semantic.updateConfidence(id, newConfidence)
    this.eventBus.emit({
      type: 'memory:curated',
      data: { id, action: 'verify', by, confidence: newConfidence },
    })
  }

  async editFact(
    id: string,
    patch: { object?: unknown; predicate?: string },
    by: string,
  ): Promise<void> {
    const fact = await this.semantic.findById(id)
    if (!fact) throw new NotFoundError(`Fact ${id} not found`)
    await this.semantic.update(id, patch)
    this.eventBus.emit({ type: 'memory:curated', data: { id, action: 'edit', by, patch } })
  }

  async rejectFact(id: string, by: string): Promise<void> {
    const fact = await this.semantic.findById(id)
    if (!fact) throw new NotFoundError(`Fact ${id} not found`)
    await this.semantic.updateConfidence(id, 0)
    this.eventBus.emit({ type: 'memory:curated', data: { id, action: 'reject', by } })
  }

  async findFactByContent(
    subject: string,
    predicate: string,
    object: unknown,
  ): Promise<SemanticMemory | null> {
    const facts = await this.semantic.findBySubject(subject, predicate)
    return facts.find((f) => JSON.stringify(f.object) === JSON.stringify(object)) ?? null
  }

  async assertProcedureRule(input: ProceduralRuleInput): Promise<void> {
    const now = Date.now()
    const rules = await this.procedural.findByContext({ action: input.action })
    const existing = rules.find((r) => r.condition === input.condition && r.action === input.action)

    if (existing) {
      existing.confidence = Math.max(existing.confidence, input.confidence ?? 0.5)
      existing.successCount++
      existing.updatedAt = now
      await this.procedural.save(existing)
    } else {
      const rule: ProceduralRule = {
        id: newId(),
        name: input.name,
        condition: input.condition,
        action: input.action,
        confidence: input.confidence ?? 0.5,
        successCount: 1,
        failureCount: 0,
        createdAt: now,
        updatedAt: now,
      }
      await this.procedural.save(rule)
    }
  }

  // ── Node-layer v2: emit a durable `cap-store.memory` Node (OG Memory +
  // FSRS-6). Each memory lands as a universally-stored Node with spaced-
  // repetition fields so the second brain can schedule reviews.
  async recordMemory(input: {
    content: string
    memoryType: string
    category: string
    subcategory?: string
    tags?: string[]
    importance?: number
    relevance?: number
    sourceConversationIds?: string[]
    sourceMessageIds?: string[]
    occurredAt?: number
    validFrom?: number
    validUntil?: number
    isPinned?: boolean
    isArchived?: boolean
    nodeStore?: NodeStoreContract
    conversationId?: string
    messageId?: string
  }): Promise<string> {
    const now = Date.now()
    const id = newId()
    const memoryData = {
      content: input.content,
      memoryType: input.memoryType,
      category: input.category,
      subcategory: input.subcategory ?? null,
      tags: input.tags ?? [],
      importance: input.importance ?? 0.5,
      relevance: input.relevance ?? 0.5,
      sourceConversationIds: input.sourceConversationIds ?? [],
      sourceMessageIds: input.sourceMessageIds ?? [],
      occurredAt: input.occurredAt ?? now,
      validFrom: input.validFrom ?? now,
      validUntil: input.validUntil ?? null,
      isPinned: input.isPinned ?? false,
      isArchived: input.isArchived ?? false,
      consolidationStatus: 'unconsolidated',
      accessCount: 0,
      // FSRS-6 initial state (New card).
      stability: 1.0,
      difficulty: 0.3,
      dueDate: now,
      lastReview: null,
      reviewCount: 0,
      fsrsState: 'New' as const,
    }
    const nodeStore = input.nodeStore
    if (nodeStore) {
      await nodeStore
        .putNode({
          id,
          type: 'cap-store.memory',
          schemaVersion: 1,
          version: 1,
          state: 'active',
          source: input.content,
          data: memoryData as unknown as Record<string, unknown>,
          edges: [],
          meta: {
            conversationId: input.conversationId,
            messageId: input.messageId,
            sourceParser: 'memory-engine',
          },
          acl: { canView: true, canRemix: false, canReshare: false },
          authorDid: 'assistant',
          contentType: 'memory',
          securityLevel: 0,
          validFrom: memoryData.validFrom,
          validUntil: memoryData.validUntil ?? undefined,
          createdAt: now,
          updatedAt: now,
        })
        .catch(() => {})
  // [audit] log the error with context here
    }
    this.eventBus.emit({ type: 'memory:recorded', data: { id, category: input.category } })
    return id
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

  async consolidate(cfg: Partial<ConsolidationConfig> = {}): Promise<ConsolidationReport> {
    const c: ConsolidationConfig = {
      decayDays: 30,
      decayFactor: 0.9,
      minConfidence: 0.2,
      promoteThreshold: 3,
      ...cfg,
    }
    const report: ConsolidationReport = { merged: 0, decayed: 0, deprecated: 0, promoted: 0 }
    const now = Date.now()

    // 1. Dedupe — group by subject+predicate+object, keep highest confidence
    const allFacts = await this.semantic.findAll()
    const groups = new Map<string, SemanticMemory[]>()
    for (const fact of allFacts) {
      const key = `${fact.subject}::${fact.predicate}::${JSON.stringify(fact.object)}`
      const group = groups.get(key) ?? []
      group.push(fact)
      groups.set(key, group)
    }

    for (const [, group] of groups) {
      if (group.length <= 1) continue
      // Sort by confidence descending, keep the best
      group.sort((a, b) => b.confidence - a.confidence)
      const _survivor = group[0]
      // Delete duplicates
      for (let i = 1; i < group.length; i++) {
        const dupe = group[i]
        if (dupe) await this.semantic.delete(dupe.id)
      }
      report.merged += group.length - 1
    }

    // 2. Decay — reduce confidence of old unverified facts
    const decayThreshold = now - c.decayDays * 24 * 60 * 60 * 1000
    const freshFacts = await this.semantic.findAll()
    for (const fact of freshFacts) {
      if (fact.timestamp < decayThreshold) {
        const newConfidence = fact.confidence * c.decayFactor
        if (newConfidence <= c.minConfidence) {
          await this.semantic.delete(fact.id)
          report.deprecated++
        } else {
          await this.semantic.updateConfidence(fact.id, newConfidence)
          report.decayed++
        }
      }
    }

    // 3. Promote — frequent high-confidence pairs become ProceduralRules
    const pairCounts = new Map<
      string,
      { count: number; avgConfidence: number; subject: string; predicate: string }
    >()
    const finalFacts = await this.semantic.findAll()
    for (const fact of finalFacts) {
      const pairKey = `${fact.subject}::${fact.predicate}`
      const existing = pairCounts.get(pairKey)
      if (existing) {
        existing.count++
        existing.avgConfidence =
          (existing.avgConfidence * (existing.count - 1) + fact.confidence) / existing.count
      } else {
        pairCounts.set(pairKey, {
          count: 1,
          avgConfidence: fact.confidence,
          subject: fact.subject,
          predicate: fact.predicate,
        })
      }
    }

    for (const [, pair] of pairCounts) {
      if (pair.count >= c.promoteThreshold && pair.avgConfidence >= 0.7) {
        const rule: ProceduralRule = {
          id: newId(),
          name: `${pair.subject}_${pair.predicate}`,
          condition: pair.subject,
          action: pair.predicate,
          confidence: pair.avgConfidence,
          successCount: pair.count,
          failureCount: 0,
          createdAt: now,
          updatedAt: now,
        }
        await this.procedural.save(rule)
        report.promoted++
      }
    }

    // 4. Prune weak procedural rules
    const rules = await this.procedural.findAll()
    const pruneThreshold = now - 30 * 24 * 60 * 60 * 1000
    for (const rule of rules) {
      if (rule.confidence < c.minConfidence && rule.failureCount > rule.successCount * 2) {
        await this.procedural.delete(rule.id)
      } else if (rule.lastTriggered && rule.lastTriggered < pruneThreshold) {
        rule.confidence *= c.decayFactor
        rule.updatedAt = now
        await this.procedural.save(rule)
      }
    }

    this.eventBus.emit({
      type: 'memory:consolidated',
      data: report,
    })
    return report
  }

  // ── Knowledge types (Phase 15) ────────────────────────────────────────

  async recordEntity(input: {
    name: string
    type: string
    description?: string
    conversationId?: string
    messageId?: string
  }): Promise<{ id: string; name: string; type: string }> {
    if (!this.intelligenceStore) {
      this.eventBus.emit({
        type: 'memory:entity_recorded',
        data: { name: input.name, type: input.type },
      })
      return { id: newId(), name: input.name, type: input.type }
    }

    // Check if entity already exists (by unique name+type)
    const existing = await this.intelligenceStore.findByName(input.name)
    if (existing && existing.type === input.type) {
      // Entity exists — increment mention count and optionally create a mention
      await this.intelligenceStore.incrementMentionCount(existing.id)
      if (input.conversationId && input.messageId) {
        await this.intelligenceStore.createEntityMention({
          entityId: existing.id,
          conversationId: input.conversationId,
          messageId: input.messageId,
          context: input.description ?? '',
        })
      }
      this.eventBus.emit({
        type: 'memory:entity_recorded',
        data: { id: existing.id, name: input.name, type: input.type },
      })
      return { id: existing.id, name: existing.name, type: existing.type }
    }

    // Create new entity
    const entity = await this.intelligenceStore.createEntity({
      name: input.name,
      type: input.type,
      description: input.description,
    })

    // Create mention if conversation context is provided
    if (input.conversationId && input.messageId) {
      await this.intelligenceStore.createEntityMention({
        entityId: entity.id,
        conversationId: input.conversationId,
        messageId: input.messageId,
        context: input.description ?? '',
      })
    }

    this.eventBus.emit({
      type: 'memory:entity_recorded',
      data: { id: entity.id, name: entity.name, type: entity.type },
    })
    return { id: entity.id, name: entity.name, type: entity.type }
  }

  async recordDecision(input: {
    conversationId: string
    messageId: string
    decisionText: string
    rationale?: string
    alternatives?: string[]
  }): Promise<{ id: string; conversationId: string; decisionText: string }> {
    if (!this.intelligenceStore) {
      this.eventBus.emit({
        type: 'memory:decision_recorded',
        data: { conversationId: input.conversationId, decisionText: input.decisionText },
      })
      return { id: newId(), conversationId: input.conversationId, decisionText: input.decisionText }
    }

    const record = await this.intelligenceStore.createDecisionRecord({
      conversationId: input.conversationId,
      messageId: input.messageId,
      decisionText: input.decisionText,
      rationale: input.rationale,
      alternatives: input.alternatives,
    })

    this.eventBus.emit({
      type: 'memory:decision_recorded',
      data: {
        id: record.id,
        conversationId: input.conversationId,
        decisionText: input.decisionText,
      },
    })
    return {
      id: record.id,
      conversationId: record.conversationId,
      decisionText: record.decisionText,
    }
  }

  async recordPattern(input: {
    name: string
    description: string
    patternType: string
  }): Promise<{ id: string; name: string; patternType: string }> {
    if (!this.intelligenceStore) {
      this.eventBus.emit({
        type: 'memory:pattern_recorded',
        data: { name: input.name, patternType: input.patternType },
      })
      return { id: newId(), name: input.name, patternType: input.patternType }
    }

    // Check if pattern already exists (by unique name+patternType)
    const existing = await this.intelligenceStore.listPatternExtracts({
      patternType: input.patternType,
    })
    const match = existing.find((p) => p.name === input.name)

    if (match) {
      // Pattern exists — increment occurrences
      await this.intelligenceStore.incrementOccurrences(match.id)
      this.eventBus.emit({
        type: 'memory:pattern_recorded',
        data: { id: match.id, name: input.name, patternType: input.patternType },
      })
      return { id: match.id, name: match.name, patternType: match.patternType }
    }

    // Create new pattern
    const pattern = await this.intelligenceStore.createPatternExtract({
      name: input.name,
      description: input.description,
      patternType: input.patternType,
    })

    this.eventBus.emit({
      type: 'memory:pattern_recorded',
      data: { id: pattern.id, name: pattern.name, patternType: pattern.patternType },
    })
    return { id: pattern.id, name: pattern.name, patternType: pattern.patternType }
  }

  async getTopics(): Promise<Array<{ id: string; name: string; description: string | null }>> {
    if (!this.intelligenceStore) {
      return []
    }
    const topics = await this.intelligenceStore.listTopics()
    return topics.map((t) => ({
      id: t.id,
      name: t.name,
      description: t.description,
    }))
  }

  async getProjects(): Promise<
    Array<{ id: string; name: string; description: string | null; status: string }>
  > {
    if (!this.intelligenceStore) {
      return []
    }
    const projects = await this.intelligenceStore.listProjects()
    return projects.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      status: p.status,
    }))
  }

  async assignTopic(
    conversationId: string,
    topicId: string,
    assignmentType: 'auto' | 'manual' = 'auto',
  ): Promise<void> {
    if (!this.intelligenceStore) {
      this.eventBus.emit({
        type: 'memory:topic_assigned',
        data: { conversationId, topicId },
      })
      return
    }

    await this.intelligenceStore.assignConversation(conversationId, topicId, assignmentType)

    this.eventBus.emit({
      type: 'memory:topic_assigned',
      data: { conversationId, topicId, assignmentType },
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
