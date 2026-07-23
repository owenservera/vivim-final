# Server Bootstrap / API Router

## Overview

The `src/server/index.ts` is the **HTTP + WebSocket server entry point**. `createServerWithEngines()` performs the full boot sequence: seed → store init → engine wiring → CDP transport injection → governor boot → protocol priming → snapshot load → registry population → MCP server start → memory fabric → kernel bootstrap.

## Governing Source Files

| File | Role |
|------|------|
| `src/server/index.ts` | **Single most important server file.** `createServer(port)` — minimal shell (health, setup, WS upgrade, auth, CORS). `createServerWithEngines(port)` — **full bootstrap**: 1) seeds providers (`ProviderRegistrar.seedAll`), parsers (`seedHarvestedParsers`), taxonomy (`ensureTaxonomySeeded`), harness commands (`seedHarnessCommands`); 2) creates all `StoreImpl` instances; 3) instantiates `CapabilityResolutionEngine`, `StreamParserEngine`, `StreamBlockStore`, `ExecutionMemoizer`, `MemoryEngine`, `ChromeGovernor`, `ConversationManager`; 4) primes parser cache from generated protocol; 5) injects `CdpTransportImpl`; 6) boots governor; 7) wires optional engines (knowledge ingestion, semantic search, synthesizer, export, provider mux, autonomous execution, policy engine); 8) registers **default** capabilities and `prog-*` program resolver; 9) registers LLM-as-Human testing capabilities; 10) registers generated taxonomy capabilities; 11) starts MCP server (`McpServerAdapter`); 12) provisions per-agent memory (`MemoryFabric`); 13) bootstraps the kernel (`bootstrapKernel`); 14) starts `ProviderHealthKernel`. |
| `src/server/conversation-router.ts` | Primary REST surface: `GET/POST /api/providers`, `GET /api/providers/:id/capabilities`, `GET/POST /api/conversations`, `POST /api/conversations/:id/send`, `GET /api/conversations/:id/messages`, `DELETE /api/conversations/:id`, `POST /api/conversations/:id/capabilities/:slug/execute`, fleet start/kill, session, health, sandbox debug. |
| `src/server/capability-router.ts` | Universal capability transport: `GET /api/capabilities?surface=&category=&tag=`, `POST /api/capabilities/:id/execute`, `GET /api/capabilities/:id`. Slug resolves via `getBySlugAsync` (lazy prog-*) then executes handler. |
| `src/server/websocket.ts` | WebSocket bridge: opens connections, routes messages through `eventBus`, forwards conversation events to subscribed WS clients. |
| `src/server/auth-gate.ts` | `createAuthMiddleware` — local-first auth stub (always succeeds for POST /session). |
| `src/server/kernel-router.ts` | Kernel registration/topology routes. |
| `src/server/setup-router.ts` | First-run workspace setup (no auth required). |

## Key Types and Interfaces

```typescript
// From src/server/index.ts
export interface ServerContext {
  port: number
  db: CapStoreDb
  eventBus: CapabilityEventBus
  conversationManager?: ConversationManager
  resolutionEngine?: CapabilityResolutionEngine
  governor?: ChromeGovernor
  knowledgeIngestion?: KnowledgeIngestionEngine
  semanticSearch?: SemanticSearchEngine
  synthesizer?: CrossConversationSynthesizer
  exportEngine?: ExportEngine
  providerMux?: ProviderMuxEngine
  autonomousEngine?: AutonomousExecutionEngine
  policyEngine?: ExecutionPolicyEngine
  registry?: UnifiedCapabilityRegistry
  costOptimizer?: CostOptimizer
  nlclEngine?: NLCLEngine
  automationOrchestrator?: AutomationOrchestrator
  kernel?: Kernel
  healthKernel?: ProviderHealthKernel
  lockManager?: LockManager
  idempotencyGuard?: IdempotencyGuard
  retryEngine?: RetryEngine
  conceptualModel?: ConceptualModelService
  userIdentity?: UserIdentityEngine
  memoryFabric?: MemoryFabric
  agentBuilder?: AgentBuilderEngine
  memoryEngine?: MemoryEngine
}
```

## Data Flow

### Bootstrap Sequence (`createServerWithEngines`)

