# 02 — Merged Architecture: System Design

**Status:** FINAL — merged PRD
**Covers:** Original `02-architecture-prd.md` + `pending-design/02-chrome-slave-io-governor.md` (architecture) + `pending-design/03-conversation-manager.md` (architecture) + vCode pattern analysis

---

## Core Design

```
                         ┌──────────────────┐
                         │   Seed Files     │
                         │                  │
                         │ providers/*.json │──► ProviderRegistrar
                         │ parsers/*.ts     │──► StreamParserEngine
                         │ harness/*.ts     │──► HarnessRuntime
                         └──────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────┐
│                      SQLite Database                         │
│                                                             │
│  ~54 tables across 13 layers (L0-L13)                       │
│  WAL mode, foreign_keys=ON, synchronous=NORMAL              │
│  All config persisted in config_entry + config_audit        │
└─────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────┐
│                    13 Engines                                │
│                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ChromeGovernor│  │Conversation- │  │StreamParser- │      │
│  │ (I/O authority│  │Manager       │  │Engine         │      │
│  │  4 subsystems)│  │(8-step pipe) │  │(1 interface)  │      │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘      │
│         │                 │                 │               │
│  ┌──────┴───────┐  ┌──────┴───────┐  ┌──────┴───────┐      │
│  │Capability-   │  │Capability-   │  │Provider-     │      │
│  │Engine         │  │Resolution-   │  │Registrar      │      │
│  │(execution)   │  │Engine (SQL)  │  │(seed→DB)     │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │Capability-   │  │ProviderHealth│  │StreamBlock-  │      │
│  │EventBus       │  │Kernel         │  │Store          │      │
│  │(pub/sub)     │  │(6 signals)   │  │(persistence) │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │Registration- │  │VersionManager│  │Telemetry-    │      │
│  │Auditor        │  │(versioning) │  │Aggregator     │      │
│  │(audit+drift) │  │             │  │(pipeline)    │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│                                                             │
│  ┌──────────────┐                                           │
│  │ConfigManager │  ── unified re-programability            │
│  │(config auth) │                                           │
│  └──────────────┘                                           │
└─────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────┐
│                     Presentation Layer                       │
│                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │REST API      │  │WebSocket     │  │CLI Engine    │      │
│  │(25+ endpoints│  │(typed events)│  │(command      │      │
│  │ via Bun.serve│  │via event bus │  │ registry)    │      │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘      │
│         │                 │                 │               │
│         ▼                 ▼                 ▼               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │SDK Client    │  │Frontend      │  │Admin/Scripts │      │
│  │(typed TS)   │  │(Tauri webview)│  │(dev tooling) │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
```

---

## Architecture Principles

### P1: Knowledge Graph

Capabilities, providers, parsers, bindings, selectors, models, endpoints, configs, routes, and transfers are rows in a database. No provider-specific behavior is hardcoded in TypeScript source files. Adding a provider = adding a JSON manifest to `seeds/providers/`.

### P2: Single I/O Authority (Governor Canon)

`ChromeGovernor` is the only engine that communicates with Chrome via CDP. Every other engine calls `governor.cdp.send()`, `governor.cdp.capture()`, `governor.lifecycle.launch()`, `governor.lifecycle.kill()`, or `governor.health.isAlive()`. No engine imports `BunCdpClient` or touches CDP directly. No engine spawns or kills Chrome processes directly.

This means:
- All CDP tracing flows through one place (TraceLog)
- All Chrome lifecycle events flow through one place (LifecycleManager)
- Concurrency control is centralized (per-slave mutex)
- Circuit breaker state is authoritative (HealthMonitor)
- The Governor can be mocked in tests (no real Chrome needed)

### P3: Seeds Not Code

All provider configuration, parser logic, and harness modules are seed files — `.json` for manifests, `.ts` for parsers and modules. The `ProviderRegistrar` reads seeds and writes to DB. Seeds are the source of truth; the DB is the runtime state. Operators can `POST /api/admin/seed` to reload from seeds without restarting the server.

