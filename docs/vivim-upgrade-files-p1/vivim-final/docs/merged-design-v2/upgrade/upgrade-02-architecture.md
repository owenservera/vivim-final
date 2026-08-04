# 02 — Upgrade Architecture: New Engines, Modified Engines, Boot Sequence

> **Status:** PROPOSED | **Date:** 2026-07-11
> **Source:** Codebase analysis — all 37 existing engines, 16 store contracts, server/executor/CLI/web

---

## Architecture Overview

The upgrade adds 17 new engines across 7 phases, extending the existing 13-layer architecture. The key architectural principle is **additive extension** — no existing engine is replaced, only extended. Every new engine follows the established pattern: store contract → engine class → EventBus integration → server route → CLI command.

### Current Architecture (v1)

```
┌─────────────────────────────────────────────────────┐
│  CLI (src/cli/)  │  Server (src/server/)  │  Web UI  │
├──────────────────┴────────────────────────┴──────────┤
│                    Router (src/router/)               │
├───────────────────────────────────────────────────────┤
│  L0-L13 Engines (37 engines in src/engines/)         │
│  ┌────────────┐ ┌──────────┐ ┌──────────────────┐   │
│  │ Capability │ │ Conversa │ │ Provider Health  │   │
│  │ System     │ │ tion Mgr │ │ Kernel           │   │
│  ├────────────┤ ├──────────┤ ├──────────────────┤   │
│  │ ChromeGov  │ │ Stream   │ │ Version/Trae     │   │
│  │ ernor      │ │ Parser   │ │ lmetry/Config    │   │
│  ├────────────┤ ├──────────┤ ├──────────────────┤   │
│  │ Memory     │ │ Mirror   │ │ Workflow/Agent   │   │
│  │ Engine     │ │ Engine   │ │ icLoop           │   │
│  └────────────┘ └──────────┘ └──────────────────┘   │
├───────────────────────────────────────────────────────┤
│  Store Contracts (src/storage/contracts/)             │
│  Store Implementations (src/storage/impl/)            │
├───────────────────────────────────────────────────────┤
│  Prisma + SQLite (prisma/schema.prisma)               │
└───────────────────────────────────────────────────────┘
```

### Upgraded Architecture (v2)

```
┌─────────────────────────────────────────────────────────────┐
│  CLI (complete)  │  Server (complete)  │  Adaptive Web UI   │
│  + Unified Reg   │  + Mux/Knowledge/   │  + Workspace Modes  │
│                  │    Context/Auto/    │  + Memory Viz       │
│                  │    Export routes    │  + Workflow Builder │
├──────────────────┴─────────────────────┴────────────────────┤
│           ProviderMuxEngine (fan-out + synthesis)            │
├──────────────────────────────────────────────────────────────┤
│  ContextAssemblyEngine ← SituationDetector                   │
│  KnowledgeIngestionEngine ← Import Parsers                   │
│  KnowledgeExtractor → SemanticSearchEngine                   │
│  CrossConversationSynthesizer                                │
├──────────────────────────────────────────────────────────────┤
│  AutonomousExecutionEngine ← ExecutionPolicyEngine           │
│  UnifiedCapabilityRegistry ← PluginHotReload                 │
│  AdaptiveWorkspaceEngine ← MemoryVisualizationEngine         │
├──────────────────────────────────────────────────────────────┤
│  EncryptionEngine | ExportEngine | AirGapEngine | SyncEngine │
├──────────────────────────────────────────────────────────────┤
│  EXISTING v1 ENGINES (37 engines — extended, not replaced)  │
│  ChromeGovernor | ConversationManager | CapabilitySystem    │
│  StreamParser | MemoryEngine | MirrorEngine | WorkflowEngine│
│  AgenticLoop | SelectorHealer | ProviderHealth | VersionMgr │
│  TelemetryAggregator | ConfigManager | Router | ...         │
├──────────────────────────────────────────────────────────────┤
│  Store Contracts (existing + ~12 new)                        │
│  Store Implementations (existing + ~12 new)                  │
├──────────────────────────────────────────────────────────────┤
│  Prisma + SQLite (WAL mode, encrypted at rest)               │
│  ~65 existing tables + ~28 new tables                        │
└──────────────────────────────────────────────────────────────┘
```

---

## New Engine Designs (Full TypeScript Interfaces)

### 1. KnowledgeIngestionEngine (Phase 15, Obj 1)

