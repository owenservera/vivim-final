# 04 — Merged Engines: Core Engine Specifications

**Status:** FINAL — merged PRD
**Covers:** Original `05-engine-specs.md` + `pending-design/02-chrome-slave-io-governor.md` + `pending-design/03-conversation-manager.md` + `pending-design/04-capability-resolution-engine.md` + `pending-design/06-capability-event-bus.md` + `pending-design/07-provider-health-kernel.md` + `pending-design/08-stream-block-store.md` + vCode tool patterns

---

## Engine 1: ChromeGovernor

### Purpose

Single I/O authority for all Chrome interaction. No other engine imports `BunCdpClient` or touches CDP directly. All Chrome operations (spawn, kill, send CDP command, capture response, probe health) flow through the Governor.

### Store Contract

```typescript
// src/storage/contracts/governor-store.ts
interface GovernorStore {
  // Accounts
  getAccount(accountId: string): Promise<ProviderAccountRow | null>;
  getAccountsByProvider(providerId: string): Promise<ProviderAccountRow[]>;
  upsertAccount(account: ProviderAccountRow): Promise<void>;
  deleteAccount(accountId: string): Promise<void>;

  // Fleet events
  createFleetEvent(event: FleetEventInput): Promise<FleetEventRow>;
  getFleetEvents(slaveId: string, limit?: number): Promise<FleetEventRow[]>;

  // Circuit breaker
  getCircuitState(slaveId: string): Promise<CircuitBreakerStateRow | null>;
  upsertCircuitState(state: CircuitBreakerStateRow): Promise<void>;

  // Health ticks
  createHealthTick(tick: HealthTickInput): Promise<HealthTickRow>;

  // Trace
  createTraceEntry(entry: TraceEntryInput): Promise<TraceEntryRow>;
  getTrace(slaveId: string, limit?: number): Promise<TraceEntryRow[]>;
}

interface TraceEntryInput {
  engine: string;
  method: string;
  requestId?: string;
  conversationId?: string;
  providerId?: string;
  accountId?: string;
  slaveId?: string;
  cdpMethod?: string;
  cdpParams?: Record<string, unknown>;
  cdpResult?: unknown;
  durationMs: number;
  ok: boolean;
  error?: string;
}
```

### Public Interface

```typescript
// src/engines/chrome-governor.ts

interface ChromeSlave {
  slaveId: string;
  providerId: string;
  accountId: string;
  debugPort: number;
  profileDir: string;
  status: SlaveStatus;
  superState: SuperState;
  pid: number | null;
  consecutiveFailures: number;
  circuitState: 'closed' | 'half_open' | 'open';
  lastHealthCheck: number;
  mutex: AsyncMutex;
}

type SlaveStatus = 'starting' | 'running' | 'stopping' | 'stopped' | 'error' | 'crashed';
type SuperState = 'idle' | 'sending' | 'capturing' | 'parsing' | 'authenticating' | 'error';

interface LaunchOptions {
  visible?: boolean;
  profileDir?: string;
  debugPort?: number;
  extraArgs?: string[];
}

class ChromeGovernor {
  private slaves: Map<string, ChromeSlave> = new Map();
  private fleetConfig: FleetConfig;
  private circuitBreakers: Map<string, CircuitBreaker> = new Map();
  private traceLog: TraceLog;
  private healthMonitor: HealthMonitor;
  private lifecycleManager: LifecycleManager;
  private cdpProxy: CDPProxy;

  constructor(
    private store: GovernorStore,
    private config: FleetConfig,
    private eventBus?: CapabilityEventBus,
  ) {}

  // ── Boot ────────────────────────────────────────────
  async boot(): Promise<void>;

  // ── Lifecycle ───────────────────────────────────────
  async launch(providerId: string, opts?: LaunchOptions): Promise<ChromeSlave>;
  async kill(slaveId: string): Promise<void>;
  async killAll(): Promise<void>;
  async ensureRunning(slaveId: string): Promise<ChromeSlave>;
  getAllSlaves(opts?: { providerId?: string }): ChromeSlave[];
  getSlave(slaveId: string): ChromeSlave | null;

  // ── CDP (through CDPProxy) ──────────────────────────
  get cdp(): {
    send(slaveId: string, method: string, params?: Record<string, unknown>): Promise<unknown>;
    capture(slaveId: string, pattern: RegExp, timeoutMs?: number): Promise<CaptureResult>;
    executeHarnessPlan(slaveId: string, dag: HarnessDAG): Promise<HarnessResult>;
    getPageState(slaveId: string): Promise<PageState>;
    captureScreenshot(slaveId: string, format?: 'png' | 'jpeg'): Promise<string>;
  };

  // ── Trace ───────────────────────────────────────────
  getTrace(slaveId: string, limit?: number): Promise<TraceEntryRow[]>;
  getConversationTrace(conversationId: string): Promise<TraceEntryRow[]>;

  // ── Health ──────────────────────────────────────────
  getHealth(slaveId: string): Promise<SlaveHealth>;
  getAllHealth(): Promise<Map<string, SlaveHealth>>;
}

interface CaptureResult {
  body: string;
  durationMs: number;
  capturedAt: number;
}

interface PageState {
  url: string;
  title: string;
  readyState: string;
}

interface SlaveHealth {
  slaveId: string;
  status: SlaveStatus;
  circuitState: string;
  isAlive: boolean;
  lastHealthCheck: number;
  consecutiveFailures: number;
}

interface FleetConfig {
  chromePath?: string;
  portRange: [number, number];
  healthProbeIntervalMs: number;
  healthProbeTimeoutMs: number;
  autoRestart: boolean;
  maxRestarts: number;
  circuitBreakerThreshold: number;
  circuitBreakerResetMs: number;
}
```

### CDPProxy (Internal Subsystem)

