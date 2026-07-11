# Atomic Glossary — Shared Terminology

## Core Concepts

| Term | Definition |
|------|-----------|
| **Governor** | Short for `ChromeGovernor` — the single I/O authority. All Chrome interaction flows through it. |
| **Governor.CDPProxy** | Internal subsystem that wraps BunCdpClient and exposes typed CDP operations. |
| **Governor.LifecycleManager** | Internal subsystem that spawns, kills, and ensures Chrome instances. |
| **Governor.TraceLog** | Internal subsystem that records every CDP operation to `trace_entry`. |
| **Governor.HealthMonitor** | Internal subsystem that probes Chrome liveness. |
| **HarnessRuntime** | Server-side orchestrator that executes capability DAGs via atomic CDP commands. |
| **HarnessDAG** | A directed acyclic graph of capability steps. Supports Sequence, Branch, Parallel, and Retry nodes. |
| **HarnessModule** | A capability-specific module loaded by HarnessRuntime. One capability slug = one module. |
| **ConversationManager** | 8-step pipeline: RESOLVE→LOCK→ENSURE→SEND→CAPTURE→PARSE→STORE→EMIT. |
| **ContentBlock** | Typed block from provider responses: text, code, thinking, artifact, image, citation, tool_use, error, meta. |
| **CapabilityResolutionEngine** | Read-only SQL engine that resolves capability UI contracts with 3-layer override chain. |
| **CapabilityEventBus** | In-process typed pub/sub. Publishers emit; subscribers receive only subscribed events. |
| **ProviderHealthKernel** | Scheduled aggregation engine — weighted health score from 6 signal sources. |
| **RegistrationAuditor** | Audits every manifest change, detects drift between seeds and DB. |
| **VersionManager** | Manages capability version chains, promotion audit, program metrics, rollback. |
| **TelemetryAggregator** | Reprogrammable aggregation pipeline — health/usage/selector data on schedule. |
| **ConfigManager** | Unified re-programability framework. Single authority for all engine configs. |
| **StreamBlockStore** | Thin persistence engine for ContentBlock[] — batched INSERT, paginated retrieval. |
| **Re-programmable** | Engine behavior changeable at runtime via config update. No restart. Next cycle applies changes. |
| **Store Contract** | Typed interface that an engine requires from storage. Enables mock-based testing. |
| **Slave** | A running Chrome instance managed by the Governor. Unique `slaveId` = provider_id + account_id. |
| **Capability** | Atomic user action (send message, select model, upload file). Has 21-field UI contract. |
| **Plan Tier** | Account billing tier: `free`, `pro`, `max`, `enterprise`. Gates capability availability. |

## Sovereign AI OS Upgrade Terms (Phases 14-20)

| Term | Definition |
|------|-----------|
| **CDPTransport** | Abstraction layer over BunCdpClient. Provides typed CDP operations without direct Chrome dependency. |
| **KnowledgeIngestionEngine** | Imports conversation history from external providers (ChatGPT, Claude, Gemini) into local database. |
| **KnowledgeExtractor** | Extracts facts, decisions, patterns, and entities from conversation text. |
| **SemanticSearchEngine** | Vector-based semantic search over conversation history using embeddings. |
| **CrossConversationSynthesisEngine** | Synthesizes insights across multiple conversations to find patterns and themes. |
| **ProviderMuxEngine** | Multi-provider multiplexer — distributes requests across providers with round-robin, failover, cost optimization. |
| **CostOptimizer** | Minimizes API costs by routing requests to cheapest capable provider within latency budgets. |
| **SituationDetector** | Detects current conversation situation (coding, research, writing, debugging) for context assembly. |
| **ContextAssemblyEngine** | 5-stage pipeline: detect situation → select context → assemble prompt → allocate tokens → validate. |
| **UnifiedCapabilityRegistry** | Single registry exposing all capabilities across CLI, API, and UI. |
| **PluginHotReload** | Hot-reload system for capability plugins without server restart. |
| **AdaptiveWorkspaceEngine** | Adapts workspace layout and available tools based on current task and user preferences. |
| **ConversationOrganizer** | Organizes conversations into projects, topics, and tags for knowledge management. |
| **AutonomousExecutionEngine** | Full autonomous execution with HITL gates, self-healing, and observability. |
| **ExecutionPolicyEngine** | Defines policies for what actions can be executed autonomously vs. requiring human approval. |
| **EncryptionEngine** | AES-256-GCM encryption for all data at rest. Wraps SQLite writes with encryption layer. |
| **AirGapEngine** | Air-gap mode — blocks all outbound network calls, serves from local data and local models only. |
| **LocalModelAdapter** | Integrates Ollama/llama.cpp for local inference when air-gap mode is enabled. |
| **SyncEngine** | E2E-encrypted sync between VIVIM instances. Uses EncryptionEngine for all payloads. |
| **TelemetryAuditEngine** | Zero-cloud proof — intercepts and logs all outbound requests for compliance audit. |

## Schema Layers

| Layer | Name | Tables |
|-------|------|--------|
| L0 | Bookkeeping | schema_meta, migration_log |
| L1 | Provider KG | provider_definition, endpoint, parser, capability, config, model, account |
| L2 | Trace | trace_entry |
| L3 | Capability System | capability_taxonomy, tier, binding, program, selector_strategy, outcome |
| L4 | State & Session | vivim_session, provider_session, profile_session, conversation, message, state_transition, checkpoint, stream_block |
| L5 | Registration Lifecycle | provider_manifest_version, registration_event, manifest_drift |
| L6 | Versioning Lifecycle | capability_taxonomy_version, binding_status_log, program_version_metric |
| L7 | Telemetry Lifecycle | provider_health_history, capability_telemetry, selector_health_history, telemetry_summary_daily, manifest_change_log, telemetry_cycle_log |
| L8 | Config | config_entry, config_audit |
| L9 | Harness | harness_checkpoint, capability_macro |
| L10 | MCP | mcp_server_config |
| L11 | Operations | health_tick, circuit_breaker_state, drift_event, fleet_event, provider_health, automation_schedule, automation_run, alert_condition, alert_event, route_spec, route_request, route_target, route_event |
| L12 | Transfer & Learning | transfer_pattern, transfer_candidate, transfer_attempt, learning_event, rule, binding_event, failure_classification |
| L13 | Testing | test_run |
| L14 | Sovereign Intelligence | import_job, knowledge_entity, knowledge_decision, knowledge_pattern, embedding, memory_organization |
| L15 | Mux & Routing | mux_session, mux_strategy, cost_record, routing_preference |
| L16 | Context | context_snapshot, situation_log, token_budget, prewarming_cache |
| L17 | Workspace | workspace_mode, conversation_project, conversation_topic, plugin_manifest |
| L18 | Autonomous | execution_plan, execution_step, hitl_approval, self_healing_log, observability_span |
| L19 | Sovereign Data | encryption_key, airgap_config, sync_payload, telemetry_audit_log |

## Key Validation Commands

```powershell
bun run typecheck           # TypeScript check (tsc --noEmit)
bun test                    # All tests
bun test tests/unit/<path>  # Targeted tests
bun run lint                # Biome lint
bun run format              # Biome format
bun run prisma:generate     # Regenerate Prisma client
bun run prisma:push         # Push schema to SQLite
```
