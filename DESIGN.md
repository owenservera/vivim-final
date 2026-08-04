# vivim-final — System Design Reference

> Generated from source code. Reflects the actual implementation, not aspirational goals.

---

## 1. Overview

**vivim-final** (`cap-store v1`) is a local-first AI conversation platform. It acts as a
browser-automation layer on top of every major web-based LLM provider (ChatGPT, Claude, Gemini,
DeepSeek, Qwen, Grok) and exposes all interactions as a unified capability system accessible from a
CLI, a Next.js frontend, a REST API, an MCP server, and a visual workflow engine.

- **Runtime:** Bun (`^1.x`)
- **Language:** TypeScript (strict, ESNext, `.js` imports)
- **ORM:** Prisma v6.5 — SQLite, WAL mode
- **Server port:** `9420` (default); stored in `.runtime/backend.port` for dynamic fallback
- **Frontend port:** Next.js dev server, separate process
- **IDs:** ULID (`src/ids.ts`)
- **Validation:** Zod v3
- **Logging:** Pino with optional OTLP/HTTP forwarding (`src/engines/otel-sink.ts`)
- **Linting:** Biome; **Git hooks:** Lefthook

---

## 2. Repository Layout

```
vivim-final/
├── src/                    # Backend (Bun + TypeScript)
│   ├── engines/            # All domain engines (~141 files, 24 subdirs)
│   ├── server/             # Bun.serve HTTP/WebSocket server + 35 routers
│   ├── storage/            # DB layer: contracts/, impl/, cozo/, db.ts
│   ├── executor/           # Chrome fleet primitives (CDP, launcher, profiles)
│   ├── cli/                # CLI thin-client → /api/interpret
│   ├── reprogrammability/  # ReprogrammableSurface contract + registry
│   ├── mcp/                # MCP server adapter (discovery + NLCL tools)
│   ├── config.ts           # All env/runtime config. Port handshake here.
│   ├── errors.ts           # Custom typed error hierarchy
│   └── ids.ts              # newId() — ULID generator
├── frontend/               # Next.js App Router frontend
│   └── src/
│       ├── app/            # Pages, API routes
│       ├── components/     # React components
│       ├── engines/        # Frontend engines (canvas, workspace, plugin, RBAC)
│       ├── ui/             # Slot system (slots.ts, registry.ts, context.tsx)
│       ├── sdk/            # Frontend SDK
│       └── storage/        # Storage contracts + in-memory impls
├── prisma/                 # schema.prisma (~128 KB) + migrations + seed.ts
├── seeds/                  # DB seed data: providers/, parsers/, harness/
│   └── providers/          # Per-provider manifests (JSON + TS)
│       └── parsers/harvested/ # Seeded parser logic_code strings
├── devops/                 # Operational tooling: onboarding, LLM testing
├── scripts/                # dev.ts, stop.ts, openapi-gen.ts, taxonomy-gen/
├── tests/                  # unit/, integration/, e2e/
└── src-tauri/              # Desktop build (sidecar binary via UPX)
```

---

## 3. Architecture Layers

```
┌─────────────────────────────────────────────────────────────────┐
│  Surfaces: CLI · REST API · Next.js UI · MCP · Workflow         │
├─────────────────────────────────────────────────────────────────┤
│  NLCL (Natural Language Command Layer)                          │
│    NLCLEngine → IntentResolver → IntentRouter → Executor        │
├─────────────────────────────────────────────────────────────────┤
│  UnifiedCapabilityRegistry                                      │
│    Every operation is a UnifiedCapability. One definition,      │
│    auto-exported to all surfaces. POST /api/interpret routes    │
│    all NL input here via POST /api/capabilities/:id/execute.    │
├─────────────────────────────────────────────────────────────────┤
│  Core Engines (session, memory, knowledge, context, workflow)   │
├─────────────────────────────────────────────────────────────────┤
│  Chrome Layer (ChromeGovernor — sole CDP authority)             │
│    FleetSupervisor · ProfileAllocator · CDPTransport            │
├─────────────────────────────────────────────────────────────────┤
│  Storage Layer                                                  │
│    Prisma (SQLite WAL) · CozoDB (graph) · Store Contracts       │
└─────────────────────────────────────────────────────────────────┘
```

---