```typescript
class CDPProxy {
  constructor(
    private store: GovernorStore,
    private slaves: Map<string, ChromeSlave>,
    private circuitBreakers: Map<string, CircuitBreaker>,
    private traceLog: TraceLog,
    private eventBus?: CapabilityEventBus,
  ) {}

  async send(
    slaveId: string,
    method: string,
    params?: Record<string, unknown>,
    origin?: TraceOrigin,
  ): Promise<unknown>;

  async capture(
    slaveId: string,
    pattern: RegExp,
    timeoutMs?: number,
    origin?: TraceOrigin,
  ): Promise<CaptureResult>;

  async executeHarnessPlan(
    slaveId: string,
    dag: HarnessDAG,
    origin?: TraceOrigin,
  ): Promise<HarnessResult>;

  async getPageState(slaveId: string): Promise<PageState>;
}

interface TraceOrigin {
  engine: string;
  method: string;
  requestId?: string;
  conversationId?: string;
  providerId?: string;
  accountId?: string;
}
```

### HarnessDAG Format

The DAG is a **plan representation** — it describes what to do. Execution happens in the Node.js/Tauri backend, NOT injected into Chrome. The `executeHarnessPlan()` method iterates the DAG and sends one atomic CDP command per step. This keeps Chrome's event loop free between operations.

```typescript
type HarnessDAG = HarnessNode;

type HarnessNode =
  | { type: 'sequence'; steps: HarnessNode[] }
  | { type: 'branch'; condition: HarnessCondition; then: HarnessNode; else?: HarnessNode }
  | { type: 'parallel'; steps: HarnessNode[] }
  | { type: 'retry'; maxRetries: number; backoffMs: number; step: HarnessNode }
  | { type: 'precondition'; checks: string[]; step: HarnessNode }
  | { type: 'step'; moduleId: string; input: Record<string, unknown>; outputKey: string };

interface HarnessCondition {
  type: 'selector_exists' | 'url_matches' | 'text_contains' | 'variable';
  value: string;
}

interface HarnessResult {
  ok: boolean;
  outputs: Record<string, unknown>;
  progress: HarnessProgressEvent[];
  telemetry: HarnessTelemetryEvent[];
  durationMs: number;
  error?: string;
}

interface HarnessProgressEvent {
  step: number;
  total: number;
  status: 'pending' | 'executing' | 'completed' | 'failed';
  description: string;
  moduleId: string;
}

interface HarnessTelemetryEvent {
  type: 'selector_hit' | 'selector_miss' | 'dom_interaction' | 'network_intercept' | 'error';
  moduleId: string;
  data: Record<string, unknown>;
  ts: number;
}
```

### Concurrency Model

Each `ChromeSlave` has a per-instance `AsyncMutex`. CDP operations on the same slave serialize. Operations on different slaves run in parallel. The Governor manages mutex acquisition internally — callers never see the mutex.

### Integration Example

```typescript
// ConversationManager uses Governor for a send:
const slave = governor.getSlave(slaveId);
if (!slave) throw new SlaveNotRunningError(slaveId);

// Governor handles mutex internally
const sendResult = await governor.cdp.send(slaveId, 'Input.dispatchKeyEvent', {
  type: 'keyDown',
  key: 'Enter',
}, { engine: 'ConversationManager', method: 'send', conversationId });

const captureResult = await governor.cdp.capture(slaveId, /\/api\/conversation\//, 30000, {
  engine: 'ConversationManager', method: 'capture', conversationId,
});
```

### Error Mapping

| Error | When | HTTP |
|-------|------|------|
| `SlaveNotRunningError` | Slave not found or stopped | 503 |
| `SlaveBusyError` | Mutex held by another operation | 409 |
| `CdpTimeoutError` | CDP command timed out | 504 |
| `CircuitOpenError` | Circuit breaker open for this slave | 503 |
| `CdpConnectionError` | CDP WebSocket disconnected | 502 |
| `ChromeNotFoundError` | Chrome binary not found | 500 |
| `PortOccupiedError` | All ports in range occupied | 500 |

---

## Engine 2: ConversationManager

### Purpose

Orchestrates a single conversation send through an 8-step pipeline. Each step is a thin delegation — zero business logic beyond the pipeline orchestration.

### Store Contract

```typescript
interface ConversationStore {
  getConversation(id: string): Promise<ConversationRow | null>;
  createConversation(input: ConversationInput): Promise<ConversationRow>;
  updateConversation(id: string, patch: Partial<ConversationRow>): Promise<void>;
  deleteConversation(id: string): Promise<void>;
  listConversations(opts?: { providerId?: string; limit?: number; offset?: number }): Promise<ConversationRow[]>;

  createMessage(input: MessageInput): Promise<ConversationMessageRow>;
  getMessage(id: string): Promise<ConversationMessageRow | null>;
  getMessages(conversationId: string, opts?: { limit?: number; before?: string }): Promise<ConversationMessageRow[]>;
  getLastMessage(conversationId: string): Promise<ConversationMessageRow | null>;

  // Account access (joined through provider_session for plan_tier resolution)
  getAccount(sessionId: string): Promise<ProviderAccountRow | null>;
}
```

### Public Interface

```typescript
class ConversationManager {
  constructor(
    private governor: ChromeGovernor,
    private resolution: CapabilityResolutionEngine,
    private parser: StreamParserEngine,
    private blocks: StreamBlockStore,
    private store: ConversationStore,
    private eventBus: CapabilityEventBus,
    private memoizer: ExecutionMemoizer,
  ) {}

  async send(conversationId: string, message: string): Promise<SendResult>;
  async createConversation(providerId: string, title?: string): Promise<ConversationRow>;
  async getConversation(id: string): Promise<ConversationRow>;
  async getMessages(conversationId: string, opts?: { limit?: number; before?: string }): Promise<ConversationMessageRow[]>;
  async truncate(conversationId: string, beforeMessageId: string): Promise<void>;
}

interface SendResult {
  ok: boolean;
  messageId: string;
  blocks: ContentBlock[];
  text: string;
  latencyMs: number;
  error?: string;
}
```

### 8-Step Pipeline Execution Flow