### P4: Engines Are Unit-Testable

Every engine depends only on store contracts (typed interfaces). In tests, contracts are mocked. In production, contracts are bound to `bun:sqlite`. No engine imports a concrete storage implementation. This enables: fast unit tests with `:memory:` databases, mock-based integration tests, and engine-level TDD.

### P5: Batch-After-Capture Streaming

v1 buffers the full provider response via CDP, parses it into `ContentBlock[]`, and emits a single `conversation:complete` event. Real-time block-level SSE streaming to the frontend is deferred to v2. This simplifies the parsing pipeline, eliminates race conditions from partial responses, and makes the WebSocket event model simpler.

### P6: Relational First

All relationships are foreign keys with cascading deletes. No JSON-in-TEXT columns for queryable data. `binding_status_log` replaces the `promotion_history` JSON blob. `capability_taxonomy_version` replaces the `version` scalar. Every relationship is a JOIN, not a JSON parse.

### P7: Re-Programmable

Every lifecycle engine (RegistrationAuditor, VersionManager, TelemetryAggregator) reads its behavior from a `ConfigManager`-persisted config object. Changing config changes behavior on the next cycle — no restart, no code change. Config changes are audited. Default configs are sensible; operators override what they need.

### P8: Capability-Driven UI

Every capability has a 21-field UI contract that tells any frontend how to render it: component type, label, icon, position, states, input schema, output contract, dependency chain, plan-tier gating. The frontend calls `GET /api/conversations/:id/capabilities` and renders what it receives — no conditional rendering logic in the frontend.

### P9: Agentic Harness

The HarnessRuntime is a **server-side orchestrator** running in Node.js (or Tauri v2 sidecar process) — never injected into Chrome's page context. It executes multi-step capability DAGs by sending **individual, atomic CDP commands** one at a time through the Governor's CDPProxy. This preserves Chrome's event loop: the webapp remains responsive between commands. The DAG structure supports observation (capture DOM state via CDP read commands after each step), branching (if login page then X else Y), retry with backoff, and real-time progress streaming back to the UI through the EventBus. Each capability slug maps to a harness module — a composable Node.js function that orchestrates CDP primitives.

---

## Module Layout (Complete File Tree)