```typescript
// src/engines/knowledge-ingestion.ts

export type ImportSource = 'chatgpt' | 'claude' | 'gemini' | 'deepseek' | 'generic' | 'manual'

export interface ImportConfig {
  source: ImportSource
  filePath: string
  providerId?: string
  deduplicate: boolean
  extractEntities: boolean
  extractDecisions: boolean
  generateEmbeddings: boolean
}

export interface ImportResult {
  jobId: string
  source: ImportSource
  conversationsImported: number
  messagesImported: number
  entitiesExtracted: number
  decisionsExtracted: number
  duplicatesSkipped: number
  errors: Array<{ conversationId: string; error: string }>
  durationMs: number
}

export interface ImportProgress {
  jobId: string
  phase: 'parsing' | 'normalizing' | 'deduplicating' | 'extracting' | 'embedding' | 'complete'
  current: number
  total: number
  message: string
}

export interface KnowledgeIngestionStore {
  createImportJob(job: {
    id: string
    source: string
    filePath: string
    status: string
    configJson: string
    startedAt: number
  }): Promise<void>
  updateImportJob(id: string, patch: {
    status?: string
    resultJson?: string
    completedAt?: number
    error?: string
  }): Promise<void>
  getImportJob(id: string): Promise<{
    id: string
    source: string
    filePath: string
    status: string
    configJson: string
    resultJson: string | null
    startedAt: number
    completedAt: number | null
  } | null>
  listImportJobs(opts?: { limit?: number; source?: string }): Promise<Array<{
    id: string
    source: string
    status: string
    startedAt: number
    completedAt: number | null
  }>>
  findExistingConversation(
    sourceProviderId: string,
    externalId: string,
  ): Promise<string | null>
}

export class KnowledgeIngestionEngine {
  constructor(
    private store: KnowledgeIngestionStore,
    private conversationStore: ConversationStore,
    private blockStore: StreamBlockStoreContract,
    private extractor: KnowledgeExtractor,
    private eventBus: CapabilityEventBus,
  ) {}

  async ingest(config: ImportConfig): Promise<ImportResult>
  async ingestFile(filePath: string, source: ImportSource): Promise<ImportResult>
  async getJobStatus(jobId: string): Promise<ImportProgress | null>
  async listJobs(opts?: { limit?: number }): Promise<Array<{ id: string; source: string; status: string }>>
  async cancelJob(jobId: string): Promise<void>
}
```

### 2. KnowledgeExtractor (Phase 15, Obj 1)

```typescript
// src/engines/knowledge-extractor.ts

export type ExtractionType =
  | 'fact'
  | 'decision'
  | 'entity_person'
  | 'entity_project'
  | 'entity_technology'
  | 'entity_concept'
  | 'pattern'
  | 'preference'
  | 'summary'

export interface ExtractionResult {
  type: ExtractionType
  subject: string
  predicate: string
  object: unknown
  confidence: number
  sourceConversationId: string
  sourceMessageId: string
  context: string
}

export interface KnowledgeExtractorConfig {
  batchSize: number
  confidenceThreshold: number
  enableEntityExtraction: boolean
  enableDecisionExtraction: boolean
  enablePatternMining: boolean
  llmAssisted: boolean
  llmModel: string
}

export interface KnowledgeExtractorStore {
  createEntity(input: {
    id: string
    name: string
    type: string
    description: string | null
    confidence: number
    firstSeenAt: number
    lastSeenAt: number
  }): Promise<void>
  updateEntity(id: string, patch: { confidence?: number; lastSeenAt?: number }): Promise<void>
  findEntityByName(name: string, type: string): Promise<{ id: string; name: string; type: string } | null>
  createEntityMention(input: {
    id: string
    entityId: string
    conversationId: string
    messageId: string
    context: string
    confidence: number
    ts: number
  }): Promise<void>
  createDecision(input: {
    id: string
    conversationId: string
    messageId: string
    decisionText: string
    rationale: string | null
    alternatives: string
    confidence: number
    ts: number
  }): Promise<void>
  createPattern(input: {
    id: string
    name: string
    description: string
    patternType: string
    occurrences: number
    confidence: number
    firstSeenAt: number
    lastSeenAt: number
  }): Promise<void>
  updatePattern(id: string, patch: { occurrences?: number; confidence?: number; lastSeenAt?: number }): Promise<void>
  findPattern(name: string): Promise<{ id: string; name: string } | null>
  assertSemanticMemory(input: {
    id: string
    subject: string
    predicate: string
    objectJson: string
    confidence: number
    source: string
    timestamp: number
    expiresAt: number | null
  }): Promise<void>
}

export class KnowledgeExtractor {
  constructor(
    private store: KnowledgeExtractorStore,
    private config: KnowledgeExtractorConfig,
  ) {}

  async extractFromMessage(
    conversationId: string,
    messageId: string,
    role: string,
    content: string,
    context: string,
  ): Promise<ExtractionResult[]>
  async extractFromConversation(
    conversationId: string,
    messages: Array<{ id: string; role: string; content: string }>,
  ): Promise<ExtractionResult[]>
  async batchExtract(
    conversations: Array<{
      id: string
      messages: Array<{ id: string; role: string; content: string }>
    }>,
  ): Promise<{ totalExtracted: number; byType: Record<ExtractionType, number> }>
  async reExtract(conversationId: string): Promise<void>
}
```

### 3. SemanticSearchEngine (Phase 15, Obj 1)

