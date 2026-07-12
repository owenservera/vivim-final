# PRD: Fully-Wired Kernel CLI + Oracle Integration

## Problem Statement

The system is designed as a sovereign AI operating system with the kernel as its self-aware meta-layer, but users cannot operate the entire system through a unified command interface. The Oracle (query/diagnostic/actuator/events) exists but is only used internally. The CLI can only run hardcoded domain commands, not arbitrary capabilities. There is no way to type natural language commands that route to the full Oracle or capability plane. This prevents the platform from being operable "as a full user" — users cannot discover, inspect, heal, or reprogram the entire system via commands or natural language.

## Solution

Create a unified command surface that exposes:
1. Every capability in the UnifiedCapabilityRegistry as a CLI command
2. The full Oracle (query, diagnostic, actuator, events) through CLI + NLCL
3. Frontend trigger points for all CLI/NLCL commands via vivim-canvas
4. Automatic capability discovery and loop-mode parsing for provider streaming protocols
5. **Full configuration control — every single configuration point of the entire system is readable and mutable** through the same surface: engine config, capability config, store config, route config, AutoHealPolicy, NLCL resolver config, stealth profiles, provider definitions, workflow definitions, canvas layer definitions, kernel topology, telemetry aggregation, and any future config scope.

The principle: **NOT JUST OPERATE — CONFIGURE.** A user (or an autonomous agent loop) must be able to inspect AND change any knob the system exposes, in real time, from the CLI, from natural language, and from the vivim-canvas frontend. This turns the platform from a fixed tool into a live, self-reprogrammable system where the oracle vision, telemetry, DB, and all engines are one configurable whole.

This enables operating AND configuring the system end-to-end via commands typed in the CLI or natural language ("talk to it like an LLM").

## User Stories

1. As a system operator, I want to type `vivim oracle query --op health` so that I can check the health of all engines in the kernel.
2. As a system operator, I want to type `vivim oracle query --op topology` so that I can see the full engine/capability topology.
3. As a system operator, I want to type `vivim oracle query --op capability --filter '{"layer":"oracle"}'` so that I can list all oracle-layer capabilities.
4. As a system operator, I want to type `vivim oracle heal --issueId stub:knowledge-ingestion:ping` so that I can auto-fix detected issues.
5. As a system operator, I want to type `vivim oracle scan` so that I can run a full diagnostic sweep.
6. As a system operator, I want to type `vivim oracle events --tail 20` so that I can see recent kernel events in real-time.
7. As a natural language user, I want to type `vivim nl "scan the system for problems"` so that the NLCL routes to OracleDiagnosticEngine.
8. As a natural language user, I want to type `vivim nl "show me the system topology"` so that the NLCL routes to OracleQueryEngine.
9. As a natural language user, I want to type `vivim nl "restart the stalled knowledge-ingestion engine"` so that the NLCL routes to OracleActuator.heal().
10. As a frontend user in vivim-canvas, I want to click a button that triggers `cap:canvas:observe --op oracle` so that I can see live system visibility in the UI.
11. As a frontend user, I want to click a button that triggers `cap:canvas:observe --op manifest` so that I can see the living manifest.
12. As a frontend user, I want to type into a chat interface "spawn a layer for chatgpt" and have it work so that natural language drives canvas capabilities.
13. As a system operator, I want any registered capability to automatically become a CLI command without manual registration so that the system is always fully operable.
14. As a system operator, I want `vivim capability list` so that I can discover all capabilities with their layers and surfaces.
15. As a system operator, I want `vivim capability info <id>` so that I can see a specific capability's input/output schemas.
16. As a system operator, I want a loop-mode protocol parser so that provider streaming protocols are automatically parsed in autonomous mode.
17. As a system operator, I want automatic capability discovery from provider endpoints so that new providers are scaffolded without manual stubs.
18. As a system operator, I want `vivim oracle policy get` so that I can read the AutoHealPolicy.
19. As a system operator, I want `vivim oracle policy set --stalled-restart true` so that I can enable/disable auto-healing.
20. As a system operator, I want `vivim oracle explain --target <traceId>` so that I can see causal chains for debugging.
21. As a system operator, I want `vivim oracle visibility` so that I can get OracleVisibility snapshot.
22. As a system operator, I want `vivim oracle manifest` so that I can build the CanvasManifest.

### Configuration (the "CONFIGURE" dimension — every knob reachable)

