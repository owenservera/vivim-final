# 05 — Memory Intelligence: 10-Type Memory System, Context Assembly, Situation Detection

> **Status:** PROPOSED | **Date:** 2026-07-11
> **Objectives:** 1 (Sovereign Intelligence) + 3 (Context-Aware Agent)

---

## The 10-Type Memory System

The current system has 3 memory types (episodic, semantic, procedural). The upgrade expands to 10 types, each serving a distinct purpose in the user's knowledge graph.

### Memory Type Catalog

| # | Type | Table | Purpose | Source | Query Pattern |
|---|------|-------|---------|--------|---------------|
| 1 | **Episodic** | `episodic_memory` (existing) | What happened (action + result) | Live sessions + imports | By provider, action, time |
| 2 | **Semantic** | `semantic_memory` (existing) | What is true (facts) | Extraction | By subject, predicate |
| 3 | **Procedural** | `procedural_rule` (existing) | How to do things (rules) | Mining + manual | By context match |
| 4 | **Entity** | `entity` (new) | Named things (people, projects, tech) | Extraction | By name, type |
| 5 | **Decision** | `decision_record` (new) | What was decided | Extraction | By conversation, time |
| 6 | **Pattern** | `pattern_extract` (new) | What recurs | Mining | By type |
| 7 | **Topic** | `topic` (new) | Thematic grouping | Auto + manual | By conversation |
| 8 | **Project** | `project` (new) | User workspace grouping | Manual | By conversation |
| 9 | **Summary** | `semantic_memory` (predicate='summary') | Condensed conversation | Synthesis | By conversation |
| 10 | **Preference** | `user_preference` (new) | What user likes/dislikes | Learning | By key |

### Memory Flow Diagram

```
External Import ──→ KnowledgeIngestionEngine
                         │
                         ▼
                  KnowledgeExtractor
                   ├──→ Entity (table)
                   ├──→ DecisionRecord (table)
                   ├──→ SemanticMemory (facts)
                   └──→ PatternExtract (table)
                         │
Live Session ──→ ConversationManager
                         │
                    MemoryEngine.recordEpisode()
                    MemoryEngine.assertFact()
                    MemoryEngine.createRule()
                         │
                         ▼
              MemoryEmbedding (vectors)
                    SemanticSearchEngine
                         │
                         ▼
              CrossConversationSynthesizer
                   (answers "what did I learn about X?")
```

---

## Context Assembly Pipeline (5 Stages)

### Stage 1: DETECT (Situation Detection)

```typescript
async function detectSituation(
  message: string,
  conversationId: string,
  recentMessages: Array<{ role: string; content: string }>,
): Promise<SituationSignal> {
  // 1. Extract signals from message
  const signals = extractSignals(message)

  // 2. Score each task type
  const scores = new Map<TaskType, number>()
  for (const signal of signals) {
    for (const type of TASK_TYPES) {
      const weight = getSignalWeight(signal, type)
      scores.set(type, (scores.get(type) ?? 0) + weight)
    }
  }

  // 3. Pick best type
  const sorted = [...scores.entries()].sort((a, b) => b[1] - a[1])
  const [bestType, bestScore] = sorted[0] ?? ['general', 0]
  const total = [...scores.values()].reduce((a, b) => a + b, 0)
  const confidence = total > 0 ? bestScore / total : 0

  return {
    type: bestType,
    confidence: Math.min(confidence, 1.0),
    signals: signals.map(s => ({
      indicator: s.indicator,
      weight: s.weight,
      matched: s.matched,
    })),
  }
}
```

**Signal indicators per task type:**