```
cap-store-v1/
├── package.json
├── tsconfig.json
├── bunfig.toml
├── biome.json                         ← Biome linter + formatter
├── lefthook.yml                       ← Git hooks
├── tsup.config.ts                     ← Build config (ESM + DTS)
├── .env                               ← DATABASE_URL
├── prisma/
│   ├── schema.prisma                  ← ~54 tables, relations, indexes (Prisma)
│   ├── seed.sql                       ← CHECK constraints, 9 views, seed data
│   └── dev.db                         ← SQLite database
├── seeds/
│   ├── providers/
│   │   ├── claude.json
│   │   ├── chatgpt.json
│   │   ├── gemini.json
│   │   ├── deepseek.json
│   │   ├── studio-ai.json
│   │   ├── z-ai.json
│   │   └── qwen.json
│   ├── parsers/
│   │   ├── claude/
│   │   │   └── 001_streaming_sse.ts
│   │   ├── gemini/
│   │   │   └── 001_batchexecute.ts
│   │   ├── chatgpt/
│   │   │   └── 001_openai_sse.ts
│   │   ├── generic/
│   │   │   ├── 001_sse_frames.ts
│   │   │   └── 002_openai_delta.ts
│   │   └── system/
│   │       └── 001_fallback.ts
│   └── harness/
│       ├── composer.module.ts
│       ├── login.module.ts
│       ├── navigation.module.ts
│       ├── capture.module.ts
│       └── selector.module.ts
├── src/
│   ├── schema/
│   │   ├── core.ts                   ← capability_taxonomy, binding, program, tier, outcome, selector_strategy
│   │   ├── chrome.ts                 ← ProviderAccount, ProviderDefinitionRow, etc.
│   │   ├── provider.ts               ← SelectorStrategy, ProviderTransport, PlanTier
│   │   ├── routing.ts                ← RouteSpec, RouteRequest, RouteTarget, RouteEvent
│   │   ├── session.ts                ← VivimSession, ProviderSession, ProfileSession, Conversation
│   │   ├── streaming.ts              ← StreamBlock, ContentBlock union
│   │   ├── learning.ts               ← LearningEvent, Rule, BindingEvent
│   │   ├── transfer.ts               ← TransferPattern, TransferCandidate, TransferAttempt
│   │   ├── automation.ts             ← AutomationSchedule, AlertCondition, DiscoveryObjective
│   │   ├── health.ts                 ← ProviderHealthReport, signals
│   │   ├── telemetry.ts              ← TelemetryPipelineConfig, schedules, retention
│   │   ├── versioning.ts             ← VersionConfig, PromotionRule, DegradationRule
│   │   ├── config.ts                 ← ConfigEntry, ConfigAuditEntry
│   │   ├── harness.ts                ← HarnessDAG, HarnessModule, HarnessTelemetry
│   │   ├── types.ts                  ← barrel re-export (everything)
│   │   └── validators.ts             ← Zod schemas for all write endpoints
│   ├── storage/
│   │   ├── db.ts                     ← CapStoreDb interface (PrismaClient wrapper)
│   │   ├── prisma.ts                 ← PrismaClient singleton
│   │   ├── open.ts                   ← openDb() — contract binder
│   │   ├── contracts/
│   │   │   ├── parser-store.ts
│   │   │   ├── capability-store.ts
│   │   │   ├── provider-store.ts
│   │   │   ├── conversation-store.ts
│   │   │   ├── capability-resolution-store.ts
│   │   │   ├── health-store.ts
│   │   │   ├── stream-block-store.ts
│   │   │   ├── version-store.ts
│   │   │   ├── telemetry-store.ts
│   │   │   ├── registration-store.ts
│   │   │   └── config-store.ts
│   │   └── impl/
│   │       ├── parser-store-impl.ts
│   │       ├── capability-store-impl.ts
│   │       ├── provider-store-impl.ts
│   │       ├── conversation-store-impl.ts
│   │       ├── capability-resolution-store-impl.ts
│   │       ├── health-store-impl.ts
│   │       ├── stream-block-store-impl.ts
│   │       ├── version-store-impl.ts
│   │       ├── telemetry-store-impl.ts
│   │       ├── registration-store-impl.ts
│   │       └── config-store-impl.ts
│   ├── engines/
│   │   ├── chrome-governor.ts         ← ChromeGovernor (4 subsystems)
│   │   ├── conversation-manager.ts    ← ConversationManager (8-step pipe)
│   │   ├── stream-parser.ts           ← StreamParserEngine
│   │   ├── capability.ts              ← CapabilityEngine
│   │   ├── provider-registrar.ts      ← ProviderRegistrar
│   │   ├── capability-resolution.ts   ← CapabilityResolutionEngine
│   │   ├── capability-event-bus.ts    ← CapabilityEventBus
│   │   ├── provider-health.ts         ← ProviderHealthKernel
│   │   ├── stream-block-store.ts      ← StreamBlockStore
│   │   ├── registration-auditor.ts    ← RegistrationAuditor
│   │   ├── version-manager.ts         ← VersionManager
│   │   ├── telemetry-aggregator.ts    ← TelemetryAggregator
│   │   ├── config-manager.ts          ← ConfigManager
│   │   └── execution-memoizer.ts      ← ExecutionMemoizer
│   ├── server/
│   │   ├── index.ts                   ← Bun.serve + all routes
│   │   ├── response.ts               ← CORS + JSON helpers
│   │   ├── websocket.ts              ← WS server with subscription model
│   │   ├── conversation-router.ts    ← ConversationRouter
│   │   └── auth-gate.ts              ← Bearer token validation
│   ├── cli/
│   │   ├── index.ts                   ← CLI entry point
│   │   ├── command-registry.ts        ← CommandRegistry
│   │   ├── output-formatter.ts        ← --json | --pretty | --table | --watch
│   │   ├── pipeline-engine.ts         ← Unix-style pipe: cmd1 | cmd2 | cmd3
│   │   ├── bridges/
│   │   │   ├── cap-store-bridge.ts    ← HTTP client for cap-store
│   │   │   ├── backend-bridge.ts      ← HTTP client for Rust backend
│   │   │   └── extension-bridge.ts    ← Native messaging for Chrome extension
│   │   └── commands/
│   │       ├── providers.ts
│   │       ├── fleet.ts
│   │       ├── conversations.ts
│   │       ├── admin.ts
│   │       ├── config.ts
│   │       ├── health.ts
│   │       ├── version.ts
│   │       ├── telemetry.ts
│   │       └── system.ts
│   ├── executor/                      ← Surviving files (not rewritten)
│   │   ├── cdp.ts
│   │   ├── circuit-breaker.ts
│   │   ├── async-mutex.ts
│   │   ├── fleet-config.ts
│   │   ├── content-blocks.ts
│   │   └── ids.ts
│   ├── errors.ts                      ← Typed errors (not rewritten)
│   ├── config.ts                      ← Centralized config (not rewritten)
│   └── index.ts                       ← Public re-exports
├── sdk/
│   ├── src/
│   │   ├── types.ts
│   │   ├── client.ts
│   │   └── index.ts
│   └── tests/
│       └── client.test.ts
├── tests/
│   ├── unit/
│   │   ├── storage/
│   │   │   ├── db-open.test.ts
│   │   │   ├── provider-store.test.ts
│   │   │   ├── parser-store.test.ts
│   │   │   ├── conversation-store.test.ts
│   │   │   └── schema-constraints.test.ts
│   │   └── engines/
│   │       ├── chrome-governor.test.ts
│   │       ├── conversation-manager.test.ts
│   │       ├── stream-parser.test.ts
│   │       ├── capability.test.ts
│   │       ├── capability-resolution.test.ts
│   │       ├── capability-event-bus.test.ts
│   │       ├── provider-health.test.ts
│   │       ├── stream-block-store.test.ts
│   │       ├── registration-auditor.test.ts
│   │       ├── version-manager.test.ts
│   │       ├── telemetry-aggregator.test.ts
│   │       ├── config-manager.test.ts
│   │       └── execution-memoizer.test.ts
│   ├── integration/
│   │   └── api/
│   │       ├── health.test.ts
│   │       ├── providers.test.ts
│   │       ├── accounts.test.ts
│   │       ├── fleet.test.ts
│   │       ├── conversation.test.ts
│   │       ├── admin.test.ts
│   │       └── stream.test.ts
│   └── e2e/
│       ├── claude-send.test.ts
│       ├── chatgpt-send.test.ts
│       └── multi-turn.test.ts
└── docs/
    └── ways-of-work/
        └── plan/
            └── cap-store-v1-rebuild/
                └── merged-design-v2/  ← these documents
```