## 4. Engine Catalogue

Every engine in `src/engines/` is an autonomous class depending only on
**store contracts** from `src/storage/contracts/` — never on concrete Prisma impl.

### 4.1 Provider Knowledge Graph

| Engine | File | Role |
|---|---|---|
| `ProviderRegistrar` | `provider-registrar.ts` | Seeds provider manifests from `seeds/providers/` into the DB. Atomic multi-table insert. Wires `fallbackParserId` chain (2-pass). |
| `RegistrationAuditor` | `registration-auditor.ts` | Audits manifest changes, detects drift between seeds and DB, emits `manifest:drift` events. Strategies: `on_change`/`on_write`/`manual`. |
| `ProviderHealthKernel` | `provider-health.ts` | Aggregates 6 weighted signals into a health score (0–100) and status (`healthy`/`degraded`/`unhealthy`/`unknown`). Emits `provider:health_changed` on transitions. |

**Health signal weights (from source):**
- Parser confidence: 30%
- Parser empty-stream rate (1 h): 20%
- Selector hit rate: 20%
- Chrome liveness: 15%
- Circuit-breaker state: 10%
- Drift events (24 h): 5%

**Status thresholds:** ≥80 healthy · ≥50 degraded · <50 unhealthy · no data → unknown.

### 4.2 Capability System

| Engine | File | Role |
|---|---|---|
| `UnifiedCapabilityRegistry` | `unified-registry.ts` | Central registry. One `UnifiedCapability` definition exposed to `cli`/`ui`/`workflow`/`mcp`/`api`. Validates surface-specific fields at register time. |
| `CapabilityResolutionEngine` | `capability-resolution.ts` | 3-layer COALESCE override chain (global → tier → provider). Applies plan-tier gating, existential rules, dependency resolution. Read-only. |
| `CapabilityEventBus` | `capability-event-bus.ts` | Typed in-process pub/sub (singleton per process). Optionally mirrors every event into a durable `EventRecord` outbox for cross-surface replay. |
| `CapabilitySnapshot` | `capability-snapshot.ts` | Boot-time snapshot of active `CapabilityBinding` rows per registered provider. Used by `ChromeGovernor.executeSnapshotProgram`. |

### 4.3 Session and State

| Engine | File | Role |
|---|---|---|
| `ConversationManager` | `conversation-manager.ts` | Orchestrates the 8-step send pipeline: RESOLVE → DERIVE SLAVE → LOCK → ENSURE → SEND → CAPTURE → PARSE → STORE+EMIT. |
| `StreamBlockStore` | `stream-block-store.ts` | Stores raw streaming blocks with `blockMeta` (parserName, confidence, wireFormat). |
| `ContextAssemblyEngine` | `context-assembly.ts` | 5-stage pipeline: DETECT→RECALL→RANK→BUDGET→INJECT. Default token budget: 8,000. |
| `SituationDetector` | `situation-detector.ts` | Classifies task type (coding, research, creative, …) from conversation signals. Feeds `ContextAssemblyEngine`. |
| `ExecutionMemoizer` | `execution-memoizer.ts` | Memoizes deterministic capability executions to avoid redundant round-trips. |

### 4.4 Chrome Layer (sole CDP authority)

`ChromeGovernor` (`chrome-governor.ts`, 1,437 lines) is the **only** engine that
touches CDP. No other engine imports `BunCdpClient` directly — hard invariant.

Key sub-components (in `src/executor/`):

| Component | File | Role |
|---|---|---|
| `FleetSupervisor` | `fleet-supervisor.ts` | Manages Chrome slave lifecycle pool (spawn, restart, admission control, circuit-breaker). |
| `ProfileAllocator` | `profile-allocator.ts` | Singleton-per-(provider, account). Profiles live at `chrome-profiles/<slug>/<accountId>/`. Auth state from cookie files, not DB. |
| `CDPTransport` | `cdp-transport.ts` | WebSocket-based CDP transport layer. |
| `PortReaper` | `port-reaper.ts` | Reclaims stale debug ports (Windows zombie-socket handling). |

**Slave lifecycle states** (`slave-states.ts`):
`idle · sending · capturing · parsing · authenticating · error`

**Circuit breaker states**: `closed · half_open · open`