1. **Seeding**: `ProviderRegistrar.seedAll()` → idempotent upserts of providers, parsers, capabilities into DB
2. **Store Init**: Create all `StoreImpl` instances (`ProviderStoreImpl`, `ParserStoreImpl`, `GovernorStoreImpl`, `ConversationStoreImpl`, `CapabilityResolutionStoreImpl`, `CapabilityStoreImpl`, `ParserExecutionLogStoreImpl`, `ContentUnitStoreImpl`, `NodeStoreImpl`, episodic/semantic/procedural memory stores)
3. **Engine Instantiation**: Create `CapabilityResolutionEngine`, `StreamParserEngine`, `StreamBlockStore`, `ExecutionMemoizer`, `MemoryEngine`, `ChromeGovernor`, `ConversationManager`
4. **Protocol Priming**: `parserEngine.primeFromProtocol(protocol)` → loads inline `logic_code` from generated protocol → `primedParsers` cache → **zero DB reads** on hot parse path
5. **CDP Transport Injection**: `CdpTransportImpl` created → `governor.setCdpTransport(cdpTransport)` → `governor.setTraceLog(govStore)` → `governor.setHealthMonitor(govStore)` → `governor.boot()`
6. **Snapshot Load**: `CapabilitySnapshot.load(registeredProviderIds)` → reads active bindings from DB → O(1) in-memory maps → `governor.setCapabilitySnapshot(snapshot)`
7. **Registry Population**: `registerDefaultCapabilities(registry, services)` → `registerGeneratedCapabilities()` → `registerDiscoveredCdpMethods(registry, CDP_PROTOCOL_CATALOG, ...)` → `registry.setProgramResolver(...)` for lazy `prog-*` resolution
8. **Registry Bridge**: `connectCapabilityRegistry(registry)` → `syncCliFromUnified(reg, registry)` mirrors CLI-surface capabilities into `CommandRegistry`
9. **MCP Server**: `McpServerAdapter` starts → exposes every `mcp`-surface capability over WebSocket
10. **Memory Fabric**: `MemoryFabric` provisions per-agent memory stores
11. **Kernel Bootstrap**: `bootstrapKernel()` registers all engines and starts topology snapshots
12. **Health Kernel**: `ProviderHealthKernel.start()` begins periodic health checks

### Request Flows

```
POST /api/conversations/:id/send
  → createConversationRouter
  → ctx.conversationManager.send(conversationId, message)
  → 8-step pipeline (resolve → recall → slave → send → capture → parse → store → remember)
  → { ok, messageId, blocks, text, latencyMs }

POST /api/capabilities/:id/execute
  → createCapabilityRouter
  → registry.getBySlugAsync(id) (lazy prog-* resolution)
  → registry.execute(cap.id, input, capCtx)
  → cap.handler(input, ctx)
  → { ok, capabilityId, output, traceId, latencyMs }
```

## Critical Patterns

- **Lazy Engine Import**: `createServerWithEngines` uses dynamic `import()` to avoid circular dependencies at module load
- **Graceful Shutdown**: `process.on('SIGTERM')` / `process.on('SIGINT')` → `gracefulShutdown()` runs all registered hooks
- **Port Discovery**: `startOnFreePort()` tries preferred port, walks up to +200 on `EADDRINUSE`, writes actual port to `.runtime/backend.port`
- **Readiness Gate**: `/readyz` returns 200 only after `Bun.serve` succeeds, preventing traffic during boot
- **Auth Stub**: Local-first auth — `POST /session` always succeeds; `GET /session` returns `authenticated: false`
- **CORS**: Allows all origins, methods, headers for local-first development

## System Connections

- **UnifiedCapabilityRegistry**: server populates + bridges to CLI/MCP/UI
- **ChromeGovernor**: initialized, CDP transport injected, booted
- **StreamParserEngine**: instantiated + primed from protocol
- **ConversationManager**: instantiated with all dependencies
- **ProviderRegistrar**: seeds providers, parsers, capabilities into DB
- **CapabilityEventBus**: singleton at boot, threaded through every engine
- **Kernel**: `bootstrapKernel` registers all engines and starts topology snapshots
- **MCP**: `McpServerAdapter` exposes every `mcp`-surface capability over WebSocket