---

## All 13 Engines

| Engine | Purpose | Constructor Dependencies | File |
|--------|---------|------------------------|------|
| `ChromeGovernor` | Single I/O authority for Chrome | `db: CapStoreDb`, `config: FleetConfig`, `eventBus?: CapabilityEventBus` | `src/engines/chrome-governor.ts` |
| `ConversationManager` | 8-step send pipeline | `governor: ChromeGovernor`, `resolution: CapabilityResolutionEngine`, `parser: StreamParserEngine`, `blocks: StreamBlockStore`, `eventBus: CapabilityEventBus`, `db: CapStoreDb` | `src/engines/conversation-manager.ts` |
| `StreamParserEngine` | Parse provider API responses into ContentBlock[] | `store: ParserStore`, `config?: ParserConfig` | `src/engines/stream-parser.ts` |
| `CapabilityEngine` | Execute capabilities via CDP | `governor: ChromeGovernor`, `store: CapabilityStore`, `eventBus?: CapabilityEventBus` | `src/engines/capability.ts` |
| `ProviderRegistrar` | Seed provider KG from JSON manifests | `store: ProviderStore`, `auditor?: RegistrationAuditor` | `src/engines/provider-registrar.ts` |
| `CapabilityResolutionEngine` | Resolve capability UI contracts | `store: CapabilityResolutionStore` | `src/engines/capability-resolution.ts` |
| `CapabilityEventBus` | Typed in-process pub/sub | (none — singleton) | `src/engines/capability-event-bus.ts` |
| `ProviderHealthKernel` | Weighted health score aggregation | `store: HealthStore`, `governor: ChromeGovernor`, `eventBus: CapabilityEventBus` | `src/engines/provider-health.ts` |
| `StreamBlockStore` | Persist and retrieve ContentBlock[] | `db: CapStoreDb` | `src/engines/stream-block-store.ts` |
| `RegistrationAuditor` | Audit manifest changes, detect drift | `store: RegistrationStore`, `configManager: ConfigManager`, `eventBus?: CapabilityEventBus` | `src/engines/registration-auditor.ts` |
| `VersionManager` | Version chains, promotion audit, program metrics | `store: VersionStore`, `configManager: ConfigManager`, `eventBus?: CapabilityEventBus` | `src/engines/version-manager.ts` |
| `TelemetryAggregator` | Reprogrammable aggregation pipeline | `store: TelemetryStore`, `eventBus?: CapabilityEventBus`, `configManager: ConfigManager` | `src/engines/telemetry-aggregator.ts` |
| `ConfigManager` | Unified re-programability framework | `store: ConfigStore`, `eventBus?: CapabilityEventBus` | `src/engines/config-manager.ts` |