**Fleet config tunables** (from `FleetConfig`):
`maxConcurrent`, `maxQueued`, `queueTimeoutMs`, `cpuOverloadPct`, `memOverloadPct`,
`spawnRetryLimit`, `spawnRetryDelayMs`

### 4.5 Stream Parser System

| Engine | File | Role |
|---|---|---|
| `StreamParserEngine` | `stream-parser.ts` | Loads inline `logic_code` from DB only. Executes via `SandboxRunner`. Fallback chain: provider/001 → generic/001 → system/001. Auto-migrates legacy blocks. |
| `SandboxRunner` | `sandbox-runner.ts` | Sandboxed JS executor for DB-loaded parser code. |
| `StreamAlignmentEngine` | `stream-align.ts` | Computes parser hashes, resolves version conflicts. |

**Parser module contract** (inline `logic_code`):
```js
function(module, exports) {
  exports.default = {
    name, version, providerId,
    parse(rawBody)            -> ContentBlock[],
    detectCompletion(rawBody) -> boolean,
    getConfidence(rawBody)    -> number
  }
}
```

**ContentBlock types:** `text · reasoning · tool-call · file · meta · code · source`

**Wire formats detected:** `sse · ndjson · json-array · batchexecute · xssi · plain-text · unknown`

**Seeded parsers** (`seeds/parsers/harvested/`):

| Parser | Provider | Format |
|---|---|---|
| `claude-streaming-sse` | Claude | Anthropic SSE `content_block_delta` |
| `chatgpt-openai-delta` | ChatGPT | `choices[].delta.content` + parts |
| `gemini-batchexecute` | Gemini | XSSI `decodeEnvelope` + `parseStreamChunk` |
| `google-ai-studio` | Gemini | `candidates[].content.parts[].text` |
| `generic-format-agnostic` | generic | SSE/JSON/array best-effort |
| `system-raw-text` | system | Last-resort raw text (never throws) |

### 4.6 Natural Language Command Layer (NLCL)

All files in `src/engines/nlcl/` (~30 files; `nlcl-engine.ts` alone is 849 lines).

**Resolution pipeline:**
```
raw text
  → Prerouter        (fast pre-classification)
  → NLCommandParser  (tokenise + normalise)
  → IntentResolver   (deterministic patterns via catalog.ts, or local LLM swap)
  → IntentRouter     (composite-split for multi-step commands)
  → Executor         (one of 10 executor types)
  → CommandResult
```

**Executors** (`nlcl/executors/`):
`CapabilityExecutor · ConversationExecutor · ProviderLLMExecutor · BrowserExecutor ·
GenericBrowserExecutor · WorkflowExecutor · FileExecutor · EmailExecutor · AppExecutor · SystemExecutor`

**Catalog** (`nlcl/catalog.ts`, 60 KB): Binds NL patterns to `capabilityId` strings.
Deterministic patterns matched first; `LlmSlaveResolver` used as fallback.

**Dialogue sessions** (`nlcl/dialogue-session-store.ts`): Resumable multi-turn sessions
keyed by conversation context.

### 4.7 Provider Multiplexer

`ProviderMuxEngine` (`provider-mux.ts`) — fan-out, round-robin, priority, cost-optimized,
and learned multi-provider routing strategies. Stores `MuxSession` and `MuxResponse` rows.
Integrates with `AutonomousExecutionEngine` for provider failover via `FailoverRouter.fallbacksFor`.

### 4.8 Autonomous Execution

`AutonomousExecutionEngine` (`autonomous-execution.ts`, 1,473 lines):

- Multi-step task executor with human-in-the-loop (HITL) gates
- Task statuses: `pending · planning · executing · waiting_approval · paused · complete · failed · cancelled`
- Gate types: `approval · confirmation · selection · input · question · option · file · url`
- Per-task budgets: `maxSteps`, `maxDurationMs`, `costBudgetCents`, `tokenBudget`
- Integrates `ExecutionPolicyEngine`, `SelectorHealer`, `CapabilityComposer`, `ReplayController`

### 4.9 Memory and Knowledge

