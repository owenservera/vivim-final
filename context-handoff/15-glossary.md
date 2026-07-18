# Glossary (from docs/atomic/99-glossary.md)

## Core Concepts

| Term | Definition |
|------|-----------|
| **Governor** | Short for `ChromeGovernor` — the single I/O authority. All Chrome interaction flows through it. |
| **Governor.CDPProxy** | Internal subsystem that wraps BunCdpClient and exposes typed CDP operations. |
| **Governor.LifecycleManager** | Internal subsystem that spawns, kills, and ensures Chrome instances. |
| **Governor.TraceLog** | Internal subsystem that records every CDP operation to `trace_entry`. |
| **Governor.HealthMonitor** | Internal subsystem that probes Chrome liveness. |
| **HarnessRuntime** | Server-side orchestrator that executes capability DAGs via atomic CDP commands. |
| **HarnessDAG** | Directed acyclic graph of capability steps. Supports Sequence, Branch, Parallel, Retry. |
| **HarnessModule** | Capability-specific module loaded by HarnessRuntime. One capability slug = one module. |
| **ConversationManager** | 8-step pipeline: RESOLVE→LOCK→ENSURE→SEND→CAPTURE→PARSE→STORE→EMIT. |
| **ContentBlock** | Typed block from provider responses: text, code, thinking, artifact, image, citation, tool_use, error, meta. |
| **CapabilityResolutionEngine** | Read-only SQL engine that resolves capability UI contracts with 3-layer override chain. |
| **CapabilityEventBus** | In-process typed pub/sub. Publishers emit; subscribers receive subscribed events only. |
| **Slave** | Running Chrome instance managed by Governor. Unique `slaveId` = provider_id + account_id. |
| **Capability** | Atomic user action (send message, select model, upload file). Has 21-field UI contract. |

## SOTA Terms (Phases 14-20)

| Term | Definition |
|------|-----------|
| **CDPTransport** | Abstraction over BunCdpClient. Provides typed CDP without direct Chrome dependency. |
| **KnowledgeIngestionEngine** | Imports conversation history (ChatGPT, Claude, Gemini) into local database. |
| **ProviderMuxEngine** | Multi-provider multiplexer — round-robin, failover, cost optimization. |
| **AutonomousExecutionEngine** | Full autonomous execution with HITL gates, self-healing, observability. |
| **EncryptionEngine** | AES-256-GCM encryption for all data at rest. Wraps SQLite writes. |
| **AirGapEngine** | Air-gap mode — blocks outbound calls, serves from local data/models only. |
| **UnifiedCapabilityRegistry** | Single registry exposing capabilities across CLI, API, and UI. |

## Schema Layers (L0-L19)
- L0: Bookkeeping | L1: Provider KG | L2: Trace | L3: Capability | L4: State/Session
- L5: Registration | L6: Versioning | L7: Telemetry | L8: Config | L9: Harness
- L10: MCP | L11: Operations | L12: Transfer | L13: Testing
- L14: Sovereign Intelligence | L15: Mux/Routing | L16: Context
- L17: Workspace | L18: Autonomous | L19: Sovereign Data

## Validation Commands
```powershell
bun run typecheck
bun test
bun run lint
bun run format
```