23. As a system operator, I want `vivim config list` so that I can enumerate every configuration point across all engines, capabilities, stores, routes, and policies.
24. As a system operator, I want `vivim config get <scope>.<key>` (e.g. `vivim config get engine:knowledge-ingestion.status`) so that I can read any single config value.
25. As a system operator, I want `vivim config set <scope>.<key> <value>` so that I can mutate any config value at runtime without restart.
26. As a system operator, I want `vivim config get autoheal` / `vivim config set autoheal.stalledEngineRestart.enabled false` so that I can toggle the Oracle's AutoHealPolicy live.
27. As a system operator, I want `vivim config get nlcl` / `vivim config set nlcl.aiFallback true` so that I can reconfigure the Natural Language Command Layer resolver live.
28. As a system operator, I want `vivim config get stealth` / `vivim config set stealth.canvasNoise.level high` so that I can tune the stealth profile for a running slave.
29. As a system operator, I want `vivim config get provider:<id>` / `vivim config set provider:<id>.<field>` so that I can edit any provider definition in place.
30. As a system operator, I want `vivim config get workflow:<id>` / `vivim config set workflow:<id>.steps` so that I can edit DAG workflows at runtime.
31. As a system operator, I want `vivim config get canvas:layer:<slug>` / `vivim config set canvas:layer:<slug>.bindings` so that I can edit canvas layer definitions live.
32. As a system operator, I want `vivim config get kernel:topology` so that I can inspect the live kernel topology config.
33. As a system operator, I want `vivim config get telemetry` / `vivim config set telemetry.pipeline.<stage> reprocess` so that I can reprogram the telemetry aggregation pipeline (the one `TelemetryAggregator.reprogram()` already supports).
34. As a natural language user, I want `vivim nl "disable auto-heal for stalled engines"` so that NLCL routes to `config set autoheal.stalledEngineRestart.enabled false`.
35. As a natural language user, I want `vivim nl "turn on AI fallback for NLCL"` so that NLCL routes to `config set nlcl.aiFallback true`.
36. As a frontend user in vivim-canvas, I want a config panel that lists every config scope with get/set controls so that I can configure the system from the UI exactly as from the CLI.
37. As a system operator, I want `vivim config diff` so that I can see config drift from the last persisted snapshot (enables safe autonomous reconfiguration + rollback).
38. As a system operator, I want `vivim config snapshot` / `vivim config rollback <id>` so that any autonomous reconfiguration loop can be audited and reversed.
39. As an autonomous loop, I want to read and write config through the same capability plane so that a testing/discovery loop can self-tune the system (e.g. raise LLM budget, enable a stealth module) without code changes.
40. As a system operator, I want config writes to be validated by Zod schema per scope so that bad values are rejected at the boundary, not at crash time.

## Implementation Decisions

### Core Modules

1. **KernelCLICommand** - New module registering kernel/oracle commands with the CLI.
   - Registers `oracle query`, `oracle heal`, `oracle scan`, `oracle events`, `oracle policy`, `oracle visibility`, `oracle manifest`.
   - Uses `kernel.context().oracle` reference exposed through ServerContext.

2. **NLCLKernelAdapter** - Bridge NLCL commands to kernel/oracle.
   - Maps natural language patterns like "scan the system", "show topology", "restart engine X" to OracleDiagnosticEngine/OracleActuator.
   - Extends the NLCL pattern catalog with kernel/system patterns.

3. **CapabilityAutoBridge** - Wire `syncCliFromUnified` at CLI startup.
   - Invoke `syncCliFromUnified(registry, cliRegistry)` after UnifiedCapabilityRegistry is constructed.
   - Ensures every capability gets a CLI command automatically.

4. **CanvasKernelActions** - Frontend hooks for kernel/oracle visibility.
   - Extend vivim-canvas with `cap:kernel:query`, `cap:kernel:heal`, `cap:kernel:visibility`.
   - Wire to frontend via existing canvas capability bridge.

5. **ProtocolLoopParser** - Autonomous protocol parser for streaming providers.
   - Replace stub in `AgenticLoopEngine.plan()` with real protocol parsing.
   - Parse provider streaming protocols in loop mode using HarnessProtocolEngine/ResponseExtractor.

6. **CapabilityDiscoveryLoop** - Auto-discover capabilities from providers.
   - Integrate with ProviderDiscoveryEngine and SemanticGroundingEngine.
   - Generate capability stubs automatically and register with UnifiedCapabilityRegistry.

7. **ConfigUniversalSurface** - Every configuration point reachable + mutable.
   - New module `ConfigUniversalSurface` that aggregates all config scopes: engine config, capability config, store config, route config, AutoHealPolicy, NLCL resolver config, stealth profiles, provider definitions, workflow definitions, canvas layer definitions, kernel topology, telemetry pipeline.
   - Backed by existing `ConfigManager` (in-memory store today) + `Prisma`-backed `ConfigStore` for persistence + `TelemetryAggregator.reprogram()` for the telemetry pipeline.
   - Exposes `list()`, `get(scope, key)`, `set(scope, key, value)` with Zod validation per scope.
   - `set` emits a `config:changed` event on `CapabilityEventBus` so the frontend/realtime telemetry reflects changes instantly.
   - `snapshot()` / `rollback(id)` for drift detection and safe autonomous reconfiguration.