```typescript
// src/engines/semantic-search.ts

export interface SearchQuery {
  text: string
  conversationId?: string
  providerId?: string
  topicId?: string
  projectId?: string
  entityType?: string
  dateFrom?: number
  dateTo?: number
  limit?: number
  threshold?: number
}

export interface SearchResult {
  type: 'conversation' | 'message' | 'fact' | 'entity' | 'decision'
  id: string
  score: number
  snippet: string
  conversationId: string | null
  metadata: Record<string, unknown>
}

export interface EmbeddingResult {
  id: string
  embedding: number[]
  model: string
  dimensions: number
}

export interface SemanticSearchStore {
  upsertEmbedding(input: {
    id: string
    entityType: string
    entityId: string
    embedding: string
    model: string
    dimensions: number
    contentHash: string
    createdAt: number
  }): Promise<void>
  getEmbedding(entityType: string, entityId: string): Promise<{
    id: string
    embedding: string
    model: string
    dimensions: number
  } | null>
  searchByEmbedding(
    embedding: number[],
    opts: { limit?: number; threshold?: number; entityType?: string },
  ): Promise<Array<{ entityId: string; entityType: string; score: number }>>
  deleteEmbedding(entityType: string, entityId: string): Promise<void>
  countEmbeddings(opts?: { entityType?: string }): Promise<number>
}

export interface EmbeddingProvider {
  name: string
  dimensions: number
  embed(text: string): Promise<number[]>
  embedBatch(texts: string[]): Promise<number[][]>
}

export class SemanticSearchEngine {
  constructor(
    private store: SemanticSearchStore,
    private embeddingProvider: EmbeddingProvider,
  ) {}

  async index(text: string, entityType: string, entityId: string): Promise<void>
  async indexBatch(items: Array<{ text: string; entityType: string; entityId: string }>): Promise<void>
  async search(query: SearchQuery): Promise<SearchResult[]>
  async searchHybrid(query: SearchQuery): Promise<SearchResult[]>
  async reindexAll(): Promise<{ indexed: number; skipped: number; errors: number }>
  async getStats(): Promise<{ totalEmbeddings: number; byType: Record<string, number> }>
}
```

### 4. CrossConversationSynthesizer (Phase 15, Obj 1)

```typescript
// src/engines/cross-conversation-synthesis.ts

export interface SynthesisQuery {
  question: string
  scope: {
    providerIds?: string[]
    topicIds?: string[]
    projectIds?: string[]
    dateFrom?: number
    dateTo?: number
  }
  maxSources: number
  synthesisStyle: 'summary' | 'detailed' | 'bullets' | 'comparison'
}

export interface SynthesisResult {
  answer: string
  sources: Array<{
    conversationId: string
    messageId: string
    snippet: string
    relevance: number
  }>
  confidence: number
  gaps: string[]
  generatedAt: number
}

export interface CrossConversationSynthesizerStore {
  getRelevantMessages(
    query: string,
    opts: { limit?: number; providerIds?: string[]; topicIds?: string[] },
  ): Promise<Array<{
    conversationId: string
    messageId: string
    role: string
    content: string
    score: number
  }>>
  getRelatedFacts(subject: string): Promise<Array<{
    id: string
    subject: string
    predicate: string
    objectJson: string
    confidence: number
  }>>
  getDecisionsForTopic(topicId: string): Promise<Array<{
    id: string
    decisionText: string
    rationale: string | null
    ts: number
  }>>
}

export interface SynthesisLlmProvider {
  synthesize(
    question: string,
    sources: Array<{ content: string; metadata: Record<string, unknown> }>,
    style: string,
  ): Promise<{ answer: string; confidence: number }>
}

export class CrossConversationSynthesizer {
  constructor(
    private store: CrossConversationSynthesizerStore,
    private searchEngine: SemanticSearchEngine,
    private llmProvider: SynthesisLlmProvider,
  ) {}

  async synthesize(query: SynthesisQuery): Promise<SynthesisResult>
  async quickAnswer(question: string): Promise<SynthesisResult>
  async compareTopics(topicA: string, topicB: string): Promise<SynthesisResult>
}
```

### 5. ProviderMuxEngine (Phase 16, Obj 2)