| Engine | File | Role |
|---|---|---|
| `MemoryEngine` | `memory-engine.ts` | Three stores: **Episodic** (action→result records), **Semantic** (subject–predicate–object triples with confidence), **Procedural** (condition–action rules with success/failure counters). |
| `KnowledgeIngestionEngine` | `knowledge-ingestion.ts` | Imports external exports (`chatgpt · claude · gemini · deepseek · generic · manual`). Deduplication, entity extraction, embedding generation. |
| `ContextAssemblyEngine` | `context-assembly.ts` | 7 context layers: `identity · preferences · topic · entity · conversation_history · recent_episodes · project_state`. Priority weights per task type. |
| `SemanticSearchEngine` | `semantic-search.ts` | Pluggable embedding providers (MiniLM via WASM or Ollama). |
| `CrossConversationSynthesizer` | `cross-conversation-synthesis.ts` | Synthesizes knowledge across conversations. |

### 4.10 Workflow Engine

`WorkflowEngine` (`workflow-engine.ts`) — executes visual workflow DAGs.

- Node categories: `trigger · action · logic · ai · data`
- Execution statuses: `running · complete · failed · cancelled`
- Node statuses: `pending · running · complete · failed · waiting_human · skipped`
- Integrates with `UnifiedCapabilityRegistry` for node type dispatch.
- `safe-eval.ts` guards expression evaluation (only trusted sources allowed).

### 4.11 Lifecycle Engines

| Engine | File | Role |
|---|---|---|
| `VersionManager` | `version-manager.ts` | Capability version chains, binding promotion/degradation, auto-promotion rules with metric conditions (`confidence · success_rate · consecutive_successes · latency_p95`). |
| `TelemetryAggregator` | `telemetry-aggregator.ts` | Reprogrammable aggregation pipeline. Operators configure schedules, sources, metrics, and retention via `TelemetryPipelineConfig`. Hot-reload via `reprogram()`. |
| `ConfigManager` | `config-manager.ts` | Runtime-reconfigurable key-value config per engine namespace. |

### 4.12 Selector Intelligence

| Engine | File | Role |
|---|---|---|
| `SelectorHealer` | `selector-healer.ts` | Auto-repairs drifted CDP selectors by re-probing the live DOM. |
| `SemanticGroundingEngine` | `semantic-grounding.ts` | Resolves selectors via accessibility-tree and visual matching (ARIA, text, CSS, composite, frame-chain). Tree cache TTL: 5 seconds. |
| `SelectorCache` | `selector-cache.ts` | LRU cache for validated selectors. |
| `SelectorRefiner` | `selector-refiner.ts` | Refines ambiguous selectors. |

### 4.13 Harness System

| Engine | File | Role |
|---|---|---|
| `HarnessCommandRegistry` | `harness-command-registry.ts` | Semver version resolution of declarative harness commands. Seeded from `seeds/harness/commands.json`. |
| `HarnessRepairEngine` | `harness-repair-engine.ts` | Zod-schema payload repair: alias remapping, code-fence strip, trailing-comma fix, apostrophe-safe quote balancing. |
| `HarnessFeedbackCoordinator` | `harness-feedback-coordinator.ts` | Escalating retry prompts with exponential backoff + diff. Never repeats the same prompt. |
| `HarnessProtocolEngine` | `harness-protocol-engine.ts` | Executes DB-driven harness programs (step DAGs). |
| `HarnessRuntime` | `harness-runtime.ts` | Low-level harness step executor. |

### 4.14 Other Engines

| Engine | File | Role |
|---|---|---|
| `PluginSystem` | `plugin-system.ts` | Runtime plugin registry. Plugins implement `ProviderPlugin` with hooks: `onRegister · onResolveCapabilities · onAction · onProjectState · onParse`. Phase 9 adds `surfaces` and `mutationHandlers` for SDK v2. |
| `StorageRelocationEngine` | `storage-relocation-engine.ts` | 5-phase zero-downtime DB migration: PREFLIGHT→COPY→VERIFY→SWITCH→CLEANUP. SHA-256 file integrity verification. |
| `KernelContext` | `kernel/kernel-context.ts` | Unified context object (Kernel, KernelRegistry, KernelTracer, KernelProvenance, Oracle). Passed to every engine constructor. |
| `OtelSink` | `otel-sink.ts` | OTLP/HTTP log batching exporter. Activated when `OTEL_EXPORTER_OTLP_ENDPOINT` is set. |

---

## 5. Provider System