8. **ConfigNLCLPatterns** - NLCL patterns routing phrases to `config get/set`.
   - "disable auto-heal" → `config set autoheal...`, "turn on AI fallback" → `config set nlcl...`, etc.
   - Reuses the same pattern catalog mechanism as `NLCLKernelAdapter`.

9. **CanvasConfigPanel** - Frontend config surface in vivim-canvas.
   - Exposes `cap:config:list`, `cap:config:get`, `cap:config:set` as capabilities (same plane as everything else).
   - Frontend renders a config tree with get/set controls, subscribed to `config:changed` for live updates.

### Interface Changes

- `UnifiedCapabilityRegistry.exportForCli()` already exists — returns capability name, description, schema for CLI registration.
- `ServerContext` already carries `kernel` — provide to CLI commands.
- `CapabilityEventBus` already carries `kernel:oracle` events — subscribe for real-time telemetry.
- `OracleVisibility` interface exists — expose via CLI `oracle visibility` command.
- `AutoHealPolicy` read/set already implemented in OracleActuator — expose via CLI.

### Technical Clarifications

- Kernel commands are CLI-only initially; NLCL patterns will be added in batch.
- Oracle heals are constrained by AutoHealPolicy (restart-engine, reset-circuit, reconfigure only when enabled).
- Frontend actions use existing canvas capability bridge - no new transport needed.
- Protocol parsing uses existing SemanticGroundingEngine and SelectorHealer - no new dependencies.

### Schema Changes

No new tables required. Oracle functionality already has backing tables (`kernel_spans`, `kernel_provenance`, `kernel_events`).

### API Contracts

- `POST /api/kernel/oracle/query` { type, filter?, limit? } → QueryResult
- `POST /api/kernel/oracle/heal` { issueId } → HealAction
- `POST /api/kernel/oracle/scan` → DiagnosticIssue[]
- `GET /api/kernel/oracle/events?limit=N` → OracleEvent[]
- `GET /api/kernel/oracle/visibility` → OracleVisibility
- `GET /api/kernel/oracle/manifest` → CanvasManifest
- `GET /api/kernel/oracle/policy` → AutoHealPolicy
- `PUT /api/kernel/oracle/policy` → AutoHealPolicy

## Testing Decisions

### What Makes a Good Test

- Test external behavior: CLI command produces correct output, NLCL pattern routes correctly.
- Do not test internal implementation details like registry state management.
- Test kernel/oracle integration at the command boundary.

### Modules to Test

1. **KernelCLICommand** - unit tests for each oracle CLI command.
2. **NLCLKernelAdapter** - unit tests for pattern matching to Oracle methods.
3. **CapabilityAutoBridge** - integration test verifying capabilities appear as CLI commands after startup.
4. **CanvasKernelActions** - integration test for frontend-triggered oracle visibility.
5. **ConfigUniversalSurface** - unit tests for list/get/set across every scope; integration test for `config:changed` event propagation; test Zod validation rejects bad values at the boundary.
6. **CanvasConfigPanel** - integration test for frontend config get/set via capability plane.

### Prior Art

- `tests/unit/engines/agentic-loop.test.ts` (referenced in 21.5.9 but MISSING — recreate).
- `tests/unit/canvas/canvas.test.ts` has `OracleReader` tests.
- `tests/integration/executor/fleet-integration.test.ts` shows how to test engine wiring.
- `src/cli/commands/*.ts` files show existing command patterns.

## Out of Scope

- Modifying kernel/oracle engine internals (they work as-is).
- Adding new Oracle diagnostic categories beyond the existing 6.
- Full MCP toolset for kernel (only CLI + NLCL in this PRD).
- Natural language patterns for capability authoring (only query/heal/visibility).
- UI for capability discovery (canvas-only visibility in this PRD).

## Further Notes

The core insight is that the kernel/oracle is structurally complete but has no user-facing surface. The `syncCliFromUnified` function exists but is never invoked. Wiring these two together achieves 90% of the goal. The remaining 10% is adding explicit kernel commands and NLCL patterns.

The `AutonomousExecutionEngine` already provides a working autonomous loop — the missing piece is `AgenticLoopEngine` which is a separate, unwired engine. Consider whether to wire `AgenticLoopEngine` to `AutonomousExecutionEngine` or keep them separate (current plan keeps them separate).
