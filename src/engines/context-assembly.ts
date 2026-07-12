// src/engines/context-assembly.ts
// ContextAssemblyEngine — 5-stage pipeline: DETECT→RECALL→RANK→BUDGET→INJECT.
// Assembles context from memory, search, and history before sending to provider.

import { newId } from '../ids.js'
import type { ContextAssemblyStore } from '../storage/contracts/context-assembly-store.js'
import type { MemoryEngine } from './memory-engine.js'
import type { SemanticSearchEngine } from './semantic-search.js'
import type { SituationDetector, SituationSignal, TaskType } from './situation-detector.js'

// ── Types (from atomic 17.2) ───────────────────────────────────────────────

export type ContextLayerName =
  | 'identity'
  | 'preferences'
  | 'topic'
  | 'entity'
  | 'conversation_history'
  | 'recent_episodes'
  | 'project_state'

export interface ContextLayer {
  name: ContextLayerName
  content: string
  tokenCount: number
  priority: number
  sources: string[]
}

export interface AssembledContext {
  conversationId: string
  layers: ContextLayer[]
  totalTokens: number
  budget: number
  situation: SituationSignal
  assembledAt: number
  truncated: boolean
}

// ── Default budget and priority config ──────────────────────────────────────

const DEFAULT_BUDGET = 8000

// Priority weights per task type (higher = include first when budget is tight)
const TASK_LAYER_PRIORITIES: Record<TaskType, Record<ContextLayerName, number>> = {
  coding: {
    identity: 0.2,
    preferences: 0.3,
    topic: 0.9,
    entity: 0.7,
    conversation_history: 0.6,
    recent_episodes: 0.8,
    project_state: 1.0,
  },
  writing: {
    identity: 0.3,
    preferences: 0.5,
    topic: 0.9,
    entity: 0.6,
    conversation_history: 0.7,
    recent_episodes: 0.8,
    project_state: 0.4,
  },
  researching: {
    identity: 0.2,
    preferences: 0.3,
    topic: 1.0,
    entity: 0.8,
    conversation_history: 0.5,
    recent_episodes: 0.9,
    project_state: 0.3,
  },
  debugging: {
    identity: 0.2,
    preferences: 0.3,
    topic: 0.9,
    entity: 0.8,
    conversation_history: 0.7,
    recent_episodes: 0.6,
    project_state: 1.0,
  },
  planning: {
    identity: 0.3,
    preferences: 0.5,
    topic: 0.8,
    entity: 0.6,
    conversation_history: 0.6,
    recent_episodes: 0.9,
    project_state: 0.8,
  },
  learning: {
    identity: 0.2,
    preferences: 0.4,
    topic: 1.0,
    entity: 0.7,
    conversation_history: 0.6,
    recent_episodes: 0.8,
    project_state: 0.3,
  },
  reviewing: {
    identity: 0.2,
    preferences: 0.3,
    topic: 0.8,
    entity: 0.7,
    conversation_history: 0.6,
    recent_episodes: 0.7,
    project_state: 1.0,
  },
  designing: {
    identity: 0.3,
    preferences: 0.5,
    topic: 0.9,
    entity: 0.6,
    conversation_history: 0.6,
    recent_episodes: 0.7,
    project_state: 0.8,
  },
  data_analysis: {
    identity: 0.2,
    preferences: 0.3,
    topic: 0.9,
    entity: 0.8,
    conversation_history: 0.5,
    recent_episodes: 0.7,
    project_state: 0.9,
  },
  general: {
    identity: 0.3,
    preferences: 0.4,
    topic: 0.7,
    entity: 0.5,
    conversation_history: 0.8,
    recent_episodes: 0.7,
    project_state: 0.5,
  },
}

// Approximate tokens per character (English text ≈ 1 token per 4 chars)
const CHARS_PER_TOKEN = 4

function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN)
}

// ── Budget percentages per task type (17.4) ────────────────────────────────
// Default allocation: conversation_history 30%, recent_episodes 15%, topic 20%,
// entity 10%, project_state 10%, preferences 10%, identity 5%.

