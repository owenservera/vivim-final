# vivim-final — Architecture, Design & Core Frameworks

> Comprehensive single-source reference for the **vivim-final** codebase: the cap-store v1 Knowledge
> Graph Rebuild — a local-first AI conversation platform built on **Bun + Prisma + TypeScript**,
> with a server-side **Chrome slave / mirroring** layer, a **capability-driven harness**, and a
> **capability-aware frontend**.
>
> Scope: codebase layout, design principles, the 13+ engine layer, the Chrome Governor
> (slave lifecycle + CDP + mirroring), the harness runtime/protocol, the UI⇄Chrome Mirror
> pipe, the frontend/automation surface, and the CLI/SDK.

---

## 1. System at a Glance

```
                         Seed Files (seeds/)
   providers/*.json • parsers/*.ts • harness/*.ts • automation/*.ts
                                  │
                                  ▼
        ┌──────────────────────────────────────────────────┐
        │   SQLite (Prisma) — ~54 tables, 9 views, WAL    │  ◄─ Knowledge Graph
        │   relational-first, foreign keys + cascades        │     (ground truth)
        └──────────────────────────────────────────────────┘
                                  │
                                  ▼
        ┌──────────────────────────────────────────────────┐
        │                Engines (13 + extensions)            │
        │  ChromeGovernor • ConversationManager • StreamParser │
        │  Capability • CapabilityResolution • CapabilityEventBus │
        │  ProviderRegistrar • ProviderHealthKernel • StreamBlockStore │
        │  RegistrationAuditor • VersionManager • TelemetryAggregator │
        │  ConfigManager • ExecutionMemoizer                    │
        │  + MirrorEngine • HarnessRuntime • HarnessProtocolEngine │
        │  + ObservationTap • AgenticLoop • MemoryEngine • …   │
        └──────────────────────────────────────────────────┘
                                  │
                                  ▼
        ┌──────────────────────────────────────────────────┐
        │              Presentation / Client Layer             │
        │  REST (Bun.serve) • WebSocket (typed events) • CLI │
        │  SDK client • web/ui (ActionRegistry) • web/sandbox     │
        │  web/api-client (typed contract) • web Tauri webview   │
        └──────────────────────────────────────────────────┘
```

**Core thesis:** capabilities, providers, parsers, bindings, selectors, models, endpoints,
configs, routes, and transfers are **rows in a database**, not hardcoded TypeScript. The
database is the runtime ground truth; seed files are the source of truth that populate it.

---

## 2. Design Principles (the 9 invariants)

| # | Principle | Meaning |
|---|-----------|---------|
| **P1** | Knowledge Graph | No provider behavior is hardcoded. A new provider = a new JSON manifest in `seeds/providers/`. |
| **P2** | Single I/O Authority (Governor Canon) | **Only `ChromeGovernor` touches CDP.** No engine imports `BunCdpClient`. No engine spawns/kills Chrome. |
| **P3** | Seeds Not Code | Provider config, parser logic, harness modules are seed files (`.json`/`.ts`). `POST /api/admin/seed` reloads without restart. |
| **P4** | Engines Are Unit-Testable | Every engine depends only on **store contracts** (typed interfaces). Tests mock the contract; prod binds `bun:sqlite`. |
| **P5** | Batch-After-Capture Streaming | v1 buffers the full provider response, parses to `ContentBlock[]`, emits one `conversation:complete`. Block-level SSE is v2. |
| **P6** | Relational First | All relations are FKs with cascading deletes. No JSON-in-TEXT for queryable data. `JOIN`, not `JSON.parse`. |
| **P7** | Re-Programmable | Lifecycle engines read behavior from `ConfigManager`-persisted config. Change config → change behavior next cycle. Audited. |
| **P8** | Capability-Driven UI | Every capability has a 21-field UI contract. Frontend renders what it receives — no conditional render logic. |
| **P9** | Agentic Harness | `HarnessRuntime` runs **server-side** (Node/Bun), never injected into Chrome's page context. Sends atomic CDP commands one at a time. |