```
ConversationManager.send(conversationId, message)
  │
  ├─ [1] RESOLVE (5ms budget)
  │     const conv = await store.getConversation(conversationId);
  │     const account = await store.getAccount(conv.provider_session_id);
  │     const planTier = account.plan_tier;
  │     const capabilities = await memoizer.getOrCompute(
  │       `resolve:${conv.provider_id}:${planTier}`,
  │       () => resolution.resolve(conv.provider_id, planTier),
  │       5000, // TTL 5s
  │     );
  │
  ├─ [2] DERIVE SLAVE (0ms)
  │     const account = await store.getAccount(conv.provider_session_id);
  │     const slaveId = deriveSlaveId(conv.provider_id, account.id);
  │
  ├─ [3] LOCK (async mutex acquire)
  │     // Governor handles internally — callers just await the operation
  │
  ├─ [4] ENSURE (up to 10s)
  │     const slave = await governor.ensureRunning(slaveId);
  │     const pageState = await governor.cdp.getPageState(slaveId);
  │     // if page is not the chat page, navigate
  │
  ├─ [5] SEND (up to 30s)
  │     // Option A: DAG-driven send (harness)
  │     const dag: HarnessDAG = {
  │       type: 'sequence',
  │       steps: [
  │         { type: 'precondition', checks: ['composer_visible'], step: { type: 'step', moduleId: 'composer', input: {}, outputKey: 'composer_state' } },
  │         { type: 'step', moduleId: 'selector', input: { selector: capabilities.composer.selector }, outputKey: 'focus_result' },
  │         { type: 'step', moduleId: 'composer', input: { action: 'type', text: message }, outputKey: 'type_result' },
  │         { type: 'step', moduleId: 'composer', input: { action: 'send' }, outputKey: 'send_result' },
  │       ]
  │     };
  │     const sendResult = await governor.cdp.executeHarnessPlan(slaveId, dag, origin);
  │
  ├─ [6] CAPTURE (up to 30s)
  │     const captureResult = await governor.cdp.capture(
  │       slaveId,
  │       /\/api\/conversation\//,
  │       30000,
  │       origin,
  │     );
  │
  ├─ [7] PARSE (up to 500ms)
  │     const blocks = await parser.parse(captureResult.body, conv.provider_id);
  │     // Update parser confidence
  │
  ├─ [8] STORE + EMIT
  │     const msgRow = await store.createMessage({ conversationId, role: 'assistant', blocks, ... });
  │     await blocks.storeBlocks(conversationId, msgRow.id, blocks);
  │     eventBus.emit({
  │       type: 'conversation:complete',
  │       conversationId,
  │       message: msgRow,
  │     });
  │     return { ok: true, messageId: msgRow.id, blocks, text: extractText(blocks), latencyMs };
  └─
```

### Context Injection

Before each send, the ConversationManager injects context via `context_json` on the conversation:

```typescript
interface ConversationContext {
  provider: {
    id: string;
    slug: string;
    displayName: string;
  };
  account: {
    email: string;
    planTier: string;
    loginState: string;
  };
  chrome: {
    status: string;
    circuitState: string;
  };
  capabilities: {
    total: number;
    available: number;
  };
}
```

---

## Engine 3: StreamParserEngine

### Purpose

Parse raw provider API responses (SSE text, batchexecute JSON, OpenAI-SSE) into typed `ContentBlock[]`. Loads parser modules from `.ts` seed files via dynamic `import()`.

### Store Contract

```typescript
interface ParserStore {
  getParser(providerId: string): Promise<ProviderParserRow | null>;
  getActiveParser(providerId: string): Promise<ProviderParserRow | null>;
  upsertParser(parser: ProviderParserRow): Promise<void>;
  listParsers(providerId: string): Promise<ProviderParserRow[]>;
  getParserByFile(filePath: string): Promise<ProviderParserRow | null>;
}
```

### Parser Module Contract

```typescript
// seeds/parsers/claude/001_streaming_sse.ts
interface ParserModule {
  name: string;
  version: number;
  providerId: string;
  parse(rawBody: string): ContentBlock[];
  detectCompletion(rawBody: string): boolean;
  getConfidence(rawBody: string): number;
}

type ContentBlock =
  | { kind: 'text'; content: string; index: number }
  | { kind: 'thinking'; content: string; index: number }
  | { kind: 'code'; content: string; language?: string; index: number }
  | { kind: 'artifact'; content: string; artifactType?: string; index: number }
  | { kind: 'image'; url: string; alt?: string; index: number }
  | { kind: 'citation'; content: string; source?: string; index: number }
  | { kind: 'tool_use'; toolName: string; input: Record<string, unknown>; index: number }
  | { kind: 'error'; message: string; code?: string; index: number }
  | { kind: 'meta'; key: string; value: unknown; index: number };
```

### Public Interface

```typescript
class StreamParserEngine {
  constructor(
    private store: ParserStore,
    private config?: ParserConfig,
  ) {}

  async parse(rawBody: string, providerId: string): Promise<ParseResult>;
  async detectCompletion(rawBody: string, providerId: string): Promise<boolean>;
  async reloadParser(providerId: string): Promise<void>;
  async preloadAll(): Promise<void>;

  private async loadParser(providerId: string): Promise<ParserModule>;
  private parserCache: Map<string, { module: ParserModule; hash: string }>;
}

interface ParseResult {
  blocks: ContentBlock[];
  confidence: number;
  parserName: string;
  parserVersion: number;
  durationMs: number;
}

interface ParserConfig {
  fallbackTimeoutMs: number;
  maxRetries: number;
  confidenceMinThreshold: number;
}
```

### Execution Flow

```
parse(rawBody, providerId)
  │
  ├─ [1] Look up active parser for provider_id
  │     └─ If none → use system/001_fallback.ts
  │
  ├─ [2] Check parser file hash vs cached
  │     ├─ If mismatched → reload via import()
  │     └─ If cached → use cached
  │
  ├─ [3] Call parser.parse(rawBody) → ContentBlock[]
  │     └─ If throws → try fallback parser (if configured)
  │     └─ If fallback also throws → return single error block
  │
  ├─ [4] Compute confidence from parser.getConfidence(rawBody)
  │
  └─ [5] Return ParseResult
```

### Fallback Chain

```
Claude:  seeds/parsers/claude/001_streaming_sse.ts
                              ↓ (on failure)
         seeds/parsers/generic/001_sse_frames.ts
                              ↓ (on failure)
         seeds/parsers/system/001_fallback.ts  ← always succeeds
```

---

