# 01 — Merged Epic: cap-store v1 Knowledge Graph Rebuild

**Status:** FINAL — merged PRD
**Epic:** CAP-001
**Date:** 2026-07-09
**Covers:** Original `01-epic.md` + `pending-design/00-index.md`

---

## Goal

Rebuild cap-store as a **knowledge-graph architecture** where capabilities, providers, parsers, and bindings are rows in a database — not hardcoded `.ts` files. The system is fully re-programmable: configuration, not code, controls promotion rules, aggregation schedules, audit behavior, and health scoring. The ChromeGovernor is the single I/O authority — no engine touches Chrome or CDP directly. The harness inside Chrome is an agentic workflow runtime capable of executing multi-step capability DAGs with observation, branching, and progress streaming.

**Consumer vision:** An advanced agentic browser platform where users compose capabilities into workflows (n8n-style visual builder), and the system executes them autonomously inside Chrome with real-time observability and recovery.

---

## Why Rebuild

The current codebase has three fundamental problems:

| Problem | Detail |
|---------|--------|
| **42 migrations over 7 months** — schema drift | Migrations accumulated incrementally. Tables deleted and re-added. `provider_health` defined twice (lines 655 and 995). TypeScript types referencing tables that no longer exist. Impossible to create a new database from a single schema file. |
| **Provider logic in TypeScript source files** | `provider-config.ts` hardcodes selectors, auth selectors, and provider-specific behavior. Adding a new provider requires editing `.ts` engine code — not seeding a JSON manifest. |
| **3 parsing code paths** | `stream-parser.ts`, `gemini.ts`, and the content pipeline each parse responses differently. Adding a parser for a new provider means choosing one of three patterns, none of which are documented. |
| **45+ TypeScript errors** | `tsc --noEmit` fails. Types reference deleted tables (`ChromeProfile`, `RouteBinding`, `FleetSlaveState`). Engine constructors accept `BunCdpClient` directly. The codebase has drifted from its type definitions. |
| **CEBIT-12 CVE** | The `shell-command` function is `eval()` across 11 template files. Unsafe under all conditions. Must be replaced with parameterized SQL. |

---

## What Changes

| Area | Before | After |
|------|--------|-------|
| Provider configuration | Hardcoded in `provider-config.ts` DEFAULT_PROVIDER_CONFIGS | JSON seed files in `seeds/providers/`. `ProviderRegistrar` reads and writes to DB. |
| Parser configuration | Scattered across 3 files, 3 code paths | TypeScript seed files in `seeds/parsers/`. One interface: `ParserModule`. Loaded via dynamic `import()`. |
| Schema | 42 incremental migrations, ~57 tables | One baseline migration: `001_baseline.sql`. ~54 tables. All CREATE TABLE statements in one file. |
| CDP access | Every engine imports `BunCdpClient` directly | `ChromeGovernor` is the sole CDP authority. All engines call `governor.cdp.send()` or `governor.cdp.capture()`. |
| Fleet management | `fleet-supervisor.ts`, `profile-allocator.ts`, `launcher.ts`, `port-reaper.ts`, `account-registry.ts` — 5+ files | `ChromeGovernor.LifecycleManager` — one subsystem, public methods only. |
| Streaming | Real-time SSE block streaming | Batch-after-capture for v1. Full response buffered, parsed, emitted as single `conversation:complete` event. |
| Harness | Single `harness.ts` with no architecture | `HarnessRuntime` — modular capability runtime. Each capability slug maps to a harness module. Supports DAG execution, progress streaming, branching, retry. |
| Event system | `delta-pipeline.ts` broadcasts 4 event types to all WS subscribers | `CapabilityEventBus` — typed pub/sub, 15 event types, selective subscription by entity type + ID. |
| Health | `health/loop.ts` probes per-provider liveness via CDP | `ProviderHealthKernel` — weighted scoring from 6 signal sources, scheduled aggregation, event-driven real-time updates. |
| Telemetry | 9 raw tables, no aggregation | `TelemetryAggregator` — reprogrammable pipeline, time-series health/usage/selector data, retention policies. |
| Versioning | `promotion_history` as JSON TEXT blob | `VersionManager` — relational `binding_status_log`, `capability_taxonomy_version`, `program_version_metric`. Full rollback support. |
| Re-programability | None — behavior is code | `ConfigManager` — unified config persistence, validation, hot-reload, audit trail. All lifecycle engines are reprogrammable. |
| CLI | 30 files, hardcoded switch, cap-store-specific | Command registry pattern. Pipeline composition. Multi-subsystem bridging. Consistent output modes. |

---

## What's Preserved (Survivor Components)

These files survive from the current codebase without modification:

| File | Fate |
|------|------|
| `src/executor/cdp.ts` | Wrapped by Governor.CDPProxy. Not modified. |
| `src/executor/harness.ts` | Replaced by HarnessRuntime (new architecture). Old harness retired. |
| `src/executor/circuit-breaker.ts` | Used by Governor.HealthMonitor. Not modified. |
| `src/executor/async-mutex.ts` | Used by Governor + ConversationManager. Not modified. |
| `src/executor/fleet-config.ts` | Loaded by Governor. Not modified. |
| `src/executor/content-blocks.ts` | Exported as-is for parser seed files and API responses. Not modified. |
| `src/errors.ts` | Used by all engines. Not modified. |
| `src/config.ts` | Used by server. Not modified. |
| `src/executor/ids.ts` | ID derivation helpers. Not modified. |
| `src/state/engine.ts` | Session state machine. Ported to new schema. |
| `src/state/transitions.ts` | Transition rules. Ported. |
| `src/alerting/alerter.ts` | Alert condition engine. Ported. |
| `src/automation/scheduler.ts` | Automation schedule engine. Ported. |
| `src/router/` (dispatch, correlator, executor, tracker) | Multi-provider dispatch router. Ported. |