```typescript
// src/engines/provider-mux.ts

export type MuxStrategy = 'fan_out' | 'round_robin' | 'priority' | 'cost_optimized' | 'learned'

export interface MuxRequest {
  message: string
  conversationId?: string
  capabilityId?: string
  strategy: MuxStrategy
  targetProviderIds?: string[]
  maxProviders: number
  synthesisEnabled: boolean
  costBudgetCents?: number
  timeoutMs: number
}

export interface MuxResponse {
  muxSessionId: string
  providerResponses: Array<{
    providerId: string
    accountId: string | null
    ok: boolean
    response: string
    latencyMs: number
    costCents: number
    error?: string
  }>
  synthesizedResponse: string | null
  bestProviderId: string | null
  totalCostCents: number
  totalLatencyMs: number
  strategyUsed: MuxStrategy
}

export interface MuxSessionRow {
  id: string
  message: string
  conversationId: string | null
  strategy: string
  status: string
  synthesizedResponse: string | null
  bestProviderId: string | null
  totalCostCents: number
  totalLatencyMs: number
  startedAt: number
  completedAt: number | null
}

export interface MuxResponseRow {
  id: string
  muxSessionId: string
  providerId: string
  accountId: string | null
  ok: boolean
  response: string
  latencyMs: number
  costCents: number
  error: string | null
  ts: number
}

export interface MuxStore {
  createMuxSession(session: MuxSessionRow): Promise<void>
  updateMuxSession(id: string, patch: Partial<MuxSessionRow>): Promise<void>
  getMuxSession(id: string): Promise<MuxSessionRow | null>
  createMuxResponse(response: MuxResponseRow): Promise<void>
  getMuxResponses(sessionId: string): Promise<MuxResponseRow[]>
  createRoutingPreference(input: {
    id: string
    capabilityId: string
    providerId: string
    score: number
    sampleCount: number
    updatedAt: number
  }): Promise<void>
  updateRoutingPreference(id: string, patch: { score?: number; sampleCount?: number; updatedAt?: number }): Promise<void>
  getRoutingPreferences(capabilityId?: string): Promise<Array<{
    id: string
    capabilityId: string
    providerId: string
    score: number
    sampleCount: number
  }>>
}

export interface MuxDispatcher {
  dispatchToProvider(
    providerId: string,
    message: string,
    conversationId?: string,
  ): Promise<{ ok: boolean; response: string; latencyMs: number; costCents: number; error?: string }>
}

export class ProviderMuxEngine {
  constructor(
    private store: MuxStore,
    private dispatcher: MuxDispatcher,
    private router: Router,
    private eventBus: CapabilityEventBus,
  ) {}

  async mux(request: MuxRequest): Promise<MuxResponse>
  async fanOut(message: string, providerIds: string[], timeoutMs: number): Promise<MuxResponse>
  async roundRobin(message: string, providerIds: string[]): Promise<MuxResponse>
  async autoRoute(message: string, capabilityId?: string): Promise<MuxResponse>
  async synthesize(responses: Array<{ providerId: string; response: string }>): Promise<string>
  async recordOutcome(muxSessionId: string, bestProviderId: string): Promise<void>
  async getRoutingScore(capabilityId: string, providerId: string): Promise<number>
}
```

### 6. SituationDetector (Phase 17, Obj 3)

```typescript
// src/engines/situation-detector.ts

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
  providerId?: string
  recentMessages?: Array<{ role: string; content: string }>
  userHistory?: Array<{ taskType: string; timestamp: number }>
}

export interface SituationLogRow {
  id: string
  conversationId: string | null
  detectedType: string
  confidence: number
  signalsJson: string
  timestamp: number
}

export interface SituationStore {
  createLog(log: SituationLogRow): Promise<void>
  getRecentForConversation(conversationId: string, limit?: number): Promise<SituationLogRow[]>
  getRecentByType(taskType: string, limit?: number): Promise<SituationLogRow[]>
  createUserPreference(input: {
    id: string
    userId: string
    key: string
    value: string
    learnedAt: number
  }): Promise<void>
  getUserPreferences(userId: string): Promise<Array<{ key: string; value: string }>>
}

export class SituationDetector {
  constructor(
    private store: SituationStore,
    private memoryEngine: MemoryEngine,
  ) {}

  async detect(input: DetectionInput): Promise<SituationSignal>
  async detectFromMessage(message: string): Promise<SituationSignal>
  async detectFromHistory(conversationId: string): Promise<SituationSignal>
  async learnFromCorrection(
    conversationId: string,
    detectedType: TaskType,
    actualType: TaskType,
  ): Promise<void>
  async getMostCommonTask(): Promise<TaskType>
}
```

### 7. ContextAssemblyEngine (Phase 17, Obj 3)

```typescript
// src/engines/context-assembly.ts

export type ContextLayerName =
  | 'identity'
  | 'preferences'
  | 'topic'
  | 'entity'
  | 'conversation_history'
  | 'recent_episodes'
  | 'project_state'
  | 'situational'

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
  truncatedLayers: ContextLayerName[]
}

export interface ContextBudget {
  total: number
  layers: Record<ContextLayerName, number>
  strategy: 'equal' | 'weighted' | 'priority' | 'adaptive'
}

export interface PreWarmEntry {
  conversationId: string
  predictedNeed: string
  assembledAt: number
  hitAt: number | null
}

export interface ContextAssemblyStore {
  createContextLayer(input: {
    id: string
    conversationId: string
    layerName: string
    content: string
    tokenCount: number
    priority: number
    assembledAt: number
  }): Promise<void>
  getContextLayers(conversationId: string): Promise<Array<{
    layerName: string
    content: string
    tokenCount: number
    priority: number
  }>>
  createPreWarmEntry(input: {
    id: string
    conversationId: string
    predictedNeed: string
    assembledAt: number
  }): Promise<void>
  updatePreWarmEntry(id: string, patch: { hitAt?: number }): Promise<void>
  getPreWarmEntries(opts: { since?: number; unhitOnly?: boolean }): Promise<PreWarmEntry[]>
}

export class ContextAssemblyEngine {
  constructor(
    private store: ContextAssemblyStore,
    private situationDetector: SituationDetector,
    private memoryEngine: MemoryEngine,
    private searchEngine: SemanticSearchEngine,
  ) {}

  async assemble(conversationId: string, userMessage: string): Promise<AssembledContext>
  async assembleWithBudget(
    conversationId: string,
    userMessage: string,
    budget: ContextBudget,
  ): Promise<AssembledContext>
  async preWarm(conversationId: string): Promise<void>
  async checkPreWarmHits(): Promise<number>
  async getContextForProvider(conversationId: string): Promise<string>
}
```