## Engine 4: CapabilityEngine

### Purpose

Execute capabilities by sending CDP commands through the Governor. Handles login detection, message sending, and model selection. All CDP access is through `governor.cdp`.

### Store Contract

```typescript
interface CapabilityStore {
  getCapability(id: string): Promise<CapabilityTaxonomyRow | null>;
  getCapabilityBySlug(slug: string): Promise<CapabilityTaxonomyRow | null>;
  getBinding(capabilityId: string, providerId: string): Promise<CapabilityBindingRow | null>;
  getProgram(bindingId: string): Promise<CapabilityProgramRow | null>;
  getPrograms(bindingId: string): Promise<CapabilityProgramRow[]>;
  getSelectors(capabilityId: string, providerId: string): Promise<SelectorStrategyRow[]>;
  createOutcome(outcome: OutcomeInput): Promise<OutcomeRow>;
  updateBindingHealth(bindingId: string, patch: Partial<CapabilityBindingRow>): Promise<void>;
  updateSelectorHealth(selectorId: string, hit: boolean): Promise<void>;
}
```

### Public Interface

```typescript
class CapabilityEngine {
  constructor(
    private governor: ChromeGovernor,
    private store: CapabilityStore,
    private eventBus?: CapabilityEventBus,
  ) {}

  async execute(
    capabilitySlug: string,
    providerId: string,
    accountId: string,
    input?: Record<string, unknown>,
  ): Promise<CapabilityExecutionResult>;

  async detectLogin(providerId: string, accountId: string): Promise<LoginDetectionResult>;
  async sendMessage(providerId: string, accountId: string, message: string): Promise<SendResult>;
}

interface CapabilityExecutionResult {
  ok: boolean;
  capabilityId: string;
  output?: Record<string, unknown>;
  traceId: string;
  latencyMs: number;
  error?: string;
  recoveryAttempted?: boolean;
  recoveryStrategies?: RecoveryStrategyResult[];
}

interface LoginDetectionResult {
  isLoggedIn: boolean;
  confidence: number;
  pageUrl?: string;
  indicators: LoginIndicator[];
}

interface LoginIndicator {
  type: 'selector_found' | 'url_match' | 'cookie_exists' | 'text_match';
  value: string;
  matched: boolean;
}

interface RecoveryStrategyResult {
  strategy: string;
  index: number;
  ok: boolean;
  error?: string;
}

type RecoveryStrategy = {
  type: 'retry_selector' | 'retry_with_fallback' | 'navigate_home' | 'restart_chrome' | 'mark_broken';
  config?: Record<string, unknown>;
};
```

---

## Engine 5: ProviderRegistrar

### Purpose

Read provider JSON manifests from `seeds/providers/` and write them to the database. Handles atomic multi-table inserts. Can reload all providers or a single provider.

### Store Contract

```typescript
interface ProviderStore {
  upsertDefinition(def: ProviderDefinitionRow): Promise<void>;
  upsertEndpoint(endpoint: ProviderEndpointRow): Promise<void>;
  upsertParser(parser: ProviderParserRow): Promise<void>;
  upsertCapability(cap: ProviderCapabilityRow): Promise<void>;
  upsertConfig(config: ProviderConfigRow): Promise<void>;
  upsertModel(model: ProviderModelRow): Promise<void>;
  deleteProviderEndpoints(providerId: string): Promise<void>;
  deleteProviderParsers(providerId: string): Promise<void>;
  deleteProviderCapabilities(providerId: string): Promise<void>;
  deleteProviderConfigs(providerId: string): Promise<void>;
  deleteProviderModels(providerId: string): Promise<void>;

  getDefinition(id: string): Promise<ProviderDefinitionRow | null>;
  getDefinitionBySlug(slug: string): Promise<ProviderDefinitionRow | null>;
  listDefinitions(opts?: { isActive?: boolean }): Promise<ProviderDefinitionRow[]>;
}
```

### Public Interface

```typescript
class ProviderRegistrar {
  constructor(
    private store: ProviderStore,
    private auditor?: RegistrationAuditor,
    private eventBus?: CapabilityEventBus,
  ) {}

  async register(manifest: ProviderManifest): Promise<RegisterResult>;
  async seedAll(): Promise<SeedAllResult>;
  async seedProvider(providerSlug: string): Promise<RegisterResult>;
  async verifySeeds(): Promise<VerifyResult>;
  async reloadFromSeeds(): Promise<SeedAllResult>;
}

interface RegisterResult {
  providerId: string;
  slug: string;
  status: 'created' | 'updated' | 'unchanged';
  tablesAffected: string[];
  rowsAdded: number;
  rowsModified: number;
}

interface SeedAllResult {
  seeded: RegisterResult[];
  skipped: string[];
  errors: Array<{ file: string; error: string }>;
}

interface VerifyResult {
  valid: boolean;
  providers: Array<{
    slug: string;
    status: 'ok' | 'missing_file' | 'parse_error' | 'schema_mismatch';
    details: string;
  }>;
}
```

### Seed Flow

```
seedAll()
  │
  ├─ [1] Scan seeds/providers/*.json
  │
  ├─ [2] For each manifest file:
  │   ├─ Parse JSON → ProviderManifest
  │   ├─ Validate against Zod schema
  │   ├─ Begin transaction
  │   ├─ register(manifest)
  │   │   ├─ Upsert provider_definition
  │   │   ├─ Delete old endpoints → Upsert new endpoints
  │   │   ├─ Delete old parsers → Upsert new parsers
  │   │   ├─ Delete old capabilities → Upsert new capabilities
  │   │   ├─ Delete old configs → Upsert new configs
  │   │   ├─ Delete old models → Upsert new models
  │   │   └─ Emit provider:seeded event
  │   ├─ Commit transaction
  │   └─ If auditor configured → auditor.registerAndAudit(manifest)
  │
  └─ [3] Return SeedAllResult
```

---

## Engine 6: CapabilityResolutionEngine

### Purpose

Resolve capability UI contracts for a given provider and plan tier. Applies the 3-layer override chain: global defaults → plan tier overrides → provider overrides. Filters by existential rules, plan tier gating, and dependency satisfaction. Groups by `ui_position`, sorts within groups by `ui_group` then `ui_order`.