const BUDGET_ALLOCATION: Record<TaskType, Record<ContextLayerName, number>> = {
  coding: {
    identity: 0.03,
    preferences: 0.07,
    topic: 0.15,
    entity: 0.1,
    conversation_history: 0.25,
    recent_episodes: 0.2,
    project_state: 0.2,
  },
  writing: {
    identity: 0.05,
    preferences: 0.1,
    topic: 0.25,
    entity: 0.1,
    conversation_history: 0.3,
    recent_episodes: 0.15,
    project_state: 0.05,
  },
  researching: {
    identity: 0.03,
    preferences: 0.07,
    topic: 0.3,
    entity: 0.15,
    conversation_history: 0.2,
    recent_episodes: 0.2,
    project_state: 0.05,
  },
  debugging: {
    identity: 0.03,
    preferences: 0.07,
    topic: 0.15,
    entity: 0.1,
    conversation_history: 0.25,
    recent_episodes: 0.15,
    project_state: 0.25,
  },
  planning: {
    identity: 0.05,
    preferences: 0.1,
    topic: 0.2,
    entity: 0.1,
    conversation_history: 0.25,
    recent_episodes: 0.2,
    project_state: 0.1,
  },
  learning: {
    identity: 0.05,
    preferences: 0.1,
    topic: 0.3,
    entity: 0.1,
    conversation_history: 0.25,
    recent_episodes: 0.15,
    project_state: 0.05,
  },
  reviewing: {
    identity: 0.03,
    preferences: 0.07,
    topic: 0.15,
    entity: 0.1,
    conversation_history: 0.25,
    recent_episodes: 0.15,
    project_state: 0.25,
  },
  designing: {
    identity: 0.05,
    preferences: 0.1,
    topic: 0.25,
    entity: 0.1,
    conversation_history: 0.25,
    recent_episodes: 0.15,
    project_state: 0.1,
  },
  data_analysis: {
    identity: 0.03,
    preferences: 0.07,
    topic: 0.2,
    entity: 0.15,
    conversation_history: 0.25,
    recent_episodes: 0.15,
    project_state: 0.15,
  },
  general: {
    identity: 0.05,
    preferences: 0.1,
    topic: 0.2,
    entity: 0.1,
    conversation_history: 0.3,
    recent_episodes: 0.15,
    project_state: 0.1,
  },
}

// ── Predictive pre-warming state (17.3) ─────────────────────────────────────

interface UsagePattern {
  hour: number
  dayOfWeek: number
  taskType: TaskType
  count: number
}

// ── ContextAssemblyEngine ──────────────────────────────────────────────────

export class ContextAssemblyEngine {
  private usagePatterns: UsagePattern[] = []
  private preWarmHits = 0
  private preWarmMisses = 0
  private preWarmTimer?: ReturnType<typeof setInterval>

  constructor(
    private store: ContextAssemblyStore,
    private situationDetector: SituationDetector,
    private memory: MemoryEngine,
    private search: SemanticSearchEngine,
    private budget: number = DEFAULT_BUDGET,
  ) {}

  async assemble(conversationId: string, userMessage: string): Promise<AssembledContext> {
    const startTime = Date.now()

    // Stage 1: DETECT — classify the task type
    const situation = await this.situationDetector.detect({
      message: userMessage,
      conversationId,
    })

    // Track usage pattern for predictive pre-warming (17.3)
    this.recordUsagePattern(situation.type)

    // Check if pre-warmed context is available (hit tracking)
    const cachedLayers = await this.store.getLayersForConversation(conversationId)
    if (cachedLayers.length > 0) {
      this.preWarmHits++
    } else {
      this.preWarmMisses++
    }

    // Stage 2: RECALL — pull all relevant context
    const rawLayers = await this.recall(conversationId, userMessage, situation.type)

    // Stage 3: RANK — sort by task-aware priority, then by score
    const ranked = this.rank(rawLayers, situation.type)

    // Stage 4: BUDGET — allocate token budget using task-specific percentages (17.4)
    const { layers, truncated } = this.allocateBudget(ranked, situation.type)

    // Stage 5: INJECT — persist layers for caching
    await this.persistLayers(conversationId, layers)

    return {
      conversationId,
      layers,
      totalTokens: layers.reduce((sum, l) => sum + l.tokenCount, 0),
      budget: this.budget,
      situation,
      assembledAt: startTime,
      truncated,
    }
  }