| Task Type | Indicators (regex patterns) |
|-----------|---------------------------|
| coding | `\bfunction\b`, `\bclass\b`, `\bimport\b`, code blocks (```), file extensions (`.ts`, `.py`, `.rs`), error messages (`Error:`, `Exception:`) |
| writing | `\bwrite\b`, `\barticle\b`, `\bdraft\b`, `\bessay\b`, `\bblog\b`, `\bstory\b` |
| researching | `\bsearch\b`, `\bfind\b`, `\bcompare\b`, `\bwhat is\b`, `\bresearch\b`, `\banalyze\b` |
| planning | `\bplan\b`, `\bschedule\b`, `\borganize\b`, `\broadmap\b`, `\bdeadline\b`, `\bmilestone\b` |
| debugging | `\berror\b`, `\bbug\b`, `\bcrash\b`, `\btraceback\b`, `\bstack trace\b`, `\bfix\b` |
| learning | `\bhow does\b`, `\bexplain\b`, `\btutorial\b`, `\blearn\b`, `\bunderstand\b` |
| reviewing | `\breview\b`, `\bfeedback\b`, `\bcheck\b`, `\bverify\b`, `\btest\b` |
| designing | `\bdesign\b`, `\barchitecture\b`, `\bpattern\b`, `\bdiagram\b`, `\bmodel\b` |
| data_analysis | `\bdata\b`, `\banalyze\b`, `\bchart\b`, `\bstatistics\b`, `\btrend\b` |

### Stage 2: RECALL (Memory Retrieval)

```typescript
async function recall(
  conversationId: string,
  message: string,
  situation: SituationSignal,
): Promise<ContextLayer[]> {
  const layers: ContextLayer[] = []

  // Layer 1: Recent episodes (same provider)
  const recentEpisodes = await memoryEngine.recallEpisodes({
    limit: 5,
    providerId: context.providerId,
  })
  layers.push({
    name: 'recent_episodes',
    content: formatEpisodes(recentEpisodes),
    tokenCount: estimateTokens(recentEpisodes),
    priority: 3,
    sources: recentEpisodes.map(e => e.id),
  })

  // Layer 2: Semantic search (relevant facts across all conversations)
  const searchResults = await searchEngine.search({
    text: message,
    limit: 10,
    threshold: 0.7,
  })
  layers.push({
    name: 'topic',
    content: formatSearchResults(searchResults),
    tokenCount: estimateTokens(searchResults),
    priority: 2,
    sources: searchResults.map(r => r.id),
  })

  // Layer 3: Entity lookup (entities mentioned in message)
  const entities = await extractEntitiesFromMessage(message)
  const entityFacts = await Promise.all(
    entities.map(e => memoryEngine.recallFacts(e.name)),
  )
  layers.push({
    name: 'entity',
    content: formatEntities(entities, entityFacts),
    tokenCount: estimateTokens(entityFacts),
    priority: 4,
    sources: entities.map(e => e.id),
  })

  // Layer 4: Conversation history (previous messages in this conversation)
  const history = await conversationStore.getMessages(conversationId, { limit: 20 })
  layers.push({
    name: 'conversation_history',
    content: formatHistory(history),
    tokenCount: estimateTokens(history),
    priority: 1,
    sources: history.map(m => m.id),
  })

  // Layer 5: Applicable rules (procedural memory)
  const rules = await memoryEngine.findRules({
    providerId: context.providerId,
    action: situation.type,
  })
  layers.push({
    name: 'preferences',
    content: formatRules(rules),
    tokenCount: estimateTokens(rules),
    priority: 5,
    sources: rules.map(r => r.id),
  })

  // Layer 6: Project state (if conversation has project)
  if (context.projectId) {
    const project = await getProjectState(context.projectId)
    layers.push({
      name: 'project_state',
      content: formatProject(project),
      tokenCount: estimateTokens(project),
      priority: 2,
      sources: [project.id],
    })
  }

  return layers
}
```

### Stage 3: RANK (Relevance Scoring)

```typescript
function rankLayers(
  layers: ContextLayer[],
  situation: SituationSignal,
): ContextLayer[] {
  const weights = SITUATION_WEIGHTS[situation.type]
  return layers
    .map(layer => ({
      ...layer,
      score: layer.priority * (weights?.[layer.name] ?? 1.0),
    }))
    .sort((a, b) => b.score - a.score)
}

const SITUATION_WEIGHTS: Record<TaskType, Partial<Record<ContextLayerName, number>>> = {
  coding: { recent_episodes: 1.5, entity: 1.3, project_state: 1.2 },
  writing: { topic: 1.5, preferences: 1.2 },
  researching: { topic: 2.0, entity: 1.5 },
  debugging: { recent_episodes: 2.0, entity: 1.5 },
  planning: { project_state: 2.0, preferences: 1.5 },
  // ... etc
}
```

### Stage 4: BUDGET (Token Allocation)

```typescript
function allocateBudget(
  rankedLayers: ContextLayer[],
  totalBudget: number,
  strategy: 'equal' | 'weighted' | 'priority' | 'adaptive',
): ContextLayer[] {
  const result: ContextLayer[] = []
  let remaining = totalBudget

  for (const layer of rankedLayers) {
    if (remaining <= 0) break

    const allocated = Math.min(layer.tokenCount, remaining)
    if (allocated < layer.tokenCount) {
      // Truncate this layer
      result.push({
        ...layer,
        content: truncateContent(layer.content, allocated),
        tokenCount: allocated,
      })
    } else {
      result.push(layer)
    }
    remaining -= allocated
  }

  return result
}
```

**Default budget allocation (adaptive strategy):**

| Layer | Default % | Coding | Writing | Research |
|-------|----------|--------|---------|----------|
| conversation_history | 30% | 25% | 20% | 15% |
| recent_episodes | 15% | 20% | 10% | 15% |
| topic (semantic) | 20% | 15% | 30% | 35% |
| entity | 10% | 15% | 10% | 15% |
| project_state | 10% | 15% | 15% | 5% |
| preferences | 10% | 5% | 10% | 10% |
| identity | 5% | 5% | 5% | 5% |

### Stage 5: INJECT (Format and Return)

```typescript
function inject(
  layers: ContextLayer[],
  situation: SituationSignal,
): AssembledContext {
  const systemPrompt = formatSystemPrompt(layers, situation)
  return {
    conversationId: context.conversationId,
    layers,
    totalTokens: layers.reduce((sum, l) => sum + l.tokenCount, 0),
    budget: totalBudget,
    situation,
    assembledAt: Date.now(),
    truncated: layers.length < rankedLayers.length,
    truncatedLayers: rankedLayers.slice(layers.length).map(l => l.name),
  }
}
```

---

## Predictive Pre-warming

```typescript
class PreWarmScheduler {
  // Learn when user typically starts certain tasks
  async learnPattern(conversationId: string, taskType: TaskType): Promise<void> {
    const hour = new Date().getHours()
    const dayOfWeek = new Date().getDay()

    // Store: "user does 'coding' at hour=9, day=1-5"
    await store.createUserPreference({
      id: newId(),
      userId: 'default',
      key: `prewarm_${taskType}_${dayOfWeek}_${hour}`,
      value: 'true',
      learnedAt: Date.now(),
    })
  }

  // Check if any pre-warm conditions are met
  async checkAndPreWarm(): Promise<void> {
    const hour = new Date().getHours()
    const dayOfWeek = new Date().getDay()
    const patterns = await store.getUserPreferences('default')

    for (const p of patterns) {
      if (p.key.startsWith('prewarm_')) {
        const [, taskType, day, hr] = p.key.split('_')
        if (Number(day) === dayOfWeek && Number(hr) === hour) {
          // Pre-warm context for this task type
          await contextAssembly.preWarmForTaskType(taskType as TaskType)
        }
      }
    }
  }
}
```

---

## Import Parser Specifications

### ChatGPT Export Format

```json
// conversations.json from ChatGPT export
[
  {
    "title": "Conversation title",
    "create_time": 1700000000,
    "update_time": 1700000100,
    "mapping": {
      "uuid": {
        "id": "uuid",
        "message": {
          "id": "uuid",
          "author": { "role": "user" | "assistant" | "system" },
          "content": { "content_type": "text", "parts": ["text..."] },
          "model": "gpt-4"
        },
        "parent": "parent-uuid",
        "children": ["child-uuid"]
      }
    }
  }
]
```

**Parser logic:**
1. For each conversation → flatten `mapping` tree into ordered message list
2. Map `author.role` → our `MessageRole`
3. Map `content.parts` → concatenated text content
4. Create `Conversation` with `source='chatgpt'`, `externalId=title+create_time`
5. For each message → create `ConversationMessage` with sequenceIndex from tree order

### Claude Export Format

```json
// Claude export format (varies — handle both JSON and HTML)
[
  {
    "uuid": "conversation-uuid",
    "name": "Conversation name",
    "created_at": "2024-01-01T00:00:00Z",
    "updated_at": "2024-01-01T00:01:00Z",
    "chat_messages": [
      {
        "uuid": "message-uuid",
        "text": "message text",
        "sender": "human" | "assistant",
        "created_at": "2024-01-01T00:00:00Z"
      }
    ]
  }
]
```

### Gemini Export Format

```json
// Google Takeout format
[
  {
    "id": "conversation-id",
    "title": "Title",
    "created_at": "2024-01-01T00:00:00Z",
    "messages": [
      {
        "id": "message-id",
        "author": "user" | "model",
        "text": "message text",
        "timestamp": "2024-01-01T00:00:00Z"
      }
    ]
  }
]
```

---

## Memory Consolidation Daemon

Runs periodically (every 5 minutes by default) to:

1. **Mine patterns** from recent episodes (existing `MemoryEngine.minePatterns()`)
2. **Prune low-confidence rules** (existing `MemoryEngine.consolidate()`)
3. **Generate summaries** for conversations > 50 messages
4. **Update entity confidence** based on mention frequency
5. **Decay old preferences** (reduce confidence by 5% per week if not reinforced)
6. **Cross-reference** entities with topics (auto-assign conversations to topics)

---

## Server API Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/knowledge/ingest` | Upload and ingest provider export |
| GET | `/api/knowledge/jobs` | List import jobs |
| GET | `/api/knowledge/jobs/:id` | Get job status |
| GET | `/api/knowledge/search?q=X` | Semantic search across all memory |
| POST | `/api/knowledge/synthesize` | Cross-conversation synthesis |
| GET | `/api/knowledge/export` | Export all knowledge as JSON |
| GET | `/api/knowledge/entities?type=X` | List entities by type |
| GET | `/api/knowledge/decisions?conversationId=X` | List decisions in conversation |
| GET | `/api/knowledge/topics` | List topics |
| POST | `/api/knowledge/topics` | Create topic |
| PUT | `/api/knowledge/topics/:id` | Update topic |
| GET | `/api/context/assemble?conversationId=X` | Get assembled context |
| GET | `/api/context/situation?message=X` | Detect situation |
| GET | `/api/memory/curated` | List curated memory |
| PUT | `/api/memory/:type/:id` | Edit memory entry |
| DELETE | `/api/memory/:type/:id` | Delete memory entry |