---

## Boot Sequence

```
openDb()
  │
  ├─ [1] Open SQLite database (WAL mode)
  │     └─ Run 001_baseline.sql migration
  │     └─ Create all ~54 tables + 9 views
  │     └─ Seed schema_meta rows
  │
  ├─ [2] Create CapabilityEventBus (singleton)
  │     └─ No subscribers yet — engines register during construction
  │
  ├─ [3] Create ConfigManager
  │     └─ Load persisted configs from config_entry table
  │     └─ Apply defaults for any engine without a persisted config
  │     └─ Subscribe to cap-store API for runtime reprogramming
  │
  ├─ [4] Create all engines (in dependency order)
  │     ├─ StreamBlockStore
  │     ├─ StreamParserEngine (preload all parser seed files)
  │     ├─ CapabilityResolutionEngine
  │     ├─ CapabilityEngine
  │     ├─ ProviderRegistrar
  │     ├─ RegistrationAuditor
  │     ├─ VersionManager
  │     ├─ TelemetryAggregator
  │     ├─ ExecutionMemoizer
  │     ├─ ChromeGovernor
  │     │     └─ governor.boot() →
  │     │           ├─ Reap orphaned ports
  │     │           ├─ Seed accounts from provider_account table
  │     │           ├─ Initialize HealthMonitor (start liveness probes)
  │     │           └─ Start TraceLog
  │     ├─ ProviderHealthKernel
  │     │     └─ kernel.start() → begin scheduled aggregation loop
  │     └─ ConversationManager
  │
  ├─ [5] Start TelemetryAggregator
  │     └─ aggregator.start() → begin schedules per triggerMode
  │
  ├─ [6] Start Bun.serve on port 9420
  │     ├─ Mount ConversationRouter (all REST endpoints)
  │     ├─ Mount WebSocket handler (CapabilityEventBus → WS bridge)
  │     └─ Mount AuthGate
  │
  └─ [7] Server listening
        └─ CLI and SDK can now connect
```

---

## ChromeGovernor: Single I/O Authority (Detailed)