  async preWarm(conversationId: string): Promise<void> {
    // Pre-fetch and cache common layers (identity, preferences, project state)
    // This runs async before the user sends a message so assemble() hits cache
    const cached = await this.store.getLayersForConversation(conversationId)
    if (cached.length > 0) return // Already warm

    const identity = await this.recallIdentity(conversationId)
    const prefs = await this.recallPreferences(conversationId)
    const project = await this.recallProjectState(conversationId)

    const layers = [...identity, ...prefs, ...project]
    for (const layer of layers) {
      await this.store.saveLayer({
        id: newId(),
        conversationId,
        layerName: layer.name,
        content: layer.content,
        tokenCount: layer.tokenCount,
        priority: layer.priority,
        sourcesJson: JSON.stringify(layer.sources),
        assembledAt: Date.now(),
      })
    }
  }

  // ── 17.3: Predictive pre-warming ────────────────────────────────────────

  /** Start periodic pre-warming based on learned usage patterns. */
  startPredictivePreWarming(intervalMs = 60_000): void {
    this.preWarmTimer = setInterval(() => this.runPredictivePreWarm(), intervalMs)
  }

  stopPredictivePreWarming(): void {
    if (this.preWarmTimer) {
      clearInterval(this.preWarmTimer)
      this.preWarmTimer = undefined
    }
  }

  getPreWarmHitRate(): number {
    const total = this.preWarmHits + this.preWarmMisses
    return total === 0 ? 0 : this.preWarmHits / total
  }

  private recordUsagePattern(taskType: TaskType): void {
    const now = new Date()
    const hour = now.getHours()
    const dayOfWeek = now.getDay()

    const existing = this.usagePatterns.find(
      (p) => p.hour === hour && p.dayOfWeek === dayOfWeek && p.taskType === taskType,
    )
    if (existing) {
      existing.count++
    } else {
      this.usagePatterns.push({ hour, dayOfWeek, taskType, count: 1 })
    }
  }

  private async runPredictivePreWarm(): Promise<void> {
    const now = new Date()
    const hour = now.getHours()
    const dayOfWeek = now.getDay()

    // Find patterns matching current time window (±1 hour)
    const matching = this.usagePatterns.filter(
      (p) => Math.abs(p.hour - hour) <= 1 && p.dayOfWeek === dayOfWeek && p.count >= 3,
    )

    for (const pattern of matching) {
      // Pre-warm a generic conversation for this predicted task type
      const convId = `predictive:${pattern.taskType}:${hour}`
      await this.preWarm(convId)
    }
  }

  // ── Stage 2: RECALL ────────────────────────────────────────────────────

  private async recall(
    conversationId: string,
    userMessage: string,
    taskType: TaskType,
  ): Promise<ContextLayer[]> {
    const layers: ContextLayer[] = []

    // Identity layer (static user info)
    layers.push(...(await this.recallIdentity(conversationId)))

    // Preferences layer
    layers.push(...(await this.recallPreferences(conversationId)))

    // Topic layer — semantic search for relevant content
    try {
      const topicResults = await this.search.search({
        text: userMessage,
        conversationId,
        limit: 5,
      })
      if (topicResults.length > 0) {
        const content = topicResults.map((r) => `[${r.type}] ${r.snippet}`).join('\n')
        layers.push({
          name: 'topic',
          content,
          tokenCount: estimateTokens(content),
          priority: 0,
          sources: topicResults.map((r) => r.id),
        })
      }

      // Entity layer — extract entities from recent search results
      const entities = topicResults.filter((r) => r.type === 'entity')
      if (entities.length > 0) {
        const content = entities.map((e) => e.snippet).join('\n')
        layers.push({
          name: 'entity',
          content,
          tokenCount: estimateTokens(content),
          priority: 0,
          sources: entities.map((e) => e.id),
        })
      }
    } catch {
      // Search failure is best-effort
    }

    // Recent episodes layer
    try {
      const episodes = await this.memory.recallEpisodes({
        limit: 5,
      })
      if (episodes.length > 0) {
        const content = episodes.map((e) => `[${e.action}] ${JSON.stringify(e.output)}`).join('\n')
        layers.push({
          name: 'recent_episodes',
          content,
          tokenCount: estimateTokens(content),
          priority: 0,
          sources: episodes.map((e) => e.id),
        })
      }
    } catch {
      // Episode recall failure is best-effort
    }

    // Project state layer
    layers.push(...(await this.recallProjectState(conversationId)))

    // Conversation history (placeholder — real impl needs conversation store)
    layers.push({
      name: 'conversation_history',
      content: '',
      tokenCount: 0,
      priority: 0,
      sources: [],
    })

    return layers
  }

