# Core Engines Reference

## Implemented Engines (Phase 4)

| Engine | File | Purpose |
|--------|------|---------|
| StreamParserEngine | src/engines/stream-parser.ts | Parse streaming responses into blocks |
| CapabilityEngine | src/engines/capability.ts | UnifiedCapability definition + execution |
| CapabilityResolutionEngine | src/engines/capability-resolution.ts | Resolve capabilities with fallback chains |
| ProviderHealthKernel | src/engines/provider-health.ts | Health checks + circuit breaker |
| VersionManager | src/engines/version-manager.ts | Schema version management |
| TelemetryAggregator | src/engines/telemetry-aggregator.ts | Metrics aggregation |
| HarnessRuntime | src/engines/harness-runtime.ts | Browser automation runtime |

## Session & State Engines

| Engine | File | Purpose |
|--------|------|---------|
| ConversationManager | src/engines/conversation-manager.ts | 8-step conversation pipeline |
| StreamBlockStore | src/engines/stream-block-store.ts | Content block persistence |

## Chrome Layer

| Engine | File | Purpose |
|--------|------|---------|
| ChromeGovernor | src/engines/chrome-governor.ts | CDP proxy + slave lifecycle |
| FleetSupervisor | src/executor/fleet-supervisor.ts | Fleet state machine |

## Cross-cutting Engines

| Engine | File | Purpose |
|--------|------|---------|
| CapabilityEventBus | src/engines/capability-event-bus.ts | Typed pub/sub |
| ConfigManager | src/engines/config-manager.ts | Configuration management |

## Lifecycle Engines

| Engine | File | Purpose |
|--------|------|---------|
| RegistrationAuditor | src/engines/registration-auditor.ts | Provider audit |
| ProviderRegistrar | src/engines/provider-registrar.ts | Provider registration |

## SOTA Engines (Phases 7-10)

| Engine | File | Purpose |
|--------|------|---------|
| MirrorEngine | src/engines/mirror-engine.ts | UI ⇄ Chrome sync |
| AgenticLoopEngine | src/engines/agentic-loop.ts | Sense→plan→act→observe→reflect |
| WorkflowEngine | src/engines/workflow-engine.ts | DAG execution |
| MemoryEngine | src/engines/memory-engine.ts | Episodic/semantic/procedural storage |
| ProviderMuxEngine | src/engines/provider-mux.ts | Multi-provider routing |
| AutonomousExecutionEngine | src/engines/autonomous-execution.ts | Full autopilot |

## See Also
- docs/atomic/00-master-plan.md (full dependency graph)
- docs/merged-design-v2/04-merged-engines.md (engine specs)