```
                    ┌─────────────────────────────────────────────────────────┐
                    │                    ChromeGovernor                        │
                    │                                                         │
                    │  Public API:                                            │
                    │    boot(db)         initialize fleet                    │
                    │    launch(provId, opts) → slave: ChromeSlave            │
                    │    kill(slaveId)                                        │
                    │    ensureRunning(slaveId) → slave                       │
                    │    captureConversation(slaveId) → CaptureResult         │
                    │    getHealth(slaveId) → health: SlaveHealth             │
                    │    getTrace(slaveId) → TraceEntry[]                    │
                    │    getAllSlaves() → ChromeSlave[]                       │
                    │    getSlave(slaveId) → ChromeSlave | null               │
                    │                                                         │
                    │  ┌─────────────────────────────────────────────────┐   │
                    │  │ LifecycleManager                                 │   │
                    │  │                                                  │   │
                    │  │  • spawn() — detectChrome path, derive port,    │   │
                    │  │    allocate profile, launch Chrome with         │   │
                    │  │    --remote-debugging-port                      │   │
                    │  │  • kill() — CDP Browser.close, kill process,   │   │
                    │  │    reap port                                     │   │
                    │  │  • ensure() — check liveness, restart if dead   │   │
                    │  │  • deriveProfile() — profile_dir per account   │   │
                    │  │  • allocatePort() — dynamic port from range    │   │
                    │  │  • seedAccounts() — create accounts from       │   │
                    │  │    provider_account rows                        │   │
                    │  │  • reapOrphanPorts() — kill processes on       │   │
                    │  │    ports from previous runs                     │   │
                    │  └─────────────────────────────────────────────────┘   │
                    │                                                         │
                    │  ┌─────────────────────────────────────────────────┐   │
                    │  │ CDPProxy                                          │   │
                    │  │                                                  │   │
                     │  │  • send(slaveId, method, params) → result       │   │
                     │  │    ── Runtime.evaluate, Input.dispatchKeyEvent, │   │
                     │  │       Page.navigate, etc.                        │   │
                     │  │  • capture(slaveId, pattern, timeout) → body    │   │
                     │  │    ── Network.responseReceived + getResponseBody │   │
                     │  │  • executeHarnessPlan(slaveId, dag) → result    │   │
                     │  │    ── Node.js-side orchestrator: iterates DAG  │   │
                     │  │       steps, sends one atomic CDP command per   │   │
                     │  │       step. Never blocks Chrome's event loop.   │   │
                     │  │  • getPageState(slaveId) → { url, title, ... } │   │
                     │  │  • captureScreenshot(slaveId, format) → base64  │   │
                    │  │                                                  │   │
                    │  │  All methods are concurrency-controlled:        │   │
                    │  │  each slave has a per-slave AsyncMutex.          │   │
                    │  │  Parallel sends to different slaves are OK.      │   │
                    │  │  Two sends to the SAME slave serialize.          │   │
                    │  └─────────────────────────────────────────────────┘   │
                    │                                                         │
                    │  ┌─────────────────────────────────────────────────┐   │
                    │  │ TraceLog                                          │   │
                    │  │                                                  │   │
                    │  │  • Every CDP command and response is traced      │   │
                    │  │    to trace_entry table                          │   │
                    │  │  • Traces include: engine, method, requestId,   │   │
                    │  │    conversationId, accountId, providerId,        │   │
                    │  │    durationMs, ok, error                        │   │
                    │  │  • Subscribe to capability:executed +            │   │
                    │  │    capability:failed events for correlation     │   │
                    │  └─────────────────────────────────────────────────┘   │
                    │                                                         │
                    │  ┌─────────────────────────────────────────────────┐   │
                    │  │ HealthMonitor                                     │   │
                    │  │                                                  │   │
                    │  │  • Probes Chrome liveness via CDP                │   │
                    │  │    Browser.getVersion every N seconds            │   │
                    │  │  • Updates ChromeSlave.status                    │   │
                    │  │  • Manages CircuitBreaker per slave              │   │
                    │  │  • Emits fleet:slave_status events              │   │
                    │  │  • Emits fleet:circuit_changed events            │   │
                    │  └─────────────────────────────────────────────────┘   │
                    └─────────────────────────────────────────────────────────┘
```

No other engine imports `BunCdpClient`. All Chrome interaction goes through the Governor.

---

## HarnessRuntime: Server-Side Orchestration Engine