Hard enforcements (from `AGENTS.md`):
- **A (Ground Truth):** research report before `[~]`; classification mandatory.
- **B (Architectural):** no engine imports `BunCdpClient`; no `-impl` imports; seeds not code; relational first; config via `ConfigManager`; harness server-side; no raw `new Error()`.
- **C (Planning):** phase gates; atomic specs; design-doc reference.
- **D (Quality):** engine tests with mocked stores; no `any` in engines; barrel exports.

---

## 3. Tech Stack & Tooling

| Concern | Choice |
|----------|--------|
| Runtime | **Bun** (`bun run`, `bun test`) |
| Language | **TypeScript** strict mode, ESNext target, ESM + `.js` import extensions |
| ORM | **Prisma v6.5** (SQLite, WAL mode, `foreign_keys=ON`) |
| Lint/Format | **Biome v1.9** |
| Git Hooks | **Lefthook** |
| Build | **tsup** (ESM + DTS) |
| IDs | **ULID** (`src/ids.ts`) |
| Validation | **Zod** at boundaries (see `src/schema/validators.ts`) |
| Storage access | **Store contracts** (`src/storage/contracts/*`) — engines never import `storage/impl/*` |
| Frontend | **React + TypeScript** (`web/ui`, `web/sandbox`), **Tailwind** in sandbox, **Tauri webview** target |
| HTTP | `Bun.serve` REST + native WebSocket; typed `ApiClient` in `web/api-client` |

Path aliases: `@/*` → `./src/*`. Commands: `bun run dev`, `bun test`,
`bun run typecheck`, `bun run lint`, `bun run migrate`, `bun run seed`, `bun run devops`.

---

## 4. Directory Layout

```
vivim-final/
├── prisma/
│   ├── schema.prisma            ◄─ ~54 tables, relations, indexes
│   └── seed.sql                ◄─ CHECK constraints, 9 views, seed data
├── seeds/
│   ├── providers/*.json         ◄─ provider KG manifests (claude, chatgpt, gemini, …)
│   ├── parsers/*/*.ts          ◄─ SSE/batch parser seeds
│   ├── harness/*.ts            ◄─ composer / login / navigation / capture / selector modules
│   └── automation/*.ts        ◄─ automation schedule seeds
├── src/
│   ├── schema/                 ◄─ Zod/Domain types (core, chrome, provider, routing,
│   │                            session, streaming, learning, transfer, automation, health,
│   │                            telemetry, versioning, config, harness, types, validators)
│   ├── storage/
│   │   ├── db.ts / prisma.ts / open.ts
│   │   ├── contracts/*.ts       ◄─ store interfaces (engines depend ONLY on these)
│   │   └── impl/*.ts           ◄─ concrete Prisma bindings (never imported by engines)
│   ├── engines/                ◄─ 13 base engines + extensions (see §6)
│   ├── executor/               ◄─ survivors: cdp, circuit-breaker, async-mutex,
│   │                            fleet-config, fleet-supervisor, laucher, port-reaper,
│   │                            profile-allocator, content-blocks, ids
│   ├── cli/                    ◄─ command registry, pipeline engine, bridges
│   ├── router/                 ◄─ REST router + index (Bun.serve)
│   ├── automation/             ◄─ scheduler (L11 operations)
│   ├── alerting/               ◄─ alerter
│   ├── config.ts / errors.ts / ids.ts / index.ts
├── sdk/                       ◄─ typed TS SDK client + tests
├── web/                       ◄─ frontend surface (see §9)
│   ├── ui/                     ◄─ ActionRegistry + AgentBridge (capability actions)
│   ├── sandbox/                ◄─ React dev/test surface for capabilities
│   └── api-client/            ◄─ typed HTTP client + Zod contracts
├── tests/  unit/ · integration/ · e2e/
├── docs/    merged-design-v2/ · roadmap/ · atomic/ · goals/ · decisions/
└── devops/ · migrations/ · chrome-profiles/
```

---

## 5. Knowledge Graph (the data model)

The relational core lives in `prisma/schema.prisma`. The capability system — the heart of
the product — is modeled in `src/schema/core.ts`:

