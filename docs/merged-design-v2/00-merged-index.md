# 00 — Merged Index: cap-store v1 Knowledge Graph Rebuild

**Status:** FINAL — merged PRD
**Epic:** CAP-001
**Date:** 2026-07-09

---

## Document Map

| # | Document | Covers | Est. Size |
|---|---------|--------|-----------|
| 00 | `merged-index.md` (this file) | Master map, dependency graph, glossary, reading order, contradiction resolution | ~3k words |
| 01 | `merged-epic.md` | Why rebuild, what changes, what survives, sub-epics, deliverable map, exit criteria | ~4k words |
| 02 | `merged-architecture.md` | 9 principles, 13 engines, boot sequence, Governor canon, module layout, MCP slot, cross-cutting concerns | ~6k words |
| 03 | `merged-schema.md` | Complete copy-paste SQL: ~54 tables, 9 views, all indexes, CHECK constraints, FK cascades, seed data | ~12k words |
| 04 | `merged-engines.md` | 9 core engines: full TypeScript interfaces, store contracts, execution flows, error handling, integration examples | ~10k words |
| 05 | `merged-lifecycles.md` | 3 lifecycle engines (RegistrationAuditor, VersionManager, TelemetryAggregator) + ExecutionMemoizer: full types, configs, flows, examples | ~8k words |
| 06 | `merged-seeds.md` | Provider manifest JSON schema + 7 full provider manifests, parser seed file contract + 6 parser files, harness module contract + example module | ~8k words |
| 07 | `merged-api.md` | Complete REST endpoints (25+), Zod schemas, SDK client interface + types, WebSocket event catalog, 21-field UI contract, CLI registry, config API, error envelope | ~10k words |
| 08 | `merged-implementation.md` | 6-phase plan with file manifests (CREATE/PORT/DELETE), test plan (~120 tests), risk assessment, doc alignment checklist | ~7k words |
| **SOTA** | **`sota-00-master-index.md`** | **SOTA v2 enhancement suite:** delta map, principle revisions, contradiction resolutions, 17 new engines | — |
| SOTA-01 | `sota-01-priority-pipe-mirror.md` | **P1:** MirrorEngine, ObservationTap, optimistic updates, latency budgets, time-travel snapshots | P1 |
| SOTA-02 | `sota-02-shape-agnostic-registration.md` | **P2:** CapabilityShapeRegistry, ProviderDiscoveryEngine, ManifestInferenceEngine, polymorphic resolution, plugin system | P2 |
| SOTA-03 | `sota-03-agentic-observation-loop.md` | AgenticLoopEngine (sense->plan->act->observe->reflect->adapt), ToolUseProtocol, LLM planning | P3 |
| SOTA-04 | `sota-04-visual-workflow-engine.md` | n8n-clone: WorkflowEngine, WorkflowCompiler, 5 node categories, human-in-the-loop, webhook triggers | P3 |
| SOTA-05 | `sota-05-semantic-browser-automation.md` | SemanticGroundingEngine, SelectorHealer, ARIA/visual grounding, shadow DOM, anti-detection stealth | P3 |
| SOTA-06 | `sota-06-memory-learning-substrate.md` | MemoryEngine (episodic/semantic/procedural), TransferAccelerator, consolidation schedule | P4 |
| SOTA-07 | `sota-07-schema-streaming-mcp-delta.md` | Complete SQL delta (~27 new tables), progressive streaming protocol, MCP server + client adapters wired | P4 |
| SOTA-08 | `sota-08-implementation-glossary-delta.md` | Phases 7-10 plan, 29-engine catalog, SOTA glossary, risk assessment delta, final summary | — |
| SOTA-09 | `sota-09-harness-protocol-engine.md` | **P1:** Harness Protocol Engine — bidirectional LLM⇄harness bridge, PromptAugmenter (harness context injection), ResponseExtractor (fuzzy JSON repair + multi-strategy extraction), ActionRouter (validate + route to Governor/CapEngine/AgenticLoop/WF), execution feedback loop | P1 |

---

## Engine → Document Cross-Reference