### 8. UnifiedCapabilityRegistry (Phase 18, Obj 4)

```typescript
// src/engines/unified-registry.ts

export type CapabilitySurface = 'cli' | 'ui' | 'workflow' | 'mcp' | 'api'

export interface UnifiedCapability {
  id: string
  slug: string
  name: string
  description: string
  category: string
  surfaces: CapabilitySurface[]
  inputSchema: Record<string, unknown>
  outputSchema: Record<string, unknown>
  handler: (input: Record<string, unknown>, ctx: CapabilityContext) => Promise<unknown>
  cliCommand?: { name: string; aliases: string[]; examples: string[] }
  uiAction?: { component: string; position: string; order: number }
  workflowNodeType?: string
  mcpToolName?: string
  apiEndpoint?: { method: string; path: string }
  isAsync: boolean
  requiresConfirmation: boolean
  tags: string[]
}

export interface CapabilityContext {
  conversationId?: string
  providerId?: string
  slaveId?: string
  userId?: string
  metadata: Record<string, unknown>
}

export interface RegistryFilter {
  surface?: CapabilitySurface
  category?: string
  tag?: string
  providerId?: string
}

export class UnifiedCapabilityRegistry {
  private capabilities = new Map<string, UnifiedCapability>()

  register(capability: UnifiedCapability): void
  unregister(id: string): void
  get(id: string): UnifiedCapability | null
  getBySlug(slug: string): UnifiedCapability | null
  list(filter?: RegistryFilter): UnifiedCapability[]
  listForSurface(surface: CapabilitySurface): UnifiedCapability[]
  async execute(id: string, input: Record<string, unknown>, ctx: CapabilityContext): Promise<unknown>
  exportForCli(): Array<{ name: string; description: string; schema: Record<string, unknown> }>
  exportForMcp(): Array<{ name: string; description: string; inputSchema: Record<string, unknown> }>
  exportForWorkflow(): Array<{ type: string; category: string; config: Record<string, unknown> }>
}
```

### 9. AutonomousExecutionEngine (Phase 19, Obj 6)

```typescript
// src/engines/autonomous-execution.ts

export type TaskStatus = 'pending' | 'planning' | 'executing' | 'waiting_approval' | 'complete' | 'failed' | 'cancelled'
export type StepStatus = 'pending' | 'running' | 'complete' | 'failed' | 'skipped' | 'waiting_human'
export type ActionClassification = 'read' | 'write' | 'navigate' | 'destructive' | 'financial' | 'communication'

export interface AutonomousGoal {
  description: string
  maxSteps: number
  maxDurationMs: number
  requireApprovalAbove: ActionClassification
  allowBrowser: boolean
  allowApi: boolean
  costBudgetCents: number
}

export interface AutonomousTask {
  id: string
  goal: AutonomousGoal
  status: TaskStatus
  steps: AutonomousStep[]
  startedAt: number
  completedAt: number | null
  result: unknown
  error: string | null
}

export interface AutonomousStep {
  id: string
  taskId: string
  stepIndex: number
  description: string
  action: string
  actionInput: Record<string, unknown>
  classification: ActionClassification
  status: StepStatus
  result: unknown
  error: string | null
  startedAt: number | null
  completedAt: number | null
  requiresHumanApproval: boolean
}

export interface HitlGate {
  id: string
  taskId: string
  stepId: string
  gateType: 'approval' | 'confirmation' | 'selection' | 'input'
  prompt: string
  options: string[]
  defaultValue: string | null
  status: 'pending' | 'approved' | 'denied' | 'skipped' | 'expired'
  resolvedBy: string | null
  resolvedAt: number | null
  response: string | null
  createdAt: number
  expiresAt: number | null
}

export interface AutonomousExecutionStore {
  createTask(task: AutonomousTask): Promise<void>
  updateTask(id: string, patch: Partial<AutonomousTask>): Promise<void>
  getTask(id: string): Promise<AutonomousTask | null>
  createStep(step: AutonomousStep): Promise<void>
  updateStep(id: string, patch: Partial<AutonomousStep>): Promise<void>
  getSteps(taskId: string): Promise<AutonomousStep[]>
  createHitlGate(gate: HitlGate): Promise<void>
  updateHitlGate(id: string, patch: Partial<HitlGate>): Promise<void>
  getPendingGates(taskId?: string): Promise<HitlGate[]>
  getGate(id: string): Promise<HitlGate | null>
}

export class AutonomousExecutionEngine {
  constructor(
    private store: AutonomousExecutionStore,
    private registry: UnifiedCapabilityRegistry,
    private policyEngine: ExecutionPolicyEngine,
    private governor: ChromeGovernor,
    private eventBus: CapabilityEventBus,
  ) {}

  async execute(goal: AutonomousGoal): Promise<AutonomousTask>
  async executeFromConversation(conversationId: string, goal: string): Promise<AutonomousTask>
  async cancel(taskId: string): Promise<void>
  async getStatus(taskId: string): Promise<AutonomousTask | null>
  async resolveGate(gateId: string, response: string, resolvedBy: string): Promise<void>
  async getPendingGates(): Promise<HitlGate[]>
  async replay(taskId: string, fromStep?: string): Promise<AutonomousTask>
}
```