### Store Contract

```typescript
interface CapabilityResolutionStore {
  resolveCapabilities(providerId: string, planTier: string): Promise<RawResolutionRow[]>;
  getActiveBindings(providerId: string): Promise<string[]>;
  searchCapabilities(providerId: string, planTier: string, query: string): Promise<RawResolutionRow[]>;
}

interface RawResolutionRow {
  // All capability_taxonomy columns
  id: string; slug: string; name: string; category: string;
  ui_component: string; ui_label: string; ui_icon: string;
  ui_position: string; ui_order: number; ui_group: string;
  ui_layer_depth: number; parent_capability_id: string;
  ui_priority: string; interaction_mode: string;
  ui_states_json: string; ui_visibility_rule: string;
  existential_rule: string; ui_input_schema: string;
  mutation_effects_json: string;
  recovery_behavior: string; state_persistence: string;
  data_flow: string; min_plan_tier: string;
  depends_on_json: string;
  // New: vCode pattern columns
  concurrency_safe: number; op_classification: string;
  requires_user_confirmation: number;
  max_result_size: number;
  result_component: string; result_layout: string;
  search_hints_json: string; aliases_json: string;
  availability_json: string; prefetch: number;
  // Override source tracking
  component_from: string; label_from: string; icon_from: string;
  position_from: string; order_from: string; group_from: string;
  priority_from: string; interaction_from: string;
  states_from: string; visibility_from: string;
  existential_from: string; input_schema_from: string;
  mutation_from: string; recovery_from: string;
  persistence_from: string; data_flow_from: string;
  plan_tier_from: string; depends_from: string;
  // Joined columns
  binding_status: string; binding_confidence: number;
  tier_max_models: number; tier_max_file_size: number;
  tier_max_options: number; tier_config_json: string;
}
```

### Public Interface

```typescript
type PlanTier = 'free' | 'pro' | 'max' | 'enterprise';

class CapabilityResolutionEngine {
  constructor(private store: CapabilityResolutionStore) {}

  async resolve(
    providerId: string,
    planTier: PlanTier,
    opts?: CapabilityResolutionOptions,
  ): Promise<ResolvedCapabilities>;

  async search(
    providerId: string,
    planTier: PlanTier,
    query: string,
  ): Promise<ResolvedCapabilities>;
}

interface CapabilityResolutionOptions {
  activeBindings?: string[];
  conversationContext?: ConversationContext;
}

interface ResolvedCapabilities {
  composer: ResolvedCapability[];
  header: ResolvedCapability[];
  message: ResolvedCapability[];
  sidebar: ResolvedCapability[];
  inline: ResolvedCapability[];
  total: number;
  resolvedAt: number;
}

interface ResolvedCapability {
  id: string;
  slug: string;
  name: string;
  category: string;
  description?: string;
  // UI contract
  uiComponent: string;
  uiLabel: string;
  uiIcon: string;
  uiPosition: string;
  uiOrder: number;
  uiGroup: string;
  uiLayerDepth: number;
  parentCapabilityId: string | null;
  uiPriority: string;
  interactionMode: string;
  uiStates: string[];
  uiVisibilityRule: string | null;
  existentialRule: string | null;
  uiInputSchema: Record<string, unknown>;
  mutationEffects: Record<string, unknown>;
  recoveryBehavior: string;
  statePersistence: string;
  dataFlow: string;
  minPlanTier: PlanTier;
  dependsOn: string[];
  // NEW: vCode pattern
  concurrencySafe: boolean;
  opClassification: string | null;
  requiresUserConfirmation: boolean;
  maxResultSize: number;
  resultComponent: string;
  resultLayout: string;
  searchHints: string[];
  aliases: string[];
  availability: AvailabilityGating;
  prefetch: boolean;
  // Override sources
  overrideSources: Record<string, 'global' | 'tier' | 'provider'>;
  // Binding context
  bindingStatus: string;
  bindingConfidence: number;
  // Plan tier overrides
  tierOverrides: {
    maxModels?: number;
    maxFileSize?: number;
    maxOptions?: number;
    customConfig?: Record<string, unknown>;
  };
}

interface AvailabilityGating {
  requiresLogin?: boolean;
  requiresChrome?: boolean;
  requiresProvider?: string;
  requiresModel?: string;
}
```

### Resolution SQL (Complete — used by `CapabilityResolutionStore` impl)