| Engine | Purpose | Defined in |
|--------|---------|-----------|
| `ChromeGovernor` | Single I/O authority for all Chrome interaction (CDP, spawn/kill, trace, health) | `04-merged-engines.md` §1 |
| `ConversationManager` | 8-step live interaction pipeline (send, capture, parse, store, emit) | `04-merged-engines.md` §2 |
| `StreamParserEngine` | Parse provider API responses into ContentBlock[] | `04-merged-engines.md` §3 |
| `CapabilityEngine` | Execute capabilities via CDP (through Governor) | `04-merged-engines.md` §4 |
| `ProviderRegistrar` | Seed provider knowledge graph from JSON manifests | `04-merged-engines.md` §5 |
| `CapabilityResolutionEngine` | Resolve capability UI contracts with override chain + filtering | `04-merged-engines.md` §6 |
| `CapabilityEventBus` | Typed in-process pub/sub for all engine-to-engine + frontend events | `04-merged-engines.md` §7 |
| `ProviderHealthKernel` | Weighted health score aggregation from 6 signal sources | `04-merged-engines.md` §8 |
| `StreamBlockStore` | Persist and retrieve ContentBlock[] with pagination | `04-merged-engines.md` §9 |
| `RegistrationAuditor` | Audit every manifest change, detect drift, answer "who changed what" | `05-merged-lifecycles.md` §1 |
| `VersionManager` | Version chains, promotion audit, program metrics, rollback | `05-merged-lifecycles.md` §2 |
| `TelemetryAggregator` | Reprogrammable aggregation pipeline (health, selector, capability, daily) | `05-merged-lifecycles.md` §3 |
| `ConfigManager` | Unified re-programability framework; single authority for all engine configs | `02-merged-architecture.md` §Cross-Cutting |

---

## Table → Document Cross-Reference

| Table | Layer | Defined in |
|-------|-------|-----------|
| `schema_meta` | L0 Bookkeeping | `03-merged-schema.md` |
| `migration_log` | L0 Bookkeeping | `03-merged-schema.md` |
| `provider_definition` | L1 Provider KG | `03-merged-schema.md` |
| `provider_endpoint` | L1 Provider KG | `03-merged-schema.md` |
| `provider_parser` | L1 Provider KG | `03-merged-schema.md` |
| `provider_capability` | L1 Provider KG | `03-merged-schema.md` |
| `provider_config` | L1 Provider KG | `03-merged-schema.md` |
| `provider_model` | L1 Provider KG | `03-merged-schema.md` |
| `provider_account` | L1 Provider KG | `03-merged-schema.md` |
| `trace_entry` | L2 Trace | `03-merged-schema.md` |
| `capability_taxonomy` | L3 Capability System | `03-merged-schema.md` (21 UI fields + 9 new columns) |
| `capability_tier` | L3 Capability System | `03-merged-schema.md` |
| `capability_binding` | L3 Capability System | `03-merged-schema.md` |
| `capability_program` | L3 Capability System | `03-merged-schema.md` |
| `selector_strategy` | L3 Capability System | `03-merged-schema.md` |
| `outcome` | L3 Capability System | `03-merged-schema.md` |
| `vivim_session` | L4 State & Session | `03-merged-schema.md` |
| `provider_session` | L4 State & Session | `03-merged-schema.md` |
| `profile_session` | L4 State & Session | `03-merged-schema.md` |
| `conversation` | L4 State & Session | `03-merged-schema.md` |
| `conversation_message` | L4 State & Session | `03-merged-schema.md` |
| `state_transition` | L4 State & Session | `03-merged-schema.md` |
| `session_checkpoint` | L4 State & Session | `03-merged-schema.md` |
| `stream_block` | L4 State & Session | `03-merged-schema.md` |
| `provider_manifest_version` | L5 Registration Lifecycle | `03-merged-schema.md` |
| `registration_event` | L5 Registration Lifecycle | `03-merged-schema.md` |
| `manifest_drift` | L5 Registration Lifecycle | `03-merged-schema.md` |
| `capability_taxonomy_version` | L6 Versioning Lifecycle | `03-merged-schema.md` |
| `binding_status_log` | L6 Versioning Lifecycle | `03-merged-schema.md` |
| `program_version_metric` | L6 Versioning Lifecycle | `03-merged-schema.md` |
| `provider_health_history` | L7 Telemetry Lifecycle | `03-merged-schema.md` |
| `capability_telemetry` | L7 Telemetry Lifecycle | `03-merged-schema.md` |
| `selector_health_history` | L7 Telemetry Lifecycle | `03-merged-schema.md` |
| `telemetry_summary_daily` | L7 Telemetry Lifecycle | `03-merged-schema.md` |
| `manifest_change_log` | L7 Telemetry Lifecycle | `03-merged-schema.md` |
| `telemetry_cycle_log` | L7 Telemetry Lifecycle | `03-merged-schema.md` |
| `config_entry` | L8 Config | `03-merged-schema.md` |
| `config_audit` | L8 Config | `03-merged-schema.md` |
| `harness_checkpoint` | L9 Harness | `03-merged-schema.md` |
| `capability_macro` | L9 Harness | `03-merged-schema.md` |
| `mcp_server_config` | L10 MCP | `03-merged-schema.md` |
| `health_tick` | L11 Operations | `03-merged-schema.md` |
| `circuit_breaker_state` | L11 Operations | `03-merged-schema.md` |
| `drift_event` | L11 Operations | `03-merged-schema.md` |
| `fleet_event` | L11 Operations | `03-merged-schema.md` |
| `provider_health` | L11 Operations | `03-merged-schema.md` |
| `automation_schedule` | L11 Operations | `03-merged-schema.md` |
| `automation_run` | L11 Operations | `03-merged-schema.md` |
| `alert_condition` | L11 Operations | `03-merged-schema.md` |
| `alert_event` | L11 Operations | `03-merged-schema.md` |
| `route_spec` | L11 Operations | `03-merged-schema.md` |
| `route_request` | L11 Operations | `03-merged-schema.md` |
| `route_target` | L11 Operations | `03-merged-schema.md` |
| `route_event` | L11 Operations | `03-merged-schema.md` |
| `transfer_pattern` | L12 Transfer & Learning | `03-merged-schema.md` |
| `transfer_candidate` | L12 Transfer & Learning | `03-merged-schema.md` |
| `transfer_attempt` | L12 Transfer & Learning | `03-merged-schema.md` |
| `learning_event` | L12 Transfer & Learning | `03-merged-schema.md` |
| `rule` | L12 Transfer & Learning | `03-merged-schema.md` |
| `binding_event` | L12 Transfer & Learning | `03-merged-schema.md` |
| `failure_classification` | L12 Transfer & Learning | `03-merged-schema.md` |
| `test_run` | L13 Testing | `03-merged-schema.md` |