  private async recallIdentity(conversationId: string): Promise<ContextLayer[]> {
    try {
      const facts = await this.memory.recallFacts('user')
      const content = facts.map((f) => `${f.predicate}: ${JSON.stringify(f.object)}`).join('\n')
      if (!content) return []
      return [
        {
          name: 'identity' as ContextLayerName,
          content,
          tokenCount: estimateTokens(content),
          priority: 0.3,
          sources: facts.map((f) => f.id),
        },
      ]
    } catch {
      return []
    }
  }

  private async recallPreferences(conversationId: string): Promise<ContextLayer[]> {
    try {
      const rules = await this.memory.findRules({})
      const content = rules.map((r) => `${r.action} (confidence: ${r.confidence})`).join('\n')
      if (!content) return []
      return [
        {
          name: 'preferences' as ContextLayerName,
          content,
          tokenCount: estimateTokens(content),
          priority: 0.4,
          sources: rules.map((r) => r.id),
        },
      ]
    } catch {
      return []
    }
  }

  private async recallProjectState(conversationId: string): Promise<ContextLayer[]> {
    try {
      const rules = await this.memory.findRules({})
      const content = rules.map((r) => r.action).join('\n')
      if (!content) return []
      return [
        {
          name: 'project_state' as ContextLayerName,
          content,
          tokenCount: estimateTokens(content),
          priority: 0.5,
          sources: rules.map((r) => r.id),
        },
      ]
    } catch {
      return []
    }
  }

  // ── Stage 3: RANK ─────────────────────────────────────────────────────

  private rank(layers: ContextLayer[], taskType: TaskType): ContextLayer[] {
    const priorities = TASK_LAYER_PRIORITIES[taskType] ?? TASK_LAYER_PRIORITIES.general
    return layers
      .map((layer) => ({
        ...layer,
        priority: priorities[layer.name] ?? 0.5,
      }))
      .sort((a, b) => b.priority - a.priority)
  }

  // ── Stage 4: BUDGET (17.4 — budget percentages per task type) ──────────

  private allocateBudget(
    ranked: ContextLayer[],
    taskType: TaskType,
  ): { layers: ContextLayer[]; truncated: boolean } {
    const allocation = BUDGET_ALLOCATION[taskType] ?? BUDGET_ALLOCATION.general
    let remaining = this.budget
    const included: ContextLayer[] = []
    let truncated = false

    for (const layer of ranked) {
      if (remaining <= 0) {
        truncated = true
        break
      }

      // Cap each layer to its task-type budget percentage
      const maxTokensForLayer = Math.floor(this.budget * (allocation[layer.name] ?? 0.1))
      const allowedTokens = Math.min(maxTokensForLayer, remaining)

      if (layer.tokenCount <= allowedTokens) {
        included.push(layer)
        remaining -= layer.tokenCount
      } else {
        // Partial inclusion — truncate content to fit
        const maxChars = allowedTokens * CHARS_PER_TOKEN
        const truncatedContent = layer.content.slice(0, maxChars) + '…'
        included.push({
          ...layer,
          content: truncatedContent,
          tokenCount: allowedTokens,
        })
        remaining -= allowedTokens
        truncated = true
      }
    }

    return { layers: included, truncated }
  }

  // ── Stage 5: INJECT (persist) ─────────────────────────────────────────

  private async persistLayers(conversationId: string, layers: ContextLayer[]): Promise<void> {
    // Best-effort persist for caching
    try {
      await this.store.clearLayersForConversation(conversationId)
      for (const layer of layers) {
        await this.store.saveLayer({
          id: newId(),
          conversationId,
          layerName: layer.name,
          content: layer.content,
          tokenCount: layer.tokenCount,
          priority: layer.priority,
          sourcesJson: JSON.stringify(layer.sources),
          assembledAt: Date.now(),
        })
      }
    } catch {
      // Best-effort
    }
  }
}