### 10. ExecutionPolicyEngine (Phase 19, Obj 6)

```typescript
// src/engines/execution-policy.ts

export interface PolicyRule {
  id: string
  name: string
  condition: string
  classification: ActionClassification
  requiresApproval: boolean
  cooldownMs: number
  maxOccurrences: number
  windowMs: number
  isActive: boolean
}

export interface PolicyDecision {
  allowed: boolean
  classification: ActionClassification
  requiresApproval: boolean
  reason: string
  matchedRule: string | null
}

export interface PolicyStore {
  createRule(rule: PolicyRule): Promise<void>
  updateRule(id: string, patch: Partial<PolicyRule>): Promise<void>
  deleteRule(id: string): Promise<void>
  listRules(opts?: { activeOnly?: boolean }): Promise<PolicyRule[]>
  recordOccurrence(input: { id: string; ruleId: string; action: string; ts: number }): Promise<void>
  countOccurrences(ruleId: string, windowMs: number): Promise<number>
}

export class ExecutionPolicyEngine {
  constructor(private store: PolicyStore) {}

  async evaluate(action: string, input: Record<string, unknown>): Promise<PolicyDecision>
  async classify(action: string): Promise<ActionClassification>
  async addRule(rule: Omit<PolicyRule, 'id'>): Promise<PolicyRule>
  async removeRule(id: string): Promise<void>
  async listRules(): Promise<PolicyRule[]>
}
```

### 11. EncryptionEngine (Phase 20, Obj 7)

```typescript
// src/engines/encryption.ts

export interface EncryptionConfig {
  algorithm: 'aes-256-gcm'
  keyDerivation: 'pbkdf2' | 'argon2'
  iterations: number
  saltLength: number
  ivLength: number
}

export interface EncryptedData {
  ciphertext: string
  iv: string
  salt: string
  authTag: string
  algorithm: string
}

export class EncryptionEngine {
  private key: Buffer | null = null

  constructor(private config: EncryptionConfig) {}

  async unlock(passphrase: string): Promise<void>
  lock(): void
  isUnlocked(): boolean
  encrypt(plaintext: string): EncryptedData
  decrypt(encrypted: EncryptedData): string
  encryptField(value: string): string
  decryptField(encryptedValue: string): string
  async changePassphrase(oldPassphrase: string, newPassphrase: string): Promise<void>
  async exportKey(): Promise<string>
}
```

### 12. ExportEngine (Phase 20, Obj 7)

```typescript
// src/engines/export.ts

export type ExportFormat = 'json' | 'csv' | 'sqlite'
export type ExportScope = 'full' | 'conversations' | 'memory' | 'providers' | 'config'

export interface ExportOptions {
  format: ExportFormat
  scope: ExportScope
  outputPath: string
  includeEmbeddings: boolean
  includeChromeProfiles: boolean
  encryptWithPassphrase?: string
  dateFrom?: number
  dateTo?: number
}

export interface ExportResult {
  filePath: string
  format: ExportFormat
  scope: ExportScope
  tablesExported: string[]
  totalRows: number
  fileSizeBytes: number
  durationMs: number
  encrypted: boolean
}

export class ExportEngine {
  constructor(private db: CapStoreDb) {}

  async export(options: ExportOptions): Promise<ExportResult>
  async exportTable(tableName: string, format: ExportFormat, outputPath: string): Promise<number>
  async exportFull(format: ExportFormat, outputPath: string): Promise<ExportResult>
  async importFromJson(filePath: string): Promise<{ tablesImported: string[]; rowsImported: number }>
}
```

### 13. AirGapEngine (Phase 20, Obj 7)