**Execution context: Node.js (Bun) or Tauri v2 sidecar — NOT injected into Chrome.**

The HarnessRuntime is a server-side orchestrator that receives capability DAGs from the Governor's CDPProxy and executes them step-by-step by sending **individual atomic CDP commands** through the Governor. Each command (`Input.insertText`, `Runtime.evaluate`, etc.) completes before the next one starts. Chrome's event loop remains free between commands — the webapp never hangs.

```
                       Governor.CDPProxy
                             │
                             │ executeHarnessPlan(slaveId, dag)
                             │  → Node.js iterates DAG, sends
                             │    one atomic CDP command per step
                             ▼
┌─────────────────────────────────────────────────────────────┐
│            HarnessRuntime (Node.js / Tauri v2)               │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐ │
│  │ HarnessModule Registry                                │ │
│  │                                                       │ │
│  │  composer.ts    ← focusElement + insertText + pressEnter│ │
│  │  login.ts       ← waitForSelector + insertText + click │ │
│  │  navigation.ts  ← Page.navigate + waitForSelector      │ │
│  │  capture.ts     ← Network.enable + getResponseBody     │ │
│  │  selector.ts    ← DOM query via Runtime.evaluate       │ │
│  │                                                       │ │
│  │  Each module is a server-side function:               │ │
│  │    inputSchema: Record<string, unknown>               │ │
│  │    execute(input, cdp, sessionId): Promise<StepResult>│ │
│  │    preconditions: string[]                             │ │
│  └───────────────────────────────────────────────────────┘ │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐ │
│  │ HarnessDAG Executor (Node.js-side)                     │ │
│  │                                                       │ │
│  │  for each node in dag:                                │ │
│  │    Sequence  → execute steps sequentially             │ │
│  │    Branch    → read page state, evaluate condition,   │ │
│  │                route to then/else branch              │ │
│  │    Parallel  → Promise.all(steps.map(execute))        │ │
│  │    Retry     → execute, catch, backoff, retry         │ │
│  │    Step      → module.execute(input, cdp, sessionId)  │ │
│  │                                                       │ │
│  │  Each step = one atomic CDP command.                  │ │
│  │  Chrome's main thread is NEVER blocked for more       │ │
│  │  than a single CDP operation (~ms).                   │ │
│  └───────────────────────────────────────────────────────┘ │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐ │
│  │ HarnessTelemetry                                      │ │
│  │                                                       │ │
│  │  Every step emits progress via EventBus:              │ │
│  │    { step: 2, total: 6, status: "executing",          │ │
│  │      description: "Typing message into composer" }    │ │
│  │                                                       │ │
│  │  Every selector hit/miss recorded                     │ │
│  └───────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

**The only script injected into Chrome via `Page.addScriptToEvaluateOnNewDocument` is the anti-detection stealth script (SOTA-05). It runs once on page load (~10ms), sets up fingerprint masking, and exits. No execution logic lives in the browser.**

---

## ConversationManager: 8-Step Thin Pipe

```
ConversationManager.send(conversationId, message)
  │
  ├─ [1] RESOLVE (5ms budget)
  │     └── CapabilityResolutionEngine.resolve(providerId, planTier)
  │         → ResolvedCapabilities — which capabilities are available
  │
  ├─ [2] LOCK (0ms — mutex acquire)
  │     └── Governor mutex for this slave (concurrency control)
  │
  ├─ [3] ENSURE TAB (up to 10s)
  │     └── Governor.ensureRunning(slaveId)
  │         → Chrome is alive, tab is focused, page is loaded
  │
  ├─ [4] SEND (up to 30s — configurable timeout)
  │     └── Governor.cdp.executeHarnessPlan(slaveId, dag)
  │         → Node.js orchestrator sends atomic CDP commands
  │         → (focusElement + insertText + pressEnter, etc.)
  │
  ├─ [5] CAPTURE (up to 30s)
  │     └── Governor.captureConversation(slaveId)
  │         → Raw response body (SSE text, JSON, or HTML)
  │
  ├─ [6] PARSE (up to 500ms)
  │     └── StreamParserEngine.parse(rawBody, providerId)
  │         → ContentBlock[] — typed blocks extracted from raw response
  │         → Parser confidence score updated
  │
  ├─ [7] STORE (up to 10ms)
  │     ├── ConversationStore.createMessage(conversationId, blocks)
  │     └── StreamBlockStore.storeBlocks(conversationId, messageId, blocks)
  │         → persist conversation_message row + stream_block rows
  │
  └─ [8] EMIT (0ms — synchronous bus emit)
        └── CapabilityEventBus.emit({
              type: 'conversation:complete',
              conversationId,
              message: ConversationMessageRow
            })
            → WebSocket bridge receives, forwards to subscribed clients