---

## Sub-Epics

| # | Sub-Epic | Covers | Depends on |
|---|---------|--------|-----------|
| SE-1 | **Baseline Schema** | `001_baseline.sql` with ~54 tables, 9 views. All indexes, CHECK constraints, FK cascades. Zero migrations. | — |
| SE-2 | **Provider Knowledge Graph** | 7 JSON manifests. ProviderRegistrar engine. `seeds/providers/` directory. | SE-1 |
| SE-3 | **ChromeGovernor + ConversationManager** | Single I/O authority. 4 internal subsystems. 8-step send pipe. | SE-1, SE-2 |
| SE-4 | **Core Engines** | StreamParserEngine, CapabilityEngine, CapabilityResolutionEngine, CapabilityEventBus, ProviderHealthKernel, StreamBlockStore. | SE-1, SE-2 |
| SE-5 | **Lifecycle Engines** | RegistrationAuditor, VersionManager, TelemetryAggregator. ConfigManager. | SE-1, SE-4 |
| SE-6 | **Server + SDK + CLI** | REST API, WebSocket, typed SDK client, command registry CLI. | SE-3, SE-4, SE-5 |
| SE-7 | **HarnessRuntime + Seed Files** | HarnessRuntime architecture, provider manifests, parser seed files, harness modules. | SE-1, SE-2 |

---

## Deliverable Map

| # | Document | Sub-Epic | Status |
|---|---------|----------|--------|
| 00 | `00-merged-index.md` | SE-1 (reference) | FINAL |
| 01 | `01-merged-epic.md` (this file) | SE-1 (reference) | FINAL |
| 02 | `02-merged-architecture.md` | SE-1 (reference) | FINAL |
| 03 | `03-merged-schema.md` | SE-1 | FINAL |
| 04 | `04-merged-engines.md` | SE-3, SE-4 | FINAL |
| 05 | `05-merged-lifecycles.md` | SE-5 | FINAL |
| 06 | `06-merged-seeds.md` | SE-2, SE-7 | FINAL |
| 07 | `07-merged-api.md` | SE-6 | FINAL |
| 08 | `08-merged-implementation.md` | SE-1 through SE-7 | FINAL |
| — | `seeds/providers/` (7 files) | SE-2 | FINAL (defined in doc 06) |
| — | `seeds/parsers/` (6 files) | SE-7 | FINAL (defined in doc 06) |
| — | `seeds/harness/` (5+ modules) | SE-7 | FINAL (defined in doc 06) |
| — | `src/engines/` (13 engines) | SE-3, SE-4, SE-5 | FINAL (defined in docs 04-05) |
| — | `src/schema/` (11 files) | SE-1 | FINAL (defined in doc 08) |
| — | `src/storage/` (16 files) | SE-1 | FINAL (defined in doc 08) |
| — | `src/server/` (5 files) | SE-6 | FINAL (defined in doc 08) |
| — | `sdk/src/` (3 files) | SE-6 | FINAL (defined in doc 08) |
| — | `tests/` (~20 files) | SE-1 through SE-7 | FINAL (defined in doc 08) |

---

## Exit Criteria

All must pass before shipping:

- [ ] `bunx tsc --noEmit` — zero errors
- [ ] `bun test` — all pass (target: ~120 tests)
- [ ] Multi-turn send/receive works for Claude, ChatGPT, Gemini (manual E2E)
- [ ] Concurrent sends to different providers work (manual E2E)
- [ ] `ProviderRegistrar.seedAll()` populates 7 providers from JSON manifests
- [ ] `ChromeGovernor.boot()` spawns Chrome, reaps ports, seeds accounts
- [ ] `ConversationManager.send(convId, msg)` completes full 8-step pipeline
- [ ] `CapabilityResolutionEngine.resolve(providerId, planTier)` returns correct UI contracts
- [ ] `CapabilityEventBus` delivers typed events to subscribers
- [ ] `ProviderHealthKernel` produces valid health reports for all providers
- [ ] All lifecycle engines are reprogrammable (config change takes effect on next cycle)
- [ ] Config changes are audited in `config_audit`
- [ ] `CapabilityEventBus` events are forwarded to WebSocket clients per subscription
- [ ] SDK client methods cover all REST endpoints
- [ ] CLI commands work for all subsystem bridges

---

## Out of Scope for v1

- Real-time SSE block streaming (conversation:block events)
- Visual flow builder (n8n-style UI)
- MCP server protocol implementation (design slot only)
- MCP client integration in harness (design slot only)
- Capability macros user-facing editor (design slot only)
- Capability auto-discovery (design slot only)
- Per-provider health dashboards (frontend work)
- User-authored capability filtering (beyond fixed business rules)
- File upload handling (streaming/multipart)
- Response caching (ETags, cache headers)
- Rate limiting

---

## See also

- `00-merged-index.md` — Master map, glossary, dependency graph
- `02-merged-architecture.md` — System design, engines, boot sequence
