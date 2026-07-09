# SOTA-06 — Memory & Learning Substrate

**Status:** DRAFT
**Priority:** P4
**Extends:** `05-merged-lifecycles.md` (lifecycle engines)

---

## Purpose

The v1 system stores raw execution data (outcomes, telemetry, health history) but has no engine that **learns** from it. The SOTA MemoryEngine provides three memory types that engines can query:

1. **Episodic Memory** — records of specific executions (what happened, when, what was the outcome)
2. **Semantic Memory** — facts about providers (e.g., "Claude's composer uses contenteditable", "ChatGPT requires login before sending")
3. **Procedural Memory** — learned rules (e.g., "if Claude's composer is not visible, wait 2s and retry", "if ChatGPT shows a captcha, pause and notify user")

Plus a **TransferAccelerator** that mines successful patterns from one provider and proposes transfers to another.

---

## MemoryEngine

### Episodic Memory

```typescript
interface EpisodicMemory {
  id: string;
  providerId: string;
  capabilityId: string;
  conversationId?: string;
  // What happened
  episode: {
    action: string;                  // 'send_message', 'select_model', etc.
    input: Record<string, unknown>;
    outcome: 'success' | 'failure' | 'partial';
    output?: Record<string, unknown>;
    error?: string;
    durationMs: number;
  };
  // Context at the time
  context: {
    pageUrl: string;
    pageState: string;               // serialized DomSummary
    slaveId: string;
    loginState: string;
    planTier: string;
    timestamp: number;
  };
  // What was learned (extracted by reflection)
  lessons?: string[];
  ts: number;
}

interface EpisodicMemoryStore {
  record(episode: EpisodicMemoryInput): Promise<EpisodicMemory>;
  query(opts: {
    providerId?: string;
    capabilityId?: string;
    outcome?: string;
    from?: number;
    to?: number;
    limit?: number;
  }): Promise<EpisodicMemory[]>;
  search(query: string, opts?: { providerId?: string; limit?: number }): Promise<EpisodicMemory[]>;
  // Semantic search (embedding-based)
  semanticSearch(queryEmbedding: number[], opts?: { providerId?: string; limit?: number }): Promise<EpisodicMemory[]>;
}
```

### Semantic Memory

```typescript
interface SemanticMemory {
  id: string;
  providerId?: string;               // null = global fact
  // The fact
  subject: string;                   // 'claude.composer'
  predicate: string;                 // 'uses', 'requires', 'has', 'is_a'
  object: string;                    // 'contenteditable'
  // Metadata
  confidence: number;                // 0.0-1.0
  source: 'observation' | 'discovery' | 'operator' | 'llm_inference';
  evidence: string[];                // episode IDs or observation data
  // Lifecycle
  created_at: number;
  updated_at: number;
  superseded_by?: string;            // ID of newer fact that supersedes this
}

interface SemanticMemoryStore {
  assert(fact: SemanticMemoryInput): Promise<SemanticMemory>;
  query(subject: string, predicate?: string): Promise<SemanticMemory[]>;
  retract(factId: string, reason: string): Promise<void>;
  getAllFacts(providerId?: string): Promise<SemanticMemory[]>;
  // Conflict resolution: if a new fact contradicts an old one
  resolveConflict(newFact: SemanticMemory, existingFact: SemanticMemory): Promise<SemanticMemory>;
}
```

### Procedural Memory

```typescript
interface ProceduralRule {
  id: string;
  name: string;
  // When does this rule apply?
  condition: {
    providerId?: string;
    capabilityId?: string;
    pageStatePattern?: string;       // regex or expression
    errorType?: string;
    context?: Record<string, unknown>;
  };
  // What should be done?
  action: {
    type: 'retry' | 'wait' | 'navigate' | 'use_alternative_selector' | 'notify_user' | 'escalate' | 'abort';
    config: Record<string, unknown>;
  };
  // Rule metadata
  confidence: number;
  source: 'learned' | 'operator' | 'llm_inference' | 'transfer';
  // Learning data
  timesApplied: number;
  timesSucceeded: number;
  timesFailed: number;
  lastAppliedAt?: number;
  created_at: number;
  updated_at: number;
}

interface ProceduralMemoryStore {
  create(rule: ProceduralRuleInput): Promise<ProceduralRule>;
  findMatching(context: RuleContext): Promise<ProceduralRule[]>;
  recordApplication(ruleId: string, succeeded: boolean): Promise<void>;
  updateConfidence(ruleId: string): Promise<void>;
  // Rule mining — analyze episodes and propose new rules
  mineRules(opts?: { providerId?: string; since?: number }): Promise<ProceduralRule[]>;
}
```

### MemoryEngine Public Interface