Views: `v_coverage_by_provider`, `v_failure_distribution`, `v_recent_outcomes`, `v_strategy_success`, `v_catalog_summary`, `v_outcome_stream_metrics`, `v_provider_surface`, `v_parser_confidence`, `v_capability_ui_audit` — `03-merged-schema.md` §Views.

**Total: ~54 tables, 9 views.**

---

## Reading Order for Implementing Agent

### v1 Baseline (CAP-001)
1. **`00-merged-index.md`** (this file) — understand the map
2. **`01-merged-epic.md`** — understand why we're rebuilding
3. **`02-merged-architecture.md`** — understand the system design
4. **`03-merged-schema.md`** — copy the SQL, create the database
5. **`06-merged-seeds.md`** — create seed files (providers, parsers, harness modules)
6. **`04-merged-engines.md`** — implement core engines (Governor -> ConversationManager -> parsers -> resolution -> event bus -> health -> blocks)
7. **`05-merged-lifecycles.md`** — implement lifecycle engines (RegistrationAuditor -> VersionManager -> TelemetryAggregator -> ExecutionMemoizer)
8. **`07-merged-api.md`** — implement REST API, SDK, WebSocket, CLI
9. **`08-merged-implementation.md`** — follow phase plan, run tests, ship

### v2 SOTA Enhancement (CAP-002)
10. **`sota-00-master-index.md`** — understand the SOTA delta map, revised principles, contradiction resolutions
11. **`sota-01-priority-pipe-mirror.md`** — implement MirrorEngine (Priority #1)
12. **`sota-02-shape-agnostic-registration.md`** — implement shape-agnostic registration (Priority #2)
13. **`sota-03-agentic-observation-loop.md`** — implement agentic loop
14. **`sota-04-visual-workflow-engine.md`** — implement workflow engine
15. **`sota-05-semantic-browser-automation.md`** — implement semantic grounding
16. **`sota-06-memory-learning-substrate.md`** — implement memory engine
17. **`sota-07-schema-streaming-mcp-delta.md`** — apply schema delta, streaming, MCP
18. **`sota-08-implementation-glossary-delta.md`** — follow SOTA phase plan (phases 7-10)
19. **`sota-09-harness-protocol-engine.md`** — implement Harness Protocol Engine (cross-cutting: augment all prompts, normalize all responses)

---

## Architecture Decisions

### D1: Batch-Only Streaming for v1

**Decision:** Responses are buffered, parsed, and emitted as a single `conversation:complete` event per send. Real-time block-level streaming is deferred to v2.

**Rationale:** The current SSE streaming infrastructure (stream-capture.ts, stream-reconstructor.ts, stream-detector.ts) adds complexity without consumer value at v1. The ConversationManager captures the full response via CDP, parses it into ContentBlock[], and stores it atomically. The frontend receives a single `conversation:complete` WebSocket event with the full message.

**What changes:** All `conversation:block` WS event references are removed. `conversation:complete` is the sole delivery event.

### D2: Aggressive Schema Deletion

**Decision:** Delete 22 tables from the current ~57-table schema. These are: 5 duplicates, 7 unengineered tables (no engine reads them), 6 legacy tables (old architecture), 4 others.

**Rationale:** Reduce surface area. Every table requires migrations, storage methods, SDK types, and test coverage. Tables with no engine consumers are dead weight.

**What survives:** ~37 base tables, plus 13 new lifecycle tables, plus 4 new design-slot tables = ~54 tables total.

### D3: TypeScript Parser Seed Files

**Decision:** All parser seed files are `.ts` (TypeScript), loaded via dynamic `import()`. No `.js` files. No `parser_logic_type` distinction — all are file-based.

**Rationale:** The `parser_logic_type` CHECK constraint ('file'/'inline'/'composed') was designed for three loading paths. In practice, only 'file' was ever used. TS files enable type checking, IDE autocomplete, and Zod validation at seed time.

**What changes:** `provider_parser.parser_logic_type` default changed to `'file'` (CHECK constraint removed — only one valid value). All parser files use the `ParserModule` TypeScript interface.

---

## Terminology Glossary

| Term | Definition |
|------|-----------|
| **Governor** | Short for `ChromeGovernor` — the single I/O authority. All Chrome interaction flows through it. |
| **Governor.CDPProxy** | Internal subsystem that wraps BunCdpClient and exposes typed CDP operations. The only place CDP commands are sent. |
| **Governor.LifecycleManager** | Internal subsystem that spawns, kills, and ensures Chrome instances. Absorbs fleet-supervisor, profile-allocator, launcher, port-reaper. |
| **Governor.TraceLog** | Internal subsystem that records every CDP operation to `trace_entry`. |
| **Governor.HealthMonitor** | Internal subsystem that probes Chrome liveness. |
| **HarnessRuntime** | The JavaScript engine that runs inside Chrome's page context. Executes capability DAGs, captures DOM state, streams progress. |
| **HarnessDAG** | A directed acyclic graph of capability steps sent from Governor.CDPProxy to HarnessRuntime. Supports Sequence, Branch, Parallel, and Retry nodes. |
| **HarnessModule** | A capability-specific JS module loaded by HarnessRuntime. Each capability slug maps to one harness module. |
| **ConversationManager** | The 8-step thin pipeline that orchestrates a single send: RESOLVE→LOCK→ENSURE→SEND→CAPTURE→PARSE→STORE→EMIT. |
| **ContentBlock** | A typed block extracted from provider API responses: text, code, thinking, artifact, image, citation, tool_use, error, meta. |
| **CapabilityResolutionEngine** | Read-only SQL engine that resolves capability UI contracts with the 3-layer override chain: global defaults → plan tier overrides → provider overrides. |
| **CapabilityEventBus** | In-process typed pub/sub. Publishers emit typed events; subscribers receive only events they've subscribed to. |
| **ProviderHealthKernel** | Scheduled aggregation engine that computes a weighted health score from 6 signal sources. |
| **RegistrationAuditor** | Reprogrammable engine that audits every manifest change and detects drift between seed files and the database. |
| **VersionManager** | Reprogrammable engine that manages capability version chains, binding promotion audit, and program version metrics. |
| **TelemetryAggregator** | Reprogrammable aggregation pipeline that runs on a schedule, queries raw data sources, and produces time-series health/usage/selector data. |
| **ConfigManager** | Unified re-programability framework. Single authority for all engine config persistence, validation, audit, and hot-reload. |
| **StreamBlockStore** | Thin persistence engine for ContentBlock[] — batched INSERT, paginated retrieval. |
| **Re-programmable** | An engine whose behavior can be changed at runtime by updating its config. No restart required. Config changes take effect on the next cycle. |
| **Store Contract** | A typed interface that an engine requires from the storage layer. Enables mock-based testing. |
| **Capability DAG** | A directed acyclic graph of capability steps. The execution format for HarnessRuntime. Future visual flow builder produces this format. |
| **Slave** | A running Chrome instance managed by the Governor. Each slave has a unique `slaveId` derived from provider_id + account_id. |
| **Capability** | An atomic user action: send a message, select a model, upload a file. Defined in `capability_taxonomy` with a 21-field UI contract. Capabilities are bound to providers via `capability_binding` and executed by CDP programs. |
| **Plan Tier** | Account billing tier: `free`, `pro`, `max`, `enterprise`. Gates capability availability and UI contract overrides. |

---

## Engine Dependency Graph

```
                    ┌──────────────────────┐
                    │    Provider Seeds     │
                    │   (JSON manifests)    │
                    └──────────┬───────────┘
                               │
                               ▼
                    ┌──────────────────────┐
                    │   ProviderRegistrar  │◄──── ConfigManager
                    └──────────┬───────────┘
                               │ writes to DB
                               ▼
          ┌────────────────────┼────────────────────┐
          │                    │                    │
          ▼                    ▼                    ▼
┌─────────────────┐  ┌─────────────────┐  ┌──────────────────┐
│CapabilityResol- │  │  ChromeGovernor │  │ StreamBlockStore │
│ utionEngine     │  │                 │  │                  │
│ (read-only SQL) │  │ LifecycleMgr──►│  │ (write-only)     │
│                 │  │ CDPProxy──────►│  │                  │
│  depends on:    │  │ TraceLog──────►│  │  depends on:     │
│  • taxonomy     │  │ HealthMonitor─►│  │  • stream_block   │
│  • binding      │  │                 │  │  • conversation   │
│  • tier         │  │  depends on:    │  └──────────────────┘
│  • prov_cap     │  │  • account      │
└────────┬────────┘  │  • fleet_event  │
         │           └────────┬───────┘
         │                    │
         ▼                    ▼
┌─────────────────────────────────────────────────────┐
│               ConversationManager                    │
│                                                     │
│  8-step pipe:                                       │
│  RESOLVE→LOCK→ENSURE→SEND→CAPTURE→PARSE→STORE→EMIT │
│                                                     │
│  depends on:                                        │
│  • CapabilityResolutionEngine (step 1)              │
│  • ChromeGovernor (steps 3-5)                       │
│  • StreamParserEngine (step 6)                      │
│  • StreamBlockStore (step 7)                        │
│  • CapabilityEventBus (step 8)                      │
└─────────────────────────────────────────────────────┘
                               │
                               ▼
                    ┌──────────────────────┐
                    │  CapabilityEventBus  │
                    │  (transient events)  │
                    └──────────┬───────────┘
                               │
               ┌───────────────┼───────────────┐
               │               │               │
               ▼               ▼               ▼
    ┌──────────────────┐ ┌──────────┐ ┌──────────────────┐
    │ProviderHealthKernel│ │TraceLog │ │ WebSocket Bridge │
    │ (scheduled agg)   │ │(persist)│ │ (frontend)       │
    │                   │ │         │ │                  │
    │ subscribes to:    │ │ subs:   │ │ subscribes to:   │
    │ • confidence_chgd │ │ • exec  │ │ • all (per client │
    │ • slave_status    │ │ • fail  │ │   subscription)  │
    │ • selector_drift  │ │         │ │                  │
    └──────────────────┘ └──────────┘ └──────────────────┘

 ┌──────────────────────────────────────────────────────┐
 │                 Lifecycle Engines                     │
 │                                                      │
 │  RegistrationAuditor ──── triggered by ProviderRegistrar
 │  VersionManager ───────── triggered by execution outcomes
 │  TelemetryAggregator ──── scheduled (timer/event/hybrid)
 │  ExecutionMemoizer ────── cross-cutting (caches resolution, health, parsers)
 │                                                      │
 │  All depend on:                                      │
 │  • ConfigManager (reprogrammable config)             │
 │  • CapabilityEventBus (event emission)               │
 └──────────────────────────────────────────────────────┘
```

---

## Contradiction Resolution Table

These 11 contradictions were found across the 25 source documents and resolved before producing these merged documents:

| # | Contradiction | Source A | Source B | Resolution |
|---|--------------|----------|----------|------------|
| 1 | Streaming scope: real-time vs batch | Doc 02 says "real-time streaming is future feature" | Doc 10 has `conversation:block` WS events (FR-27/28) | **Batch only.** Remove all `conversation:block` references. Only `conversation:complete` fires. |
| 2 | Parser file format: .js vs .ts | Doc 06 says `.js` | D3 says `.ts` | **TypeScript.** All parser files are `.ts`, loaded via `import()`. |
| 3 | Schema size: ~57 vs ~37 tables | Doc 03 has ~57 tables | D2 deletes 22 tables | **~54 tables.** 37 base + 13 lifecycle + 4 design-slots. |
| 4 | FleetSupervisor → ChromeGovernor | Doc 05 references FleetSupervisor | Doc 02-pending replaces it with ChromeGovernor | **ChromeGovernor.** FleetSupervisor absorbed into LifecycleManager subsystem. |
| 5 | SendFlow → ConversationManager | Doc 05 has SendFlow.send() | Doc 03-pending has ConversationManager | **ConversationManager.** SendFlow → ConversationManager with 8-step thin pipe. |
| 6 | Direct CDP access | Doc 05 engines take `BunCdpClient` directly | Doc 02-pending says only Governor touches CDP | **Governor only.** All CDP goes through `ChromeGovernor.CDPProxy`. |
| 7 | CapabilityEngine vs ResolutionEngine | Doc 05 has `execute()` + `detectLogin()` in same engine | Doc 04-pending has separate CapabilityResolutionEngine | **Split.** CapabilityEngine = execution (CDP-driven). CapabilityResolutionEngine = read-only (SQL). |
| 8 | Engine count: 5 vs 10+ | Doc 05 lists 5 engines | Pending-design adds 7+ | **13 engines** total (9 core + 3 lifecycle + ConfigManager). |
| 9 | `parser_logic_type` CHECK | Doc 03 has CHECK for 'file'/'inline'/'composed' | D3 says all are file-based | **Remove CHECK.** Default 'file'. No engine uses inline or composed. |
| 10 | `provider_health` duplicate | Doc 03 has two CREATE TABLEs | D2 deletes legacy duplicates | **Keep only one.** Remove the duplicate CREATE TABLE. |
| 11 | Harness as black box | No architecture for harness | vCode analysis reveals HarnessRuntime pattern | **HarnessRuntime designed.** Capability modules, DAG executor, telemetry, progress streaming. |
| 12 | Event catalog: SOTA event types missing from v1 `CapabilityEvent` union | `04-merged-engines.md` defines 17 v1 event types | SOTA-01/04/05/09 define ~25 additional event types not in the union | **Resolved 2026-07-09.** All SOTA event types added to `CapabilityEvent` union + publisher table in `04-merged-engines.md`. |
| 13 | `capability:selector_drifted` has no v1 publisher | Event exists in v1 catalog | No engine listed as publisher in v1 publisher table | **Resolved 2026-07-09.** `ChromeGovernor.CDPProxy` + `CapabilityEngine` assigned as publishers. Event emitted when `missCount > threshold` during execution. |
| 14 | `ConversationManager` references `conv.plan_tier` — column doesn't exist on `conversation` table | Step 1 (RESOLVE) uses `conv.plan_tier` | `conversation` table has no `plan_tier` column; it lives on `provider_account` | **Resolved 2026-07-09.** RESOLVE step now joins through `provider_session → provider_account.plan_tier`. `ConversationStore.getAccount()` added. |
| 15 | `capability_taxonomy_version` duplicates all 30+ columns from `capability_taxonomy` | Table replicates every taxonomy column | VersionManager needs snapshots but schema drift is a maintenance risk | **Resolved 2026-07-09.** Replaced with `snapshot_json TEXT` + `changed_fields_json TEXT`. Single blob per version, no column duplication. |
| 16 | Selector health denormalized across `selector_strategy` + `provider_capability` | Both tables track hit/miss counts | No engine specified for aggregation | **Resolved 2026-07-09.** Source of truth = `selector_strategy`. `TelemetryAggregator.aggregateSelectorHealth()` materializes to `provider_capability` on scheduled cycle. |
| 17 | `hpe_config` table bypasses `ConfigManager` | SOTA-09 defines separate config table | v1 architecture uses `config_entry` for universal config | **Resolved 2026-07-09.** `hpe_config` table removed. HPE stores config via `ConfigManager.getConfig('HarnessProtocolEngine')` in `config_entry`. |
| 18 | `provider_session.provider_id` is a redundant denormalized FK | Both direct FK and account→provider FK exist | No constraint enforcing consistency | **Resolved 2026-07-09.** Column preserved for fast joins but documented as denormalized. Application-layer enforcement noted. |
| 19 | `hpe_session` stores raw prompts/responses as permanent TEXT | 10MB/day of unbounded growth | No retention policy, contains potentially sensitive user data | **Resolved 2026-07-09.** 30-day default retention added. `TelemetryAggregator` runs weekly purge cycle. |

---

## How to Use These Docs

### For an implementing AI agent (v1 baseline):

1. Read documents in order (00->01->02->03->06->04->05->07->08).
2. Every code block is copy-paste ready: SQL, TypeScript interfaces, Zod schemas, JSON manifests.
3. Every engine has a complete TypeScript interface — implement against it, mock the store contract for testing.
4. Every table has a complete CREATE TABLE statement with indexes, CHECK constraints, and FK cascades.
5. Every API endpoint has a complete handler template.
6. The implementation plan (doc 08) has explicit file manifests — which files to CREATE, PORT, or DELETE per phase.
7. No forward references exist. Each document references only concepts defined within itself or in earlier documents.

### For an implementing AI agent (v2 SOTA enhancement):

1. Read **`sota-00-master-index.md`** first — understand what the SOTA suite adds/changes/supersedes.
2. Then read SOTA-01 through SOTA-08 in order.
3. Each SOTA doc is a **delta** over v1 — it says what to ADD, MODIFY, or SUPERSEDE.
4. Where a v1 doc and a SOTA doc conflict, the **SOTA doc wins**.
5. All new interfaces are spec-language (TypeScript notation as contract, not implementation).
6. All new tables have complete CREATE TABLE statements in **SOTA-07**.
7. The SOTA phase deltas (**SOTA-08**) slot into the existing 6-phase plan as phases 7-10.

### For a human reviewer:

**v1 baseline:**
1. Start with the epic (01) for context.
2. Review the architecture (02) for system design validation.
3. Review the schema (03) for data model correctness.
4. Review engines (04-05) for interface contracts.
5. Review seeds (06) for provider manifest completeness.
6. Review API (07) for endpoint coverage and type safety.
7. Review implementation (08) for execution feasibility.

**v2 SOTA enhancement:**
1. Start with SOTA-01 and SOTA-02 (the two priorities).
2. Review SOTA-03 for agentic loop soundness.
3. Review SOTA-04 for workflow engine completeness.
4. Review SOTA-07 for schema correctness.
5. Review SOTA-08 for execution feasibility.

---

## See also

- `01-merged-epic.md` — Why rebuild, what changes
- `02-merged-architecture.md` — System design, principles, boot sequence
- `03-merged-schema.md` — Complete SQL schema
- `sota-00-master-index.md` — **SOTA v2 enhancement suite master index** (CAP-002, extends this v1 baseline rather than replacing it)