### 5.1 Supported Providers

Six providers seeded from `seeds/providers/<slug>.json`:
`chatgpt · claude · gemini · deepseek · qwen · grok`

### 5.2 Provider Manifest Fields

Each manifest carries: endpoints, CDP selectors, parser references, model list, capability
bindings, and a `fallback` parser name pointing to the next tier in the fallback chain.

### 5.3 Provider-Specific CDP Details

From `conversation-manager.ts` and `provider-selectors.ts`:

| Provider | Composer selector | Send method | Streaming format |
|---|---|---|---|
| Gemini | `div.ql-editor[contenteditable="true"]` (Quill) | Click send button (Enter does not work in Quill) | Google RPC batchexecute (XSSI) |
| ChatGPT | `#prompt-textarea` / `textarea[data-testid="prompt-textarea"]` | Enter or send button | `data: {message:{content:{parts:[text]}}}` + `[DONE]` |
| Claude | `div[contenteditable="true"]` (ProseMirror) | Enter or send button | Anthropic SSE `content_block_delta` |

### 5.4 Chrome Profile Layout

```
chrome-profiles/
  <providerSlug>/
    <accountId>/              # e.g. gemini/owservera/
      .profile-meta.json      # { providerSlug, accountId, allocatedAt, lastUsed }
      Default/Network/Cookies # authentication source of truth
```

- **One profile per (provider, account)** — enforced by `ProfileAllocator` singleton.
- **Cookie file presence** determines authenticated state — not DB `loginState`.

### 5.5 Provider Protocol Data Layer

`src/__generated__/provider-protocol.ts` is a compiled static snapshot generated by:

```bash
bun run gen:protocol   # compile DB → static file + dev clone
```

The DB is the single source of truth. A dev clone (`provider-protocol.dev.ts`) allows
isolated override; `bun run devops protocol promote` pushes changes back.

### 5.6 8-Phase Onboarding Pipeline

Defined in `devops/onboard-controller.ts`:

```
discover → infer → test-selectors → test-parse → test-cap → test-frontend → verify → converge
```

---

## 6. Unified Capability System

### 6.1 The Invariant

Every operation is a `UnifiedCapability`. CLI and frontend are thin NL shells calling:

```
POST /api/interpret  →  POST /api/capabilities/:id/execute
```

No second transport; no hand-written CLI commands that bypass the registry.

### 6.2 UnifiedCapability Shape (`unified-registry.ts`)

```typescript
interface UnifiedCapability {
  id: string                      // "cap:category:action"
  slug: string
  name: string
  description: string
  category: string
  surfaces: CapabilitySurface[]   // 'cli' | 'ui' | 'workflow' | 'mcp' | 'api'
  inputSchema: Record<string, unknown>
  outputSchema: Record<string, unknown>
  handler: (input, ctx) => Promise<unknown>
  cliCommand?: { name, aliases, examples }
  ui?: { component, position, group, order, icon, shortcut, requiresConfirmation }
  workflowNodeType?: string
  mcpToolName?: string
  apiEndpoint?: { method, path }
  isAsync: boolean
  requiresConfirmation: boolean
  tags: string[]
  isComposite?: boolean
}
```

### 6.3 CLI Dispatch

`src/cli/index.ts` is a thin HTTP client to the running server. Two layers feed `CommandRegistry`:

1. **Bridged capabilities** — `syncCliFromUnified()` copies every `cli`-surface capability.
2. **Builtin commands** — `registerBuiltinCommands()` adds `automate` and `moments` (legacy bypass).

Multi-word commands resolve via `CommandRegistry.resolve()` (longest-prefix match).

### 6.4 MCP Server

`src/mcp/server.ts` — exposes `discovery-tools.ts` and `nlcl-tools.ts` as MCP tools.
Capabilities with `surfaces: ['mcp']` and `mcpToolName` are automatically available.

---

## 7. Reprogrammability Layer

Defined in `src/reprogrammability/contract.ts` (`CONTRACT_VERSION = 1`).

### 7.1 Core Contract

Every visible UI element implements `ReprogrammableSurface`:

```
SurfaceKind: card | panel | layer | primitive | chrome | slot | custom
```

**8 mutation ops** (from `mutation-schema.ts`) — all reversible, all logged with provenance.