```sql
SELECT
  ct.*,
  COALESCE(pc.ui_component_override, ctr.ui_component_override, ct.ui_component) AS ui_component,
  CASE
    WHEN pc.ui_component_override IS NOT NULL THEN 'provider'
    WHEN ctr.ui_component_override IS NOT NULL THEN 'tier'
    ELSE 'global'
  END AS component_from,
  COALESCE(pc.ui_label_override, ctr.ui_label_override, ct.ui_label, ct.name) AS ui_label,
  CASE
    WHEN pc.ui_label_override IS NOT NULL THEN 'provider'
    WHEN ctr.ui_label_override IS NOT NULL THEN 'tier'
    ELSE 'global'
  END AS label_from,
  COALESCE(pc.ui_icon_override, ctr.ui_icon_override, ct.ui_icon) AS ui_icon,
  CASE
    WHEN pc.ui_icon_override IS NOT NULL THEN 'provider'
    WHEN ctr.ui_icon_override IS NOT NULL THEN 'tier'
    ELSE 'global'
  END AS icon_from,
  COALESCE(pc.ui_position_override, ct.ui_position) AS ui_position,
  CASE WHEN pc.ui_position_override IS NOT NULL THEN 'provider' ELSE 'global' END AS position_from,
  COALESCE(pc.ui_order_override, ct.ui_order) AS ui_order,
  CASE WHEN pc.ui_order_override IS NOT NULL THEN 'provider' ELSE 'global' END AS order_from,
  COALESCE(pc.ui_group_override, ct.ui_group) AS ui_group,
  CASE WHEN pc.ui_group_override IS NOT NULL THEN 'provider' ELSE 'global' END AS group_from,
  COALESCE(pc.ui_priority_override, ct.ui_priority) AS ui_priority,
  CASE WHEN pc.ui_priority_override IS NOT NULL THEN 'provider' ELSE 'global' END AS priority_from,
  COALESCE(pc.interaction_mode_override, ct.interaction_mode) AS interaction_mode,
  CASE WHEN pc.interaction_mode_override IS NOT NULL THEN 'provider' ELSE 'global' END AS interaction_from,
  COALESCE(pc.ui_states_override_json, ctr.ui_states_override_json, ct.ui_states_json) AS ui_states_json,
  CASE
    WHEN pc.ui_states_override_json IS NOT NULL THEN 'provider'
    WHEN ctr.ui_states_override_json IS NOT NULL THEN 'tier'
    ELSE 'global'
  END AS states_from,
  COALESCE(pc.ui_visibility_rule_override, ct.ui_visibility_rule) AS ui_visibility_rule,
  CASE WHEN pc.ui_visibility_rule_override IS NOT NULL THEN 'provider' ELSE 'global' END AS visibility_from,
  COALESCE(pc.existential_rule_override, ct.existential_rule) AS existential_rule,
  CASE WHEN pc.existential_rule_override IS NOT NULL THEN 'provider' ELSE 'global' END AS existential_from,
  COALESCE(pc.ui_input_schema_override, ct.ui_input_schema) AS ui_input_schema,
  CASE WHEN pc.ui_input_schema_override IS NOT NULL THEN 'provider' ELSE 'global' END AS input_schema_from,
  COALESCE(pc.mutation_effects_override_json, ct.mutation_effects_json) AS mutation_effects_json,
  CASE WHEN pc.mutation_effects_override_json IS NOT NULL THEN 'provider' ELSE 'global' END AS mutation_from,
  COALESCE(pc.recovery_behavior_override, ct.recovery_behavior) AS recovery_behavior,
  CASE WHEN pc.recovery_behavior_override IS NOT NULL THEN 'provider' ELSE 'global' END AS recovery_from,
  COALESCE(pc.state_persistence_override, ct.state_persistence) AS state_persistence,
  CASE WHEN pc.state_persistence_override IS NOT NULL THEN 'provider' ELSE 'global' END AS persistence_from,
  COALESCE(pc.data_flow_override, ct.data_flow) AS data_flow,
  CASE WHEN pc.data_flow_override IS NOT NULL THEN 'provider' ELSE 'global' END AS data_flow_from,
  COALESCE(pc.min_plan_tier_override, ct.min_plan_tier) AS min_plan_tier,
  CASE WHEN pc.min_plan_tier_override IS NOT NULL THEN 'provider' ELSE 'global' END AS plan_tier_from,
  COALESCE(pc.depends_on_override_json, ct.depends_on_json) AS depends_on_json,
  CASE WHEN pc.depends_on_override_json IS NOT NULL THEN 'provider' ELSE 'global' END AS depends_from,
  ctr.max_models AS tier_max_models,
  ctr.max_file_size AS tier_max_file_size,
  ctr.max_options AS tier_max_options,
  ctr.custom_config_json AS tier_config_json,
  cb.status AS binding_status,
  cb.confidence AS binding_confidence
FROM capability_taxonomy ct
JOIN capability_binding cb ON cb.global_id = ct.id
  AND cb.provider_id = ?
  AND cb.status IN ('stable','test-2','flaky')
LEFT JOIN capability_tier ctr ON ctr.capability_id = ct.id AND ctr.plan_tier = ?
LEFT JOIN provider_capability pc ON pc.global_capability_id = ct.id AND pc.provider_id = ?
ORDER BY ct.ui_position, ct.ui_group, ct.ui_order;
```

### Filtering Logic (applied after SQL by the engine)

After the SQL returns rows, the engine applies:
1. **Plan tier gating** — exclude capabilities where `min_plan_tier` exceeds the account's plan tier
2. **Existential rule evaluation** — exclude capabilities where `existential_rule` is not satisfied by current conversation context
3. **Dependency satisfaction** — exclude capabilities whose `depends_on` capabilities have no active binding for the provider
4. **Search filtering** — if `query` is provided, match against `search_hints_json` and `name`

---

## Engine 7: CapabilityEventBus

### Purpose

Typed in-process pub/sub for all inter-engine and engine-to-frontend communication. Transient events — no DB persistence. Singleton per process.

### Full Interface