| Entity | Role |
|---------|------|
| `CapabilityTaxonomy` | A capability (21-field UI contract: uiComponent, uiPosition, uiOrder, uiStates, inputSchema, mutationEffects, opClassification, requiresUserConfirmation, concurrencySafe, minPlanTier, dependsOn, …). |
| `Binding` | Provider↔Capability link with `status` (`broken`/`flaky`/`prospect`/`retired`/`stable`/`test-1`/`test-2`) and a promotion history + confidence score. |
| `Program` | Versioned execution program for a binding (`version`, `isActive`, `configJson`, `supersededBy`). |
| `Outcome` | A single execution result (ok, durationMs, confidence, selectorUsed, selectorHit). Feeds the promotion loop. |
| `SelectorStrategy` | CSS/XPath/text/aria/data/regex/composite selectors with hit/miss counters — the selector healer's raw material. |

Supporting graphs: provider accounts, conversation messages, `stream_block`, health signals,
telemetry pipelines, version chains, config entries+audit, automation schedules, MCP server
config (design slot), mirror/observation state.

**Relational-first rule:** every relationship is a JOIN. `binding_status_log` replaces the old
`promotion_history` JSON blob; `capability_taxonomy_version` replaces the scalar `version`.

---

## 6. Engine Layer

### 6.1 The 13 base engines

| Engine | Purpose | Key deps | File |
|--------|---------|-----------|------|
| `ChromeGovernor` | **Single I/O authority for Chrome** (4 subsystems) | `db`, `config`, `eventBus` | `chrome-governor.ts` |
| `ConversationManager` | 8-step send pipeline | `governor`, `resolution`, `parser`, `blocks`, `eventBus`, `db` | `conversation-manager.ts` |
| `StreamParserEngine` | Parse provider responses → `ContentBlock[]` | `store`, `config` | `stream-parser.ts` |
| `CapabilityEngine` | Execute capabilities via CDP | `governor`, `store`, `eventBus` | `capability.ts` |
| `ProviderRegistrar` | Seed provider KG from JSON | `store`, `auditor?` | `provider-registrar.ts` |
| `CapabilityResolutionEngine` | Resolve capability UI contracts | `store` | `capability-resolution.ts` |
| `CapabilityEventBus` | Typed in-process pub/sub (singleton) | — | `capability-event-bus.ts` |
| `ProviderHealthKernel` | Weighted health-score aggregation | `store`, `governor`, `eventBus` | `provider-health.ts` |
| `StreamBlockStore` | Persist/retrieve `ContentBlock[]` | `db` | `stream-block-store.ts` |
| `RegistrationAuditor` | Audit manifest changes, detect drift | `store`, `configManager`, `eventBus?` | `registration-auditor.ts` |
| `VersionManager` | Version chains, promotion audit | `store`, `configManager`, `eventBus?` | `version-manager.ts` |
| `TelemetryAggregator` | Reprogrammable aggregation pipeline | `store`, `eventBus?`, `configManager` | `telemetry-aggregator.ts` |
| `ConfigManager` | Unified re-programability framework | `store`, `eventBus?` | `config-manager.ts` |
| `ExecutionMemoizer` | TTL cache for expensive computations | — | `execution-memoizer.ts` |

### 6.2 Extended engines (SOTA layer)

| Engine | Purpose | File |
|--------|---------|------|
| `MirrorEngine` | Bidirectional UI⇄Chrome sync, optimistic updates, latency budget | `mirror-engine.ts` |
| `HarnessRuntime` | Server-side capability DAG executor | `harness-runtime.ts` |
| `HarnessProtocolEngine` | LLM↔harness bridge (PromptAugmenter, ResponseExtractor, ActionRouter) | `harness-protocol-engine.ts` |
| `ObservationTap` | Non-blocking CDP observation session (DOM/network/console) | `observation-tap.ts` |
| `AgenticLoop` | Observation→reason→act agentic control loop | `agentic-loop.ts` |
| `MemoryEngine` | Learning substrate (rules, binding events) | `memory-engine.ts` |
| `SemanticGrounding` / `SelectorHealer` / `ProviderDiscovery` / `ManifestInference` | Grounding, selector repair, discovery, manifest inference | `*.ts` |
| `WorkflowEngine` / `WorkflowCompiler` / `CapabilityMacro` | Composable workflows & macros | `*.ts` |
| `TransferAccelerator` / `ToolUseProtocol` / `StreamingProtocol` | Cross-provider transfer, tool use, progressive streaming | `*.ts` |
| `PluginSystem` / `SessionCheckpoint` / `HarnessCheckpoint` / `StateTransition` / `CapabilityShapeRegistry` | Extensibility & state management | `*.ts` |
| `McpServerAdapter` / `McpClientAdapter` | MCP protocol adapters (design slot) | `*.ts` |