### 7.2 Mutation Provenance Trust Order

```
manual > nlcl > prefix > plugin > llm-harness > system
```

### 7.3 Canonical Surfaces

Defined in `canonical-surfaces.ts`. Registered in `SurfaceRegistry` at boot.
Plugins (Phase 9) can register additional `ReprogrammableSurface` entries.

---

## 8. Storage Layer

### 8.1 Database

- **Prisma + SQLite** — WAL mode; dev database ~64 MB.
- Schema: `prisma/schema.prisma` (~128 KB).
- Engines depend on **store contracts** in `src/storage/contracts/` — 56 contract files.
- Implementations in `src/storage/impl/` are injected at boot; never imported by engines directly.

### 8.2 Store Contracts (56 files)

Covering: conversations, messages, providers, parsers, capabilities, fleet supervisor, canvas,
node graph, memory, knowledge, telemetry, harness, repair, versions, stream blocks, and more.

### 8.3 CozoDB (Graph Store)

`src/storage/cozo/` — graph queries (node relationships, knowledge graph).
Accessed via `cozo-node` native bindings.

### 8.4 Storage Relocation

`StorageRelocationEngine` handles zero-downtime DB migration with SHA-256 file integrity
verification and configurable rollback retention.

---

## 9. HTTP API Surface

Server: `src/server/index.ts` (1,742 lines), `Bun.serve`.

**35+ routers mounted:**

| Router | Path prefix | Purpose |
|---|---|---|
| `conversation-router` | `/api/conversations` | CRUD + send + history |
| `interpret-router` | `/api/interpret` | NL → capability dispatch |
| `capability-router` | `/api/capabilities` | List + execute capabilities |
| `setup-router` | `/api/setup` | Provider onboarding wizard |
| `chrome-router` | `/api/chrome` | Fleet control |
| `nlcl-router` | `/api/nlcl` | NLCL diagnostics |
| `mux-router` | `/api/mux` | Multi-provider fan-out |
| `knowledge-router` | `/api/knowledge` | Knowledge ingestion |
| `memory-viz-router` | `/api/memory` | Memory inspection |
| `autonomous-router` | `/api/autonomous` | Task orchestration |
| `node-router` | `/api/nodes` | Node graph (canvas) |
| `plugin-router` | `/api/plugins` | Plugin management |
| `version-router` | `/api/versions` | Version chains |
| `llm-harness-router` | `/api/llm-harness` | LLM-as-human testing |
| `canvas-ws` | `ws://…/canvas` | Canvas live mutations |
| `websocket` | `ws://…` | General event stream |

**`ServerContext`** (shared state injected into every router):
`db · eventBus · conversationManager · resolutionEngine · governor · knowledgeIngestion ·
semanticSearch · synthesizer · exportEngine · providerMux · autonomousEngine · policyEngine ·
registry · costOptimizer · nlclEngine · automationOrchestrator · kernel · healthKernel ·
lockManager · idempotencyGuard · retryEngine · conceptualModel · userIdentity · memoryFabric ·
agentBuilder · memoryEngine · nodeStore`

---

## 10. Frontend Architecture

Next.js App Router in `frontend/src/`:

| Directory | Contents |
|---|---|
| `app/` | Pages, layout, API route handlers |
| `components/` | React components (canvas, chat, memory, ui) |
| `engines/` | Frontend engines (canvas, workspace, plugin, RBAC, presence) |
| `ui/` | Slot system: `slots.ts` · `registry.ts` · `context.tsx` · `defaults/` |
| `sdk/` | Frontend SDK |
| `storage/` | Storage contracts + in-memory implementations |
| `actions/` | ActionRegistry + auto-populate |
| `api/` | API client |
| `registry/` | CapabilityRegistry (frontend mirror) |
| `features/` | Feature modules (onboarding, provider-setup-wizard) |

**UI Slot IDs** use namespaced format: `chat.actionBar · chat.composer · chat.sidebar`

---

## 11. Configuration

All configuration centralized in `src/config.ts`. No scattered `process.env` reads.

### Key Environment Variables