```typescript
// src/engines/capability-event-bus.ts

type CapabilityEvent =
  // v1 — Core capability events
  | { type: 'capability:executed'; capabilityId: string; providerId: string; traceId: string; ok: boolean; latencyMs: number }
  | { type: 'capability:failed'; capabilityId: string; providerId: string; traceId: string; error: string; recoveryBehavior: string }
  | { type: 'capability:confidence_changed'; capabilityId: string; providerId: string; from: number; to: number }
  | { type: 'capability:selector_drifted'; capabilityId: string; providerId: string; selector: string; missCount: number }
  | { type: 'capability:status_changed'; capabilityId: string; providerId: string; from: string; to: string }
  | { type: 'capability:progress'; step: number; total: number; description: string; moduleId: string; slaveId: string }
  // v1 — Account lifecycle
  | { type: 'account:login_state'; accountId: string; providerId: string; from: string; to: string }
  | { type: 'account:plan_tier_changed'; accountId: string; providerId: string; from: string; to: string }
  | { type: 'account:created'; accountId: string; providerId: string; email: string }
  | { type: 'account:removed'; accountId: string; providerId: string }
  // v1 — Fleet lifecycle
  | { type: 'fleet:slave_status'; slaveId: string; providerId: string; status: SlaveStatus; superState: SuperState }
  | { type: 'fleet:crash_detected'; slaveId: string; providerId: string; consecutiveFailures: number }
  | { type: 'fleet:circuit_changed'; slaveId: string; providerId: string; from: string; to: string }
  // v1 — Conversation lifecycle
  | { type: 'conversation:complete'; conversationId: string; message: ConversationMessageRow }
  | { type: 'conversation:error'; conversationId: string; error: string }
  | { type: 'conversation:created'; conversationId: string; providerId: string; accountId: string }
  // v1 — Provider lifecycle
  | { type: 'provider:seeded'; providerId: string; capabilities: number }
  | { type: 'provider:health_changed'; providerId: string; from: string; to: string; score: number }
  // v1 — Config lifecycle
  | { type: 'config:changed'; engineId: string; actor: string }
  // v1 — Telemetry lifecycle
  | { type: 'telemetry:cycle_complete'; scheduleName: string; rowsWritten: number; durationMs: number }
  // SOTA-01 — MirrorEngine events
  | { type: 'mirror:state'; conversationId: string; state: Record<string, unknown>; syncVersion: number }
  | { type: 'mirror:observation'; slaveId: string; event: Record<string, unknown> }
  | { type: 'mirror:optimistic_update'; conversationId: string; updateId: string; status: 'confirmed' | 'reverted'; revertReason?: string }
  | { type: 'mirror:latency'; conversationId: string; stage: string; durationMs: number; budgetMs: number; exceeded: boolean }
  | { type: 'mirror:snapshot'; conversationId: string; snapshotId: string; trigger: string }
  // SOTA-01 + SOTA-07 — Progressive streaming events
  | { type: 'conversation:block'; conversationId: string; messageId: string; block: ContentBlock; blockIndex: number }
  | { type: 'conversation:stream_start'; conversationId: string; messageId: string; providerId: string; model?: string }
  | { type: 'conversation:stream_end'; conversationId: string; messageId: string; totalBlocks: number; latencyMs: number }
  // SOTA-04 — Workflow events
  | { type: 'workflow:started'; executionId: string; workflowId: string; triggerType: string }
  | { type: 'workflow:node_started'; executionId: string; nodeId: string; nodeName: string }
  | { type: 'workflow:node_completed'; executionId: string; nodeId: string; nodeName: string; output?: Record<string, unknown> }
  | { type: 'workflow:node_failed'; executionId: string; nodeId: string; nodeName: string; error: string }
  | { type: 'workflow:human_loop_pending'; executionId: string; nodeExecutionId: string; prompt: string }
  | { type: 'workflow:completed'; executionId: string; workflowId: string; output?: Record<string, unknown> }
  | { type: 'workflow:failed'; executionId: string; workflowId: string; error: string }
  | { type: 'workflow:progress'; executionId: string; completed: number; total: number }
  // SOTA-05 — Semantic grounding + selector healing events
  | { type: 'capability:selector_healed'; capabilityId: string; providerId: string; selectorId: string; method: string; confidence: number }
  | { type: 'capability:selector_broken'; capabilityId: string; providerId: string; reason: string; failedSelector?: string }
  // SOTA-09 — Harness Protocol Engine events
  | { type: 'hpe:augmented'; conversationId?: string; workflowExecutionId?: string; schemaId: string }
  | { type: 'hpe:extracted'; sessionId: string; strategy: string; actionCount: number; confidence: number }
  | { type: 'hpe:action_validated'; sessionId: string; actionIndex: number; actionType: string }
  | { type: 'hpe:action_rejected'; sessionId: string; actionIndex: number; reason: string }
  | { type: 'hpe:action_executed'; sessionId: string; actionIndex: number; ok: boolean; latencyMs: number }
  | { type: 'hpe:action_failed'; sessionId: string; actionIndex: number; error: string };

type EventHandler<T extends CapabilityEvent = CapabilityEvent> = (event: T) => void;

class CapabilityEventBus {
  private static instance: CapabilityEventBus | null = null;
  private handlers: Map<string, Set<EventHandler>> = new Map();
  private onceHandlers: Map<string, Set<EventHandler>> = new Map();
  private wsSubscriptions: Map<WebSocket, Map<string, Set<string>>> = new Map();

  static getInstance(): CapabilityEventBus {
    if (!CapabilityEventBus.instance) {
      CapabilityEventBus.instance = new CapabilityEventBus();
    }
    return CapabilityEventBus.instance;
  }

  emit<T extends CapabilityEvent>(event: T): void;

  on<T extends CapabilityEvent>(type: string, handler: EventHandler<T>): () => void;

  once<T extends CapabilityEvent>(type: string, handler: EventHandler<T>): () => void;

  subscribe(ws: WebSocket, entityType: string, entityId: string): void;

  unsubscribe(ws: WebSocket, entityType: string, entityId: string): void;

  unsubscribeAll(ws: WebSocket): void;

  removeAllListeners(type?: string): void;
}
```

### Publisher / Subscriber Table

| Publisher | Events Published |
|-----------|-----------------|
| `ChromeGovernor.CDPProxy` | `capability:executed`, `capability:failed`, `capability:progress`, `capability:selector_drifted` |
| `ChromeGovernor.HealthMonitor` | `fleet:slave_status`, `fleet:crash_detected`, `fleet:circuit_changed` |
| `ChromeGovernor.LifecycleManager` | `fleet:slave_status`, `account:created`, `account:removed`, `account:login_state`, `account:plan_tier_changed` |
| `ConversationManager` | `conversation:complete`, `conversation:error`, `conversation:block`, `conversation:stream_start`, `conversation:stream_end` |
| `ConversationStore` | `conversation:created` |
| `StreamParserEngine` | `capability:confidence_changed` |
| `CapabilityEngine` | `capability:selector_drifted` (detects selector misses during execution, emits when missCount > threshold) |
| `ProviderRegistrar` | `provider:seeded`, `capability:status_changed` |
| `ProviderHealthKernel` | `provider:health_changed` |
| `ConfigManager` | `config:changed` |
| `TelemetryAggregator` | `telemetry:cycle_complete` |
| `MirrorEngine` (SOTA-01) | `mirror:state`, `mirror:optimistic_update`, `mirror:latency`, `mirror:snapshot` |
| `ObservationTap` (SOTA-01) | `mirror:observation` |
| `WorkflowEngine` (SOTA-04) | `workflow:started`, `workflow:node_started`, `workflow:node_completed`, `workflow:node_failed`, `workflow:human_loop_pending`, `workflow:completed`, `workflow:failed`, `workflow:progress` |
| `SelectorHealer` (SOTA-05) | `capability:selector_healed`, `capability:selector_broken` |
| `HarnessProtocolEngine` (SOTA-09) | `hpe:augmented`, `hpe:extracted`, `hpe:action_validated`, `hpe:action_rejected`, `hpe:action_executed`, `hpe:action_failed` |