```typescript
// src/engines/airgap.ts

export interface AirGapConfig {
  enabled: boolean
  localModelProvider: 'ollama' | 'llamacpp' | 'none'
  localModelEndpoint: string
  fallbackToCloud: boolean
  cacheResponses: boolean
}

export interface AirGapStatus {
  isAirGapMode: boolean
  networkReachable: boolean
  localModelAvailable: boolean
  localModelName: string | null
  cachedResponses: number
}

export class AirGapEngine {
  constructor(private config: AirGapConfig) {}

  async enable(): Promise<void>
  async disable(): Promise<void>
  async getStatus(): Promise<AirGapStatus>
  async checkNetwork(): Promise<boolean>
  async checkLocalModel(): Promise<boolean>
  async routeToLocalModel(message: string): Promise<{ ok: boolean; response: string; error?: string }>
}
```

### 14. SyncEngine (Phase 20, Obj 7)

```typescript
// src/engines/sync.ts

export interface SyncConfig {
  enabled: boolean
  relayUrl: string
  deviceId: string
  syncIntervalMs: number
  conflictResolution: 'last_write_wins' | 'manual'
}

export interface SyncPeer {
  id: string
  deviceId: string
  name: string
  publicKey: string
  lastSyncAt: number | null
  status: 'paired' | 'pending' | 'revoked'
}

export interface SyncLogEntry {
  id: string
  deviceId: string
  table: string
  recordId: string
  operation: 'create' | 'update' | 'delete'
  dataJson: string
  ts: number
  syncedAt: number | null
}

export interface SyncStore {
  createLogEntry(entry: SyncLogEntry): Promise<void>
  getUnsyncedEntries(deviceId: string, limit?: number): Promise<SyncLogEntry[]>
  markSynced(ids: string[]): Promise<void>
  createPeer(peer: SyncPeer): Promise<void>
  updatePeer(id: string, patch: Partial<SyncPeer>): Promise<void>
  getPeers(): Promise<SyncPeer[]>
  getPeer(deviceId: string): Promise<SyncPeer | null>
}

export class SyncEngine {
  constructor(
    private store: SyncStore,
    private config: SyncConfig,
    private encryption: EncryptionEngine,
  ) {}

  async pair(newDeviceId: string, name: string): Promise<{ pairingCode: string }>
  async confirmPair(deviceId: string, pairingCode: string): Promise<void>
  async sync(): Promise<{ entriesSynced: number; conflicts: number }>
  async getPendingSync(): Promise<number>
  async getPeers(): Promise<SyncPeer[]>
  async revokePeer(deviceId: string): Promise<void>
}
```

---

## Modified Engines

### ChromeGovernor — Wire Real CDP (Phase 14)

**Current state:** `stubCdp` object (chrome-governor.ts:630-658) throws `EngineError('CDP transport not configured - implement in Phase 9')` for all CDP operations. Trace methods (lines 662-672) and health probe (lines 676-686) also throw.

**Changes:**
- Add `CDPTransportImpl` class implementing `CDPTransport` interface that wraps `BunCdpClient`
- Replace `stubCdp` with real CDP proxy backed by `CDPTransportImpl`
- Wire `TraceLog` to actually record entries via `GovernorStore.createTraceEntry`
- Wire `HealthMonitor` to actually probe via `CDPProxy.send('Browser.getVersion')`
- Add `recordTrace()` method that calls `this.traceLog.record()`
- Add `probeHealth()` method that calls `this.healthMonitor.probe()`

### ConversationManager — Fix EventBus + Wire Server (Phase 14)

**Current state:** Defines its own local `interface CapabilityEventBus { emit(event: unknown): void }` (conversation-manager.ts:83) instead of importing the real one. Server bypasses ConversationManager entirely (conversation-router.ts creates conversations directly via `db.createConversation`).

**Changes:**
- Remove local `CapabilityEventBus` interface — import from `capability-event-bus.ts`
- Remove local `StreamParserEngine`, `StreamBlockStore` stub interfaces — import real ones
- Add server route `POST /api/conversations/:id/send` that calls `ConversationManager.send()`
- Add server route `GET /api/conversations/:id/capabilities` that calls `CapabilityResolutionEngine.resolve()`

### Router — Add Missing Methods + Store Impl (Phase 14)

**Current state:** `Router.listRequests` (router.ts:182) and `Router.getEvents` (router.ts:187) return empty arrays with comment "Store doesn't have a listRequests method; return empty for v1".

**Changes:**
- Add `listRequests(specId, opts)` and `listEvents(requestId)` to `RouterStore` contract
- Implement in `RouterStoreImpl`
- Wire Router methods to call store

### MemoryEngine — ULID + 10-Type Expansion (Phase 15)

**Current state:** Uses local `newId()` function (`mem_${Date.now()}_${counter}`, memory-engine.ts:128) instead of ULID. Only 3 memory types (episodic, semantic, procedural).

**Changes:**
- Import `newId` from `../ids.ts` (ULID), remove local counter
- Add entity, decision, pattern, topic, project, summary, preference memory types
- Each type maps to existing or new table

### HarnessRuntime — Wire Real Context (Phase 14)

**Current state:** `HarnessContext` methods are stubs (harness-runtime.ts:80-87): `query()→null`, `queryAll()→[]`, `waitFor()→null`, `getPageState()→empty`, `intercept()→''`.