```typescript
class MemoryEngine {
  constructor(
    private episodic: EpisodicMemoryStore,
    private semantic: SemanticMemoryStore,
    private procedural: ProceduralMemoryStore,
    private eventBus: CapabilityEventBus,
  ) {}

  // ── Recording ────────────────────────────────────────
  async recordEpisode(episode: EpisodicMemoryInput): Promise<void>;
  async assertFact(fact: SemanticMemoryInput): Promise<void>;
  async createRule(rule: ProceduralRuleInput): Promise<void>;

  // ── Querying ─────────────────────────────────────────
  async recallEpisodes(opts: EpisodeQueryOpts): Promise<EpisodicMemory[]>;
  async recallFacts(subject: string, predicate?: string): Promise<SemanticMemory[]>;
  async findRules(context: RuleContext): Promise<ProceduralRule[]>;

  // ── Learning ─────────────────────────────────────────
  async learnFromEpisode(episode: EpisodicMemory): Promise<void>;
  // Extracts: lessons, potential facts, potential rules
  // Persists: to semantic and procedural memory

  async minePatterns(opts?: { providerId?: string; since?: number }): Promise<MiningResult>;
  // Analyzes recent episodes, finds patterns, proposes rules

  async consolidate(): Promise<void>;
  // Periodic job: merge duplicate facts, prune low-confidence rules,
  // update confidence based on recent outcomes

  // ── Agent Decision Support ───────────────────────────
  async getAgentContext(providerId: string, capabilityId: string): Promise<AgentMemoryContext>;
  // Returns: relevant facts, applicable rules, similar past episodes
  // Used by AgenticLoopEngine's PlanLayer
}

interface AgentMemoryContext {
  facts: SemanticMemory[];           // facts about this provider/capability
  rules: ProceduralRule[];           // rules that might apply
  similarEpisodes: EpisodicMemory[];  // similar past executions
  recommendations: string[];         // LLM-generated recommendations based on memory
}
```

---

## TransferAccelerator

### Purpose

Mine successful capability execution patterns from one provider and propose transfers to another provider that has a similar shape but lacks that capability.

```typescript
class TransferAccelerator {
  constructor(
    private memory: MemoryEngine,
    private store: TransferStore,
    private shapeRegistry: CapabilityShapeRegistry,
  ) {}

  async findTransferCandidates(): Promise<TransferCandidate[]>;
  async attemptTransfer(candidateId: string): Promise<TransferAttemptResult>;
  async batchTransfer(opts?: { shapeId?: string }): Promise<BatchTransferResult>;
}

interface TransferCandidate {
  id: string;
  fromProviderId: string;
  toProviderId: string;
  capabilityId: string;
  // Why is this a good candidate?
  rationale: string;
  // What pattern is being transferred?
  pattern: {
    selectorStrategy: SemanticSelector;
    executionDag: HarnessDAG;
    parserHint: string;
  };
  // Confidence in transfer success
  confidence: number;
  status: 'pending' | 'approved' | 'rejected' | 'attempted' | 'verified';
}
```

### Transfer Flow

```
findTransferCandidates()
  │
  ├─ [1] Find providers with same shape
  │     └─ e.g., all 'chat_app' shape providers
  │
  ├─ [2] For each capability:
  │     ├─ Provider A has it as 'stable' (high confidence)
  │     ├─ Provider B has it as 'prospect' or doesn't have it
  │     └─ Create TransferCandidate: A → B
  │
  ├─ [3] Score candidates:
  │     ├─ Shape similarity (0.0-1.0)
  │     ├─ DOM structure similarity (0.0-1.0)
  │     ├─ Capability overlap (how many other caps match)
  │     └─ Overall confidence = weighted average
  │
  └─ [4] Return sorted candidates
```

---

## Integration with Agentic Loop

The AgenticLoopEngine's PlanLayer queries MemoryEngine before planning:

```typescript
// In PlanLayer.plan():
async function plan(senseResult: SenseResult, goal: AgenticGoal): Promise<PlanResult> {
  // 1. Check memory for applicable rules
  const rules = await memory.findRules({
    providerId: senseResult.providerId,
    pageStatePattern: senseResult.domSummary.textContent,
  });

  // 2. If a high-confidence rule matches, use it
  const applicableRule = rules.find(r => r.confidence > 0.8);
  if (applicableRule) {
    return applyRule(applicableRule, senseResult);
  }

  // 3. Check memory for similar past episodes
  const similarEpisodes = await memory.recallEpisodes({
    providerId: senseResult.providerId,
    capabilityId: goal.capabilityId,
  });

  // 4. If similar episode succeeded, replicate its plan
  const successfulEpisode = similarEpisodes.find(e => e.episode.outcome === 'success');
  if (successfulEpisode) {
    return replicatePlan(successfulEpisode, senseResult);
  }

  // 5. Fall back to LLM planning (with memory context)
  const memoryContext = await memory.getAgentContext(senseResult.providerId, goal.capabilityId);
  return llmPlan(senseResult, goal, memoryContext);
}
```

---

## Consolidation Schedule

The MemoryEngine runs periodic consolidation:

| Job | Schedule | Purpose |
|-----|----------|---------|
| `learn_from_episodes` | Every 5 min | Process new episodes, extract lessons + facts + rules |
| `mine_patterns` | Every 1 hour | Analyze recent episodes, propose new procedural rules |
| `consolidate_facts` | Every 6 hours | Merge duplicate facts, retract contradicted facts |
| `prune_rules` | Every 24 hours | Remove rules with confidence < 0.2 after > 10 applications |
| `update_confidence` | Every 1 hour | Recalculate rule confidence based on recent outcomes |
| `transfer_mining` | Every 24 hours | Find transfer candidates across same-shape providers |

All jobs are reprogrammable via ConfigManager.

---

## See also

- `SOTA-03` — Agentic loop (uses memory for planning)
- `SOTA-02` — Shape registry (used by TransferAccelerator for shape similarity)
- `SOTA-07` — Schema delta (new tables: episodic_memory, semantic_memory, procedural_rule, agent_decision_log)