| Variable | Default | Purpose |
|---|---|---|
| `CAP_STORE_PORT` | `9420` | Backend port (falls back to `.runtime/backend.port`) |
| `CAP_STORE_DATA_DIR` | OS-specific (`%LOCALAPPDATA%/vivim/cap-store`) | DB + profile root |
| `CAP_STORE_DB_PATH` | `<dataDir>/cap-store.db` | Prisma database path |
| `CAP_STORE_DEBUG` | `false` | Enable debug logging |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | (unset) | Activate OTLP log forwarding |
| `PROVIDER_PROTOCOL_SOURCE` | `prod` | `prod` or `dev` — which protocol file to use |

**Runtime tunables** — overridable at runtime via `bun run devops toolkit config set <key> <value>`.
Values are persisted to `.runtime/config.tunables.json` and hot-read by the running server.

---

## 12. Build and Deployment

### Development

```bash
bun run dev        # Start backend + frontend concurrently (scripts/dev.ts)
bun run stop       # Graceful stop (scripts/stop.ts)
bun run devops     # DevOps CLI (onboarding, protocol, invariants, testing)
```

### Production Binary (Tauri sidecar)

```bash
bun run scripts/tauri/compile-sidecar.ts   # bun build --compile + UPX level 3
```

**UPX compression results:**
- Bun runtime baseline (Windows): ~94 MB
- App code: ~3 MB
- Total uncompressed: ~97 MB
- After UPX level 3 (`--no-lzma`): ~45.6 MB (24.8 seconds)

### Database

```bash
bunx prisma migrate dev   # Apply migrations
bun run seed              # Seed all data (providers, parsers, harness commands)
bun run gen:protocol      # Regenerate provider-protocol.ts from DB
```

---

## 13. Testing

```
tests/
  unit/          # Isolated engine tests with mocked store contracts
  integration/   # Engine-to-engine tests
  e2e/           # Full-stack tests
  helpers/       # Test utilities
```

```bash
bun test                   # All tests
bun test tests/unit        # Unit only
bun test tests/integration # Integration only
```

**LLM-as-Human test suite** (`devops/llm-testing/`) — registered as `UnifiedCapability` set:
`cap:llm_test:{run,report,status,patterns,providers,parity}` (surfaces: `cli/api/mcp`).

---

## 14. Invariants

Enforced by `bun run devops invariants check`. Critical rules:

1. **Governor Canon** — Only `ChromeGovernor` touches CDP. No engine imports `BunCdpClient`.
2. **Store Contracts** — Engines depend on `contracts/`, never `impl/`.
3. **DB-Only Parser Logic** — `StreamParserEngine` loads logic only from DB (`logic_type=inline`).
4. **Chrome Profile = Auth Source of Truth** — Cookie files determine login state, not DB.
5. **One Profile Per (Provider, Account)** — `ProfileAllocator` singleton enforces this.
6. **One Entry Point** — Every operation is a `UnifiedCapability`. No second transports.
7. **No Runaway Creation** — `FleetSupervisor` caps (`maxConcurrent`, queue, timeout).
8. **Lazy Startup** — Chrome slaves auto-launch on first use; no always-on requirement.
9. **Triple-Layer State Consistency** — Profile dir (canonical) ↔ DB ↔ runtime must align.
10. **Reprogrammability Contract** — `CONTRACT_VERSION = 1`. Every visible element is a `ReprogrammableSurface`.

---

## 15. Key Design Decisions

- **Parser logic in DB, not files**: `StreamParserEngine` rejects file-based parsers unless
  `allowFileLogic` is explicitly set. This enforces that parsing logic is versioned, auditable,
  and hot-swappable without restarts.

- **Store contracts, not implementations**: Every engine receives a typed store-contract interface.
  This makes engines testable in isolation and storage-backend-agnostic.

- **Single capability definition**: A `UnifiedCapability` is defined once and automatically
  projected to CLI, UI, API, MCP, and workflow. No duplication across surfaces.

- **NLCL as the universal shell**: All natural language input (CLI or frontend) funnels through
  `NLCLEngine → /api/interpret`. The CLI is a thin HTTP client, not a parallel command system.

- **ChromeGovernor as the sole CDP gatekeeper**: Prevents race conditions, enforces admission
  control, and centralizes trace logging for all browser interactions.

- **SQLite WAL with Prisma**: Local-first, zero-infrastructure dependency. Migrations are
  tracked via Prisma and fully reproducible.