**Changes:**
- Wire `HarnessContext` to call Governor CDP methods
- `query(selector)` → `governor.cdp.send(slaveId, 'DOM.querySelector', { selector })`
- `getPageState()` → `governor.cdp.getPageState(slaveId)`
- `intercept(pattern)` → `governor.cdp.capture(slaveId, pattern)`

### AgenticLoopEngine — Full Implementation (Phase 19)

**Current state:** Loop body says "Stub for v1" (agentic-loop.ts:63).

**Changes:**
- Implement full SENSE→PLAN→ACT→OBSERVE→REFLECT→ADAPT cycle
- SENSE: `MirrorEngine.projectState()` + `ObservationTap` events
- PLAN: Use `PlanningStrategy` implementations (rule-based, LLM-assisted)
- ACT: Execute via `UnifiedCapabilityRegistry.execute()` or Governor CDP
- OBSERVE: Re-project state, collect ObservationTap events
- REFLECT: Compare expected vs actual, record to MemoryEngine
- ADAPT: Update planning rules based on outcome

---

## Updated Boot Sequence

```typescript
// Boot order for the full upgraded system

async function bootUpgradedSystem(): Promise<void> {
  // Phase 1: Foundation (existing)
  const db = getDb()
  const eventBus = CapabilityEventBus.getInstance()

  // Phase 2: Config + Encryption (Phase 20)
  const encryption = new EncryptionEngine(config)
  await encryption.unlock(passphrase) // or skip if no encryption
  const configManager = new ConfigManager(configStore, eventBus)

  // Phase 3: Core Engines (existing, modified)
  const governor = new ChromeGovernor(governorStore, fleetConfig, eventBus, cdpTransport)
  await governor.boot()
  const parser = new StreamParserEngine(parserStore, parserConfig)
  const resolution = new CapabilityResolutionEngine(resolutionStore)
  const blocks = new StreamBlockStore(db)
  const memoizer = new ExecutionMemoizer(eventBus)

  // Phase 4: Memory + Knowledge (Phase 15)
  const memory = new MemoryEngine(episodicStore, semanticStore, proceduralStore, eventBus)
  const extractor = new KnowledgeExtractor(extractorStore, extractorConfig)
  const search = new SemanticSearchEngine(searchStore, embeddingProvider)
  const synthesizer = new CrossConversationSynthesizer(synthStore, search, llmProvider)

  // Phase 5: Context (Phase 17)
  const situationDetector = new SituationDetector(situationStore, memory)
  const contextAssembly = new ContextAssemblyEngine(contextStore, situationDetector, memory, search)

  // Phase 6: Conversation Manager (modified)
  const conversationManager = new ConversationManager(
    governor, resolution, parser, blocks, conversationStore, eventBus, memoizer, memory,
  )

  // Phase 7: Routing + Mux (Phase 16)
  const router = new Router(routerStore, dispatcher)
  const mux = new ProviderMuxEngine(muxStore, dispatcher, router, eventBus)

  // Phase 8: Autonomous (Phase 19)
  const policyEngine = new ExecutionPolicyEngine(policyStore)
  const autonomous = new AutonomousExecutionEngine(autoStore, registry, policyEngine, governor, eventBus)

  // Phase 9: Data (Phase 20)
  const exporter = new ExportEngine(db)
  const airgap = new AirGapEngine(airgapConfig)
  const sync = new SyncEngine(syncStore, syncConfig, encryption)

  // Phase 10: Server
  const server = await createServer(9420)

  // Phase 11: Start background processes
  memory.startConsolidation(300_000) // 5 min
  contextAssembly.checkPreWarmHits() // periodic
  if (sync.config.enabled) sync.start() // periodic
}
```

---

## Updated Dependency Graph (Full System)

```
EncryptionEngine ─── (wraps) ─── Prisma/SQLite
     │
     ▼
ConfigManager ─── (configures) ─── All Engines
     │
     ▼
ChromeGovernor ─── (CDP authority) ─── HarnessRuntime, CapabilityEngine, MirrorEngine,
     │                                  AgenticLoopEngine, AutonomousExecutionEngine,
     │                                  WorkflowEngine, SemanticGroundingEngine
     │
     ▼
CapabilityEventBus ─── (connects) ─── ALL Engines
     │
     ▼
MemoryEngine ←── KnowledgeExtractor ←── KnowledgeIngestionEngine
     │                                           │
     │                                      Import Parsers
     │                                    (ChatGPT/Claude/Gemini)
     │
     ├── SemanticSearchEngine ←── MemoryEmbedding
     │         │
     │    CrossConversationSynthesizer
     │
     └── ContextAssemblyEngine ←── SituationDetector
               │
         ConversationManager
               │
         ProviderMuxEngine ←── CostOptimizer
               │
         AutonomousExecutionEngine ←── ExecutionPolicyEngine
               │
         UnifiedCapabilityRegistry ←── PluginHotReload
```
