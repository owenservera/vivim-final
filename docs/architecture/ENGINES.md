# Architecture — Engines (zoom-in)

> Every engine's job + where its code lives. This is the **zoom-in** companion to
> `OVERVIEW.md`. Keep it a catalog of *what & where*, not a tutorial.
>
> **Original architecture:** 13 engines in layers (see `docs/` history /
> archived `merged-design-v2`). **Current reality:** the surface has grown far
> beyond 13 — engines now span capability, autonomy, memory, workspace, agent,
> and Chrome automation. This doc reflects the **current code**, organized by
> responsibility, not the original 13.

## Capability core (one entry point)

| Engine | Job | Code |
|--------|-----|------|
| **UnifiedCapabilityRegistry** | Single registry of every operation; CLI/frontend/API/MCP are thin shells through it | `src/engines/unified-registry.js` |
| CapabilityResolutionEngine | Resolves a provider/capability match | `src/engines/capability-resolution.js` |
| CapabilityEngine | Core capability CRUD/execution | `src/engines/capability.js` |
| CapabilityEventBus | Pub/sub between engines | `src/engines/capability-event-bus.js` |
| CapabilityMacroEngine / Composer | Compose/sequence capabilities | `.../capability-macro.js`, `capability-composer.js` |
| CapabilityBinder | Bind a capability to a provider context | `.../capability-binder.js` |
| NL catalog | NL phrases → capability ids (`catalog.ts`) | `src/engines/nlcl/` |

## Chrome automation (Governor Canon)

| Engine | Purpose | Code |
|--------|---------|------|
| **ChromeGovernor** | The ONLY CDP-touching module. Spawns/manages logged-in Chrome slaves, runs snapshot programs | `src/engines/chrome-governor.js` |
| **ConversationManager** | Provider-specific capture patterns; persists messages; auto-captures as Nodes | `src/engines/conversation-manager.js` |
| ProviderRegistrar | Registers provider manifests (`seeds/providers/manifests.ts`), wires parser fallbacks | `src/engines/provider-registrar.js` |
| ProviderHealthKernel | Health/readiness of provider surfaces | `src/engines/provider-health.js` |
| ProviderMuxEngine / CostOptimizer | Route a request across providers + cost-rational choice | `.../provider-mux.js`, `cost-optimizer.js` |

## Parser (DB-driven)

| Engine | Purpose | Code |
|--------|---------|------|
| **StreamParserEngine** | Loads parser `logic_code` from DB (inline, SandboxRunner), fallback chain `provider→generic→system` | `src/engines/stream-parser.js` |
| StreamBlockStore / ExecutionMemoizer | Store streamed blocks; dedupe/result-memoize | `.../stream-block-store.js`, `execution-memoizer.js` |

## Session / state / memory

| Engine | Purpose | Code |
|--------|---------|------|
| MemoryEngine | Emits `cap-store.memory` Nodes (FSRS-6) | `src/engines/memory-engine.js` |
| SessionCheckpoint / StateTransition | Session resume + state machine | `.../session-checkpoint.js`, `state-transition.js` |
| ConversationOrganizer | Group/organize conversations | `.../conversation-organizer.js` |
| ContextAssemblyEngine | Assemble context for a task | `.../context-assembly.js` |

## Autonomy / agent (grown surface)

| Engine | Purpose | Code |
|--------|---------|------|
| AgenticLoopEngine | The agent-as-runtime dev loop | `src/engines/agentic-loop.js` |
| AutonomousExecutionEngine / ReplayController | Plan→execute / replay | `src/engines/autonomous-execution.js`, `autonomous-replay.js` |
| GovernanceEngine / BudgetEngine / ObjectiveEngine | Agent policy, cost budget, objectives | `governance-engine.js`, `budget-engine.js`, `objective-engine.js` |
| AgentBuilderEngine | Compose agents | `src/engines/agent-builder.js` |
| AdaptiveWorkspaceEngine | Workspace modes/panels | `src/engines/adaptive-workspace.js` |

## Reliability / lifecycle / observability

| Engine | Purpose | Code |
|--------|---------|------|
| RegistrationAuditor / VersionManager | Capability/version lifecycle | `.../registration-auditor.js`, `version-manager.js` |
| TelemetryAggregator / ConfigManager | Telemetry retention; runtime config | `.../telemetry-aggregator.js`, `config-manager.js` |
| HealthDigest / ExecutionPolicy | Health digest; exec policy | `.../health-digest.js`, `execution-policy.js` |
| Reliability engine set | retry-engine, request-queue, idempotency-guard, lock-manager, fleet-supervisor, watchdog, SLA monitor, resilience-pipeline | `src/engines/*` (reliability) |
| BackupScheduler / DbEncryption | backup + at-rest encryption | `.../backup-scheduler.js`, `db-encryption.js` |

## Harness / resurrection

| Engine | Purpose | Code |
|--------|---------|------|
| HarnessRuntime / HarnessCheckpoint / HarnessCommand | Declarative command registry + repair + runtime | `src/engines/harness/` |
| HarnessRepairEngine / HarnessFeedbackCoordinator | Zod schema repair + escalating retry | `src/engines/harness-*` |

## Rule: keep this current

On any engine change: update its row (purpose one-liner, code path) in the same
PR. If an engine no longer exists, move its row to `docs/.archive/` (via
`.archive/`), don't leave ghosts here.

## Entry points that compose engines

- **Server**: `src/server/index.ts` → `bootstrap-engines.ts` (config → engines →
  caps → routes).
- **Barrel**: `src/index.ts` re-exports the public engine surface.
- **CLI**: `src/cli/index.ts` — thin client to a running server; routes via the
  capability registry.