```

---

## Streaming Scope

**v1: Batch-After-Capture.** The full provider response is buffered, parsed, and emitted as a single `conversation:complete` event. The frontend receives the complete message in one WebSocket message. No incremental block delivery.

**v2 (future):** Real-time block-level streaming. As the StreamParserEngine extracts each block, `conversation:block` events fire. The frontend renders blocks progressively. This requires the SSE capture path to parse blocks during capture, not after.

**What this means for the API:**
- `conversation:complete` is the sole delivery event
- No `conversation:block` WS events
- `POST /api/conversations/:id/send` returns `{ ok, blocks, text, latencyMs }` — the complete response
- No `GET /api/conversations/:id/stream` endpoint

---

## MCP Server Interface (Design Slot)

The ChromeGovernor exposes a design slot for an MCP server interface. When implemented (v2):

- Governor registers as an MCP server on a local port
- Tools exposed: `chrome_launch`, `chrome_send`, `chrome_capture`, `chrome_navigate`, `chrome_screenshot`, `chrome_get_state`
- Any MCP-compatible client (Claude Code, Cursor, Continue.dev) can control Chrome through the Governor
- The MCP protocol adapter translates MCP tool calls to Governor public API calls

Design slot only for v1. The mcp_server_config table exists but is not wired.

---

## Cross-Cutting Concerns

### ConfigManager

Single authority for all engine configuration. Every lifecycle engine registers its config schema (Zod) with the ConfigManager. Configs are persisted in `config_entry`, changes audited in `config_audit`. Hot-reload: engines poll or subscribe to `config:changed` events.

```typescript
interface ConfigManager {
  registerSchema(engineId: string, schema: ZodSchema, defaults: object): void;
  getConfig<T>(engineId: string, scope?: ConfigScope): T;
  updateConfig<T>(engineId: string, patch: Partial<T>, actor: string, scope?: ConfigScope): Promise<T>;
  getConfigHistory(engineId: string, limit?: number): Promise<ConfigAuditEntry[]>;
  reloadConfig(engineId: string): Promise<T>; // force reload from DB
}
```

### ExecutionMemoizer

TTL-based caching layer for expensive computations:
- `CapabilityResolutionEngine.resolve(providerId, planTier)` → TTL 5s
- `ProviderHealthKernel.getHealth(providerId)` → TTL 30s
- `StreamParserEngine.loadParser(providerId)` → memoized by file hash
- `ProviderRegistrar.getProvider(providerId)` → TTL 60s

Caches are invalidated when config changes or seed reload occurs.

### Operation Classification

Every capability in `capability_taxonomy` has:
- `op_classification` — `'read' | 'write' | 'destructive' | 'navigate' | 'search'`
- `concurrency_safe` — can this capability run in parallel with others?
- `requires_user_confirmation` — must the user approve before execution?

These enable: auto-mode (auto-approve read-only), safety gating (warn on destructive), UI affordances (different buttons for different op types), and parallel scheduling (run all independent read capabilities simultaneously).

---

## See also

- `03-merged-schema.md` — Complete SQL schema (~54 tables, 9 views)
- `04-merged-engines.md` — Full engine specs (Governor through StreamBlockStore)
- `05-merged-lifecycles.md` — Lifecycle engine specs (Registration, Versioning, Telemetry, Memoizer)