---

## Engine 8: ProviderHealthKernel

### Purpose

Compute a weighted health score from 6 signal sources on a 30-second schedule. Subscribe to CapabilityEventBus for real-time updates between scheduled runs.

### Store Contract

```typescript
interface HealthStore {
  getCircuitStates(providerId: string): Promise<CircuitBreakerStateRow[]>;
  getRecentDrifts(providerId: string, windowMs: number): Promise<DriftEvent[]>;
  upsertProviderHealth(report: ProviderHealthReport): Promise<void>;
  getProviderHealth(providerId: string): Promise<ProviderHealthReport | null>;
  getHealthHistory(providerId: string, limit?: number): Promise<HealthHistoryRow[]>;
  getActiveProviders(): Promise<string[]>;
}
```

### Public Interface

```typescript
interface ProviderHealthReport {
  providerId: string;
  overallStatus: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
  overallScore: number;
  thresholds: { healthy: 80; degraded: 50; unhealthy: 0 };
  signals: {
    parsers: { active: number; degraded: number; minConfidence: number; score: number };
    capabilities: { active: number; degraded: number; broken: number; score: number };
    fleet: { running: number; stopped: number; error: number; circuitOpen: number; score: number };
    circuitBreakers: { open: number; halfOpen: number; closed: number; score: number };
    drifts: { recent: number; unresolved: number; score: number };
  };
  updatedAt: number;
}

class ProviderHealthKernel {
  private timerHandle: ReturnType<typeof setInterval> | null = null;
  private debounceTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();

  constructor(
    private store: HealthStore,
    private governor: ChromeGovernor,
    private eventBus: CapabilityEventBus,
  ) {}

  start(intervalMs?: number): void;
  stop(): void;
  async aggregate(providerId?: string): Promise<ProviderHealthReport[]>;
  getHealth(providerId: string): ProviderHealthReport | null;
  getAllHealth(): ProviderHealthReport[];
}
```

### Weighted Scoring Model

```
Signal                    Weight   Source
Parser confidence         30%      provider_capability.confidence
Parser empty streams 1h   20%      parser_health table (1h window)
Selector hit rate         20%      provider_capability.selector_hit_count/(hit+miss)
Chrome liveness           15%      Governor.getHealth() aggregated
Circuit breaker state     10%      circuit_breaker_state table
Drift events (recent)      5%      drift_event table (24h window)
```

---

## Engine 9: StreamBlockStore

### Purpose

Thin persistence engine for ContentBlock[]. Batched INSERT. Paginated retrieval. Filtering by block kind.

### Public Interface

```typescript
class StreamBlockStore {
  constructor(private db: CapStoreDb) {}

  async storeBlocks(
    conversationId: string,
    messageId: string,
    blocks: ContentBlock[],
  ): Promise<void>;

  async getBlocksByConversation(
    conversationId: string,
    opts?: {
      messageId?: string;
      blockKind?: string;
      limit?: number;
      offset?: number;
    },
  ): Promise<StreamBlockRow[]>;

  async getBlocksByMessage(messageId: string): Promise<StreamBlockRow[]>;
}
```

### Storage SQL

```sql
-- Batched INSERT (all blocks in one statement)
INSERT OR IGNORE INTO stream_block
  (id, conversation_id, message_id, block_index, block_kind, block_data, block_meta, created_at)
VALUES
  (?, ?, ?, 0, 'text', ?, '{}', ?),
  (?, ?, ?, 1, 'code', ?, '{}', ?),
  -- ... one row per block

-- Paginated retrieval
SELECT * FROM stream_block
WHERE conversation_id = ?
  AND (? IS NULL OR message_id = ?)
  AND (? IS NULL OR block_kind = ?)
ORDER BY message_id, block_index
LIMIT ? OFFSET ?;

-- Message retrieval
SELECT * FROM stream_block
WHERE message_id = ?
ORDER BY block_index;
```

---

## Engine Dependency Graph

```
                    ┌──────────────────────────┐
                    │     StreamBlockStore     │
                    │     (DB only)            │
                    └──────────────────────────┘
                               ▲
                               │ writes blocks
                               │
┌──────────────┐    ┌──────────────────────────┐    ┌──────────────┐
│  Provider    │───►│   ConversationManager     │───►│ Capability-  │
│  Registrar   │    │                          │    │  EventBus    │
└──────────────┘    │  depends on:             │    └──────┬───────┘
                    │  • Governor              │         │
┌──────────────┐    │  • ResolutionEngine      │    ┌────┴──────────┐
│  Stream-     │◄───│  • ParserEngine          │    │ WebSocket     │
│  ParserEngine│    │  • BlockStore            │    │ Bridge        │
└──────────────┘    │  • EventBus              │    └───────────────┘
                    └──────────┬───────────────┘
                               │
         ┌─────────────────────┼─────────────────────┐
         │                     │                     │
         ▼                     ▼                     ▼
┌─────────────────┐  ┌─────────────────┐  ┌──────────────────┐
│  ChromeGovernor │  │ Capability-     │  │ ProviderHealth-  │
│  (I/O authority)│  │ ResolutionEngine│  │ Kernel            │
│                 │  │ (read-only SQL) │  │                  │
│  4 subsystems:  │  │                 │  │  subscribes to:  │
│  • Lifecycle    │  │  depends on:    │  │  • confidence    │
│  • CDPProxy     │  │  • DB only      │  │  • fleet:status  │
│  • TraceLog     │  │                 │  │  • selector_drift│
│  • HealthMonitor│  └─────────────────┘  └──────────────────┘
└────────┬────────┘
         │
         │ depends on (but does not import, receives via constructor)
         ▼
┌─────────────────┐
│  Capability-    │
│  Engine         │
│  (execution)    │
└─────────────────┘
```

---

## See also

- `05-merged-lifecycles.md` — RegistrationAuditor, VersionManager, TelemetryAggregator, ExecutionMemoizer
- `06-merged-seeds.md` — Provider manifests, parser modules, harness modules
