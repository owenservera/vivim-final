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