---

## 7. ChromeGovernor — the Chrome Slave / Mirroring System

This is the **core framework for Chrome control**. Per **P2 (Governor Canon)**, it is the
**only** component that speaks CDP. Every other engine calls `governor.cdp.*`,
`governor.lifecycle.*`, `governor.health.*`. It is mockable in tests (no real Chrome).

Defined in `src/engines/chrome-governor.ts` (708 LOC) and `src/executor/*`.

### 7.1 Public API

```ts
class ChromeGovernor {
  boot(db): void                         // reap orphan ports, seed accounts, start health/trace
  launch(providerId, opts): ChromeSlave  // spawn a Chrome "slave"
  kill(slaveId): void
  ensureRunning(slaveId): ChromeSlave
  captureConversation(slaveId): CaptureResult
  getHealth(slaveId): SlaveHealth
  getTrace(slaveId): TraceEntry[]
  getAllSlaves(): ChromeSlave[]
  getSlave(slaveId): ChromeSlave | null
}
```

### 7.2 The four subsystems

```
                  ┌──────────────────────────────────────────────┐
                  │               ChromeGovernor                 │
   ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
   │ LifecycleMgr  │  │   CDPProxy    │  │   TraceLog   │  │ HealthMonitor │
   └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘
```

**① LifecycleManager** (`src/executor/launcher.ts`, `profile-allocator.ts`, `port-reaper.ts`,
`fleet-supervisor.ts`, `fleet-config.ts`, `slave-write.ts`)
- `spawn()` — detect Chrome binary, derive debug port from `portRange`, allocate a
  per-account `profile_dir`, launch Chrome with `--remote-debugging-port`.
- `kill()` — CDP `Browser.close`, process kill, port reaping.
- `ensure()` — liveness check, restart if dead (respects `autoRestart`/`maxRestarts`).
- `deriveProfile()` / `allocatePort()` / `seedAccounts()` / `reapOrphanPorts()`.

A **ChromeSlave** is the unit of control:
```ts
interface ChromeSlave {
  slaveId: string; providerId: string; accountId: string;
  debugPort: number; profileDir: string;
  status: 'starting'|'running'|'stopping'|'stopped'|'error'|'crashed';
  superState: 'idle'|'sending'|'capturing'|'parsing'|'authenticating'|'error';
  pid: number | null;
  consecutiveFailures: number;
  circuitState: 'closed'|'half_open'|'open';
  lastHealthCheck: number;
}
```

**② CDPProxy** (`src/executor/cdp.ts`, `async-mutex.ts`, `circuit-breaker.ts`)
- `send(slaveId, method, params)` — `Runtime.evaluate`, `Input.dispatchKeyEvent`,
  `Page.navigate`, `Input.insertText`, …
- `capture(slaveId, pattern, timeout)` — `Network.responseReceived` + `getResponseBody`.
- `executeHarnessPlan(slaveId, dag)` — Node-side DAG orchestration, one atomic CDP
  command per step (never blocks Chrome's event loop).
- `getPageState()` / `captureScreenshot()`.
- **Concurrency control:** each slave owns a **per-slave AsyncMutex**. Parallel sends to
  *different* slaves are OK; two sends to the *same* slave serialize.

**③ TraceLog** — every CDP command/response traced to `trace_entry` (engine, method,
requestId, conversationId, accountId, providerId, durationMs, ok, error). Correlates
with `capability:executed`/`capability:failed` events.

**④ HealthMonitor** — probes liveness via `Browser.getVersion` every `healthProbeIntervalMs`,
updates `ChromeSlave.status`, manages the **per-slave CircuitBreaker**
(`circuit-breaker.ts`), emits `fleet:slave_status` and `fleet:circuit_changed`.

### 7.3 The anti-detection invariant

The **only** script injected into Chrome is the stealth/anti-detection script via
`Page.addScriptToEvaluateOnNewDocument` (SOTA-05). It runs once on page load (~10ms), sets
fingerprint masking, and exits. **No execution logic lives in the browser.**

---

## 8. Harness — Capability-Driven Automation

### 8.1 HarnessRuntime (server-side orchestrator)

`src/engines/harness-runtime.ts`. Receives a **capability DAG** and executes it step by
step by sending atomic CDP commands through the Governor. Chrome's main thread is never
blocked for more than a single CDP op (~ms).

**DAG node types:**
```ts
type HarnessNode =
  | { type:'sequence';  steps: HarnessNode[] }
  | { type:'branch';    condition: HarnessCondition; then; alternative? }
  | { type:'parallel';  steps: HarnessNode[] }
  | { type:'retry';     maxRetries; backoffMs; step }
  | { type:'precondition'; checks: string[]; step }
  | { type:'step'; moduleId; input; outputKey }
```
`HarnessCondition` = `selector_exists` | `url_matches` | `text_contains` | `variable`.

`executeNode` recurses through the DAG: sequence (in order), parallel (`Promise.all`),
branch (evaluate condition → then/else), retry (backoff loop), step (run a registered
`HarnessModule`). Each step emits `capability:progress` + telemetry events
(`selector_hit`/`selector_miss`/`dom_interaction`/`network_intercept`/`error`).

**HarnessModule** is a composable server-side function:
```ts
interface HarnessModule {
  name: string; version: number;
  inputSchema: unknown; outputSchema: unknown;
  preconditions: string[]; postconditions: string[];
  execute(input, ctx: HarnessContext): Promise<HarnessModuleResult>;
}
```
Harness seeds (`seeds/harness/*.ts`): `composer`, `login`, `navigation`, `capture`,
`selector` — each orchestrates CDP primitives (`focusElement`+`insertText`+`pressEnter`, …).

### 8.2 HarnessProtocolEngine (LLM↔harness bridge)

`src/engines/harness-protocol-engine.ts`. Subsystems:
- **PromptAugmenter** — augments the LLM prompt with available capabilities, current page
  state, valid selectors, recent actions, execution outcomes.
- **ResponseExtractor** — extracts `contentBlocks` + `actions` (`HarnessAction`) from the LLM.
- **ActionRouter** — routes actions to capability execution / DAG steps / agentic goals /
  workflow calls / observation requests / data transforms.

`HarnessProtocolConfig` drives approval policy: `llmRepairEnabled`,
`autoApproveReadOps`, `autoApproveWriteOps`, `requireApprovalDestructive`, `maxFeedbackActions`.

---

## 9. MirrorEngine — the UI⇄Chrome Mirror Pipe

`src/engines/mirror-engine.ts`. **SOTA-01 (P1: the single most important optimization
surface).** Sits between frontend and ChromeGovernor, providing:

1. **Bidirectional real-time state sync** — UI mirrors Chrome; Chrome reflects UI actions.
2. **Optimistic updates** — UI updates instantly on action; Chrome catches up async.
3. **Live observation stream** — DOM mutations, network, console streamed in real time.
4. **Latency budget enforcement** — per-stage budgets; violations → degraded mode.
5. **Snapshot / time-travel** — scrub Chrome history per conversation.
6. **Action priority queue** — user > recovery > background.
7. **Frictionless input** — typing/paste/drag-drop/IME in UI → Chrome with fidelity.
8. **Progressive output** — Chrome response → UI block-by-block.
9. **State projection** — Chrome raw state projected into UI-consumable shape.
10. **Action recording** — every UI→Chrome action recorded for replay/workflow extraction.

**Store contract** (`MirrorStore`): `getMirrorState`/`upsertMirrorState`,
`createOptimisticUpdate`/`resolveOptimisticUpdate`, `recordLatency`/`getLatencyReport`,
`createSnapshot`/`getSnapshots`/`getSnapshotAt`, `createObservationEvent`/`getObservationEvents`.

**Latency budgets (p95 targets):**
`resolve 5ms` · `lock 0ms` · `ensure 2000ms` · `send 500ms` · `capture 30000ms (max)`
· `parse 200ms` · `store 10ms` · `emit 5ms` → **total p95 ≈ 3300ms**.

**ObservationTap** (`src/engines/observation-tap.ts`) — a *separate* CDP session from the
command channel, so it never interferes with execution. It only **subscribes** to
`dom_mutation` / `network_event` / `console_log` / `page_lifecycle` events — it never
sends state-mutating CDP commands (preserves the Governor canon).

**Frictionless input fidelity:** the UI composer *is* Chrome's composer, projected via
MirrorEngine. There is no separate "UI state" vs "Chrome state" for input — only Chrome
state, mirrored to the UI. Eliminates sync drift.

### 9.1 ConversationManager 8-step thin pipe

```
send(conversationId, message)
  [1] RESOLVE  → CapabilityResolutionEngine.resolve(providerId, planTier)
  [2] LOCK     → Governor mutex (concurrency)
  [3] ENSURE   → Governor.ensureRunning(slaveId)  (tab focused, page loaded)
  [4] SEND     → Governor.cdp.executeHarnessPlan(slaveId, dag)
  [5] CAPTURE  → Governor.captureConversation(slaveId)  (raw SSE/JSON/HTML body)
  [6] PARSE    → StreamParserEngine.parse(rawBody, providerId) → ContentBlock[]
  [7] STORE    → ConversationStore.createMessage + StreamBlockStore.storeBlocks
  [8] EMIT     → CapabilityEventBus.emit('conversation:complete', …) → WS bridge
```
v1 = **batch-after-capture**: one `conversation:complete` event. Block-level
`conversation:block` streaming is deferred to v2 (SOTA-07 `StreamingProtocol`).

---

## 10. Frontend / Automation Surface

### 10.1 `web/api-client` (typed contract)
Zod-validated `ApiClient` exposing `listProviders`, `listCapabilities`,
`conversationCapabilities`, `createConversation`, … against `/api`. Ships `CapabilityUIContract`
(21-field contract) and `ResolvedCapabilities` types so any frontend renders by contract
(P8).

### 10.2 `web/ui` (ActionRegistry + AgentBridge)
Capability-aware action layer:
- `actions/registry.ts` — `ActionRegistry` with Zod-validated `ActionSpec`
  (`register`/`dispatch`/`list`/`listWithMetadata`); dispatch parses params then runs.
- `actions/agent-bridge.ts` — `AgentBridge` connecting UI actions to the agentic/LLM layer.

### 10.3 `web/sandbox` (React dev surface)
Vite + React + Tailwind test harness that renders backend capabilities natively:
- `app/sandbox-app.tsx` — header + `CapabilityCatalog` + `CapabilityHarness`.
- `features/capability-catalog.tsx` / `capability-harness.tsx` — browse + drive a capability.
- `store/capability-store.ts` — Zustand-style store (selected capability, loaders).

**Note:** This sandbox is the *frontend-native test surface*. The production shell targets a
**Tauri v2 webview** sidecar (per P9, harness runs server-side in the Tauri sidecar, never
in Chrome's page context).

### 10.4 Automation (`src/automation/scheduler.ts`)
`AutomationScheduler` — time/event-driven runner (L11 Operations). `ScheduleType` =
`cron` | `interval` | `event`. Persisted via `AutomationStore` (schedules + runs with
status `running`/`completed`/`failed`). v1 cron parsing is a stub; interval parsing is live.
Wired to `CapabilityEventBus` so schedules can be triggered by events.

### 10.5 Agentic layer
`agentic-loop.ts` (`AgenticLoop`) drives observe→reason→act against the harness;
`memory-engine.ts` records `LearningEvent`/`Rule`/`BindingEvent` for the learning substrate
(SOTA-06). `alerting/alerter.ts` surfaces alert conditions.

---

## 11. CLI & SDK

**CLI** (`src/cli/`): `command-registry.ts`, `pipeline-engine.ts` (Unix-style
`cmd1 | cmd2 | cmd3`), `output-formatter.ts` (`--json`/`--pretty`/`--table`/`--watch`),
`bridges/` (`cap-store-bridge` HTTP, `backend-bridge` Rust, `extension-bridge` native
messaging). Commands: `providers`, `fleet`, `conversations`, `admin`, `config`, `health`,
`version`, `telemetry`, `system`.

**SDK** (`sdk/`): typed TS client mirroring the REST surface; `bun test` coverage in
`sdk/tests/`.

---

## 12. Boot Sequence

```
openDb()                              ◄─ WAL + 001_baseline migration + schema_meta
  → CapabilityEventBus (singleton)
  → ConfigManager (load persisted configs, apply defaults, subscribe reprograms)
  → Engines in dependency order:
        StreamBlockStore → StreamParserEngine → CapabilityResolutionEngine
      → CapabilityEngine → ProviderRegistrar → RegistrationAuditor
      → VersionManager → TelemetryAggregator → ExecutionMemoizer
      → ChromeGovernor.boot()  (reap ports, seed accounts, start HealthMonitor, TraceLog)
      → ProviderHealthKernel.start()  (aggregation loop)
      → ConversationManager
  → TelemetryAggregator.start()         (schedules per triggerMode)
  → Bun.serve :9420                  (ConversationRouter + WS bridge + AuthGate)
  → listening — CLI & SDK may connect
```

---

## 13. Cross-Cutting Frameworks

- **ConfigManager** — single authority. Engines `registerSchema(engineId, Zod, defaults)`,
  then `getConfig`/`updateConfig` (audited in `config_audit`), `reloadConfig`. Hot-reload
  via `config:changed` subscription.
- **ExecutionMemoizer** — TTL caches: `resolve` 5s, `getHealth` 30s, `loadParser`
  (file-hash memoized), `getProvider` 60s. Invalidated on config change / seed reload.
- **Operation classification** — every capability carries `opClassification`
  (`read`/`write`/`destructive`/`navigate`/`search`), `concurrencySafe`,
  `requiresUserConfirmation` → drives auto-approve, safety gating, parallel scheduling.
- **MCP design slot** — `mcp_server_config` table exists; `McpServerAdapter`/`McpClientAdapter`
  translate MCP tool calls to Governor API (v2).

---

## 14. How the Pieces Fit (end-to-end)

```
UI (web/ui ActionRegistry / sandbox)
   │  MirrorAction (optimistic, priority-queued)
   ▼  WebSocket  ───────────────────────────────────────┐
MirrorEngine (sync, latency budget, snapshots)            │
   │  wraps ConversationManager.send()                   │
   ▼                                                      │
ConversationManager (8-step pipe)                         │  CapabilityEventBus
   │  [4] SEND → Governor.cdp.executeHarnessPlan(dag)  │  (typed pub/sub)
   ▼                                                      │
ChromeGovernor                                            │
   ├─ CDPProxy     → atomic CDP commands → Chrome slave  │
   ├─ LifecycleMgr → spawn/kill/ensure slaves            │
   ├─ HealthMonitor→ circuit breaker per slave           │
   └─ ObservationTap→ live DOM/network/console (sep session)
   │  [5] CAPTURE → raw response body                  │
   ▼                                                      │
StreamParserEngine → ContentBlock[]                       │
   │  [7] STORE (ConversationStore + StreamBlockStore)  │
   ▼                                                      │
conversation:complete ───────────── WS bridge ──────────┘→ UI renders, resolves optimistic
```
All Chrome state flows through the Governor; the UI is a live mirror of Chrome state; the
harness orchestrates capability DAGs server-side; the knowledge graph in SQLite is the
ground truth that every engine reads and writes.

---

*Generated from `docs/merged-design-v2/*` (00–08, SOTA-00–09) and the live `src/`,
`web/`, `seeds/`, `prisma/` trees in `vivim-final`.*
