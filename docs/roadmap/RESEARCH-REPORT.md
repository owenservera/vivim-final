# Research Report

**Generated:** 2026-07-12T06:26:03.641Z
**Truth Score:** 98%

---

## Executive Summary

- Total units: 225
- Done: 220
- Need port: 1
- Need create: 4
- Need fix: 0

---

## Unit Research

### Phase 1

#### 1.1 — Prisma Schema

- **Status:** done
- **File:** `prisma/schema.prisma`
- **Classification:** DONE
- **Source:** N/A
- **Effort:** S

#### 1.2 — Seed SQL (CHECK constraints, 9 views)

- **Status:** done
- **File:** `prisma/seed.sql`
- **Classification:** DONE
- **Source:** N/A
- **Effort:** S

#### 1.3 — Prisma Client Singleton

- **Status:** done
- **File:** `src/storage/prisma.ts`
- **Classification:** DONE
- **Source:** N/A
- **Effort:** S

#### 1.4 — CapStoreDb (PrismaClient wrapper)

- **Status:** done
- **File:** `src/storage/db.ts`
- **Classification:** DONE
- **Source:** N/A
- **Effort:** S

#### 1.5 — Tooling (biome.json, lefthook.yml, tsup.config.ts) → root configs

- **Status:** done
- **File:** `N/A`
- **Classification:** DONE
- **Source:** N/A
- **Effort:** S

### Phase 2

#### 2.1 — ProviderRegistrar

- **Status:** done
- **File:** `src/engines/provider-registrar.ts`
- **Classification:** DONE
- **Source:** N/A
- **Effort:** S

#### 2.2 — RegistrationAuditor

- **Status:** done
- **File:** `src/engines/registration-auditor.ts`
- **Classification:** DONE
- **Source:** N/A
- **Effort:** S

#### 2.3 — ConfigManager

- **Status:** done
- **File:** `src/engines/config-manager.ts`
- **Classification:** DONE
- **Source:** N/A
- **Effort:** S

#### 2.4 — ExecutionMemoizer

- **Status:** done
- **File:** `src/engines/execution-memoizer.ts`
- **Classification:** DONE
- **Source:** N/A
- **Effort:** S

#### 2.5 — Seed: claude.json

- **Status:** done
- **File:** `seeds/providers/claude.json`
- **Classification:** DONE
- **Source:** N/A
- **Effort:** S

#### 2.6 — Seed: chatgpt.json

- **Status:** done
- **File:** `seeds/providers/chatgpt.json`
- **Classification:** DONE
- **Source:** N/A
- **Effort:** S

#### 2.7 — Seed: gemini.json

- **Status:** done
- **File:** `seeds/providers/gemini.json`
- **Classification:** DONE
- **Source:** N/A
- **Effort:** S

#### 2.8 — Seed: deepseek.json

- **Status:** done
- **File:** `seeds/providers/deepseek.json`
- **Classification:** DONE
- **Source:** N/A
- **Effort:** S

#### 2.9 — Seed: studio-ai.json

- **Status:** done
- **File:** `seeds/providers/studio-ai.json`
- **Classification:** DONE
- **Source:** N/A
- **Effort:** S

#### 2.10 — Seed: z-ai.json

- **Status:** done
- **File:** `seeds/providers/z-ai.json`
- **Classification:** DONE
- **Source:** N/A
- **Effort:** S

#### 2.11 — Seed: qwen.json

- **Status:** done
- **File:** `seeds/providers/qwen.json`
- **Classification:** DONE
- **Source:** N/A
- **Effort:** S

#### 2.12 — ProviderManifest Zod schema

- **Status:** done
- **File:** `src/schema/provider-manifest.ts`
- **Classification:** DONE
- **Source:** N/A
- **Effort:** S

#### 2.13 — ProviderEndpoint DOM Interaction Config

- **Status:** done
- **File:** `prisma/schema.prisma`, `src/engines/provider-registrar.ts`
- **Classification:** DONE
- **Source:** N/A
- **Effort:** S

#### 2.14 — ProviderEndpoint selectorsJson Rename

- **Status:** pending
- **File:** `prisma/schema.prisma`, `src/storage/impl/provider-store-impl.ts`
- **Classification:** CREATE
- **Source:** N/A
- **Effort:** M

#### 2.15 — ProviderParser Hash Auto-computation

- **Status:** pending
- **File:** `src/engines/provider-registrar.ts`
- **Classification:** DONE
- **Source:** N/A
- **Effort:** S
- **Vivim ref:** `src/engines/provider-registrar.ts`

#### 2.16 — ProviderStreamConfig Delta Path Validation

- **Status:** pending
- **File:** `src/schema/provider-manifest.ts`
- **Classification:** PORT
- **Source:** N/A
- **Effort:** M
- **Vivim ref:** `src/schema/provider-manifest.ts`

#### 2.17 — Remove Hardcoded Parsers from StreamParserEngine

- **Status:** done
- **File:** `src/engines/stream-parser.ts`
- **Classification:** DONE
- **Source:** N/A
- **Effort:** S

#### 2.18 — Parser Seed Migration (TS files → DB inline code)

- **Status:** done
- **File:** `seeds/providers/*.json`
- **Classification:** DONE
- **Source:** N/A
- **Effort:** S

#### 2.19 — DB-Only Fallback Chain

- **Status:** done
- **File:** `src/engines/stream-parser.ts`, `src/storage/contracts/parser-store.ts`
- **Classification:** DONE
- **Source:** N/A
- **Effort:** S

### Phase 3

#### 3.1 — ChromeGovernor (public API + boot)

- **Status:** done
- **File:** `src/engines/chrome-governor.ts`
- **Classification:** DONE
- **Source:** N/A
- **Effort:** S

#### 3.2 — Governor: LifecycleManager (spawn/kill/ensure/reap) → governor subsystem

- **Status:** done
- **File:** `N/A`
- **Classification:** DONE
- **Source:** N/A
- **Effort:** S

#### 3.3 — Governor: CDPProxy (send/capture/executeHarnessPlan) → governor subsystem

- **Status:** done
- **File:** `N/A`
- **Classification:** DONE
- **Source:** N/A
- **Effort:** S

#### 3.4 — Governor: TraceLog (CDP tracing) → governor subsystem

- **Status:** done
- **File:** `N/A`
- **Classification:** DONE
- **Source:** N/A
- **Effort:** S

#### 3.5 — Governor: HealthMonitor (liveness probes + circuit breaker) → governor subsystem

- **Status:** done
- **File:** `N/A`
- **Classification:** DONE
- **Source:** N/A
- **Effort:** S

#### 3.6 — ConversationManager (8-step pipe)

- **Status:** done
- **File:** `src/engines/conversation-manager.ts`
- **Classification:** DONE
- **Source:** N/A
- **Effort:** S

#### 3.7 — CapabilityEventBus (typed pub/sub)

- **Status:** done
- **File:** `src/engines/capability-event-bus.ts`
- **Classification:** DONE
- **Source:** N/A
- **Effort:** S

#### 3.8 — StreamBlockStore (ContentBlock persistence)

- **Status:** done
- **File:** `src/engines/stream-block-store.ts`
- **Classification:** DONE
- **Source:** N/A
- **Effort:** S

#### 3.9 — Store: GovernorStore

- **Status:** done
- **File:** `src/storage/contracts/governor-store.ts`
- **Classification:** DONE
- **Source:** N/A
- **Effort:** S

#### 3.10 — Store: ConversationStore

- **Status:** done
- **File:** `src/storage/contracts/conversation-store.ts`
- **Classification:** DONE
- **Source:** N/A
- **Effort:** S

#### 3.11 — Store: StreamBlockStore

- **Status:** done
- **File:** `src/storage/contracts/stream-block-store.ts`
- **Classification:** DONE
- **Source:** N/A
- **Effort:** S

#### 3.12 — Store: HealthStore

- **Status:** done
- **File:** `src/storage/contracts/health-store.ts`
- **Classification:** DONE
- **Source:** N/A
- **Effort:** S

#### 3.13 — Store impls: Phase 3 stores → `src/storage/impl/` (4 files)

- **Status:** done
- **File:** `N/A`
- **Classification:** DONE
- **Source:** N/A
- **Effort:** S

#### 3.14 — ConversationManager context injection → add to 3.6 pipeline

- **Status:** done
- **File:** `N/A`
- **Classification:** DONE
- **Source:** N/A
- **Effort:** S

### Phase 4

#### 4.1 — StreamParserEngine

- **Status:** done
- **File:** `src/engines/stream-parser.ts`
- **Classification:** DONE
- **Source:** N/A
- **Effort:** S

#### 4.2 — CapabilityEngine

- **Status:** done
- **File:** `src/engines/capability.ts`
- **Classification:** DONE
- **Source:** N/A
- **Effort:** S

#### 4.3 — CapabilityResolutionEngine

- **Status:** done
- **File:** `src/engines/capability-resolution.ts`
- **Classification:** DONE
- **Source:** N/A
- **Effort:** S

#### 4.4 — ProviderHealthKernel

- **Status:** done
- **File:** `src/engines/provider-health.ts`
- **Classification:** DONE
- **Source:** N/A
- **Effort:** S

#### 4.5 — VersionManager

- **Status:** done
- **File:** `src/engines/version-manager.ts`
- **Classification:** DONE
- **Source:** N/A
- **Effort:** S

#### 4.6 — TelemetryAggregator

- **Status:** done
- **File:** `src/engines/telemetry-aggregator.ts`
- **Classification:** DONE
- **Source:** N/A
- **Effort:** S

#### 4.7 — HarnessRuntime

- **Status:** done
- **File:** `src/engines/harness-runtime.ts`
- **Classification:** DONE
- **Source:** N/A
- **Effort:** S

#### 4.8 — Parser Seed: claude/sse

- **Status:** done
- **File:** `seeds/parsers/claude/001_streaming_sse.ts`
- **Classification:** DONE
- **Source:** N/A
- **Effort:** S

#### 4.9 — Parser Seed: gemini/batch

- **Status:** done
- **File:** `seeds/parsers/gemini/001_batchexecute.ts`
- **Classification:** DONE
- **Source:** N/A
- **Effort:** S

#### 4.10 — Parser Seed: chatgpt/sse

- **Status:** done
- **File:** `seeds/parsers/chatgpt/001_openai_sse.ts`
- **Classification:** DONE
- **Source:** N/A
- **Effort:** S

#### 4.11 — Parser Seed: generic/sse

- **Status:** done
- **File:** `seeds/parsers/generic/001_sse_frames.ts`
- **Classification:** DONE
- **Source:** N/A
- **Effort:** S

#### 4.12 — Parser Seed: generic/delta

- **Status:** done
- **File:** `seeds/parsers/generic/002_openai_delta.ts`
- **Classification:** DONE
- **Source:** N/A
- **Effort:** S

#### 4.13 — Parser Seed: fallback

- **Status:** done
- **File:** `seeds/parsers/system/001_fallback.ts`
- **Classification:** DONE
- **Source:** N/A
- **Effort:** S

#### 4.14 — Harness: composer.module

- **Status:** done
- **File:** `seeds/harness/composer.module.ts`
- **Classification:** DONE
- **Source:** N/A
- **Effort:** S

#### 4.15 — Harness: login.module

- **Status:** done
- **File:** `seeds/harness/login.module.ts`
- **Classification:** DONE
- **Source:** N/A
- **Effort:** S

#### 4.16 — Harness: navigation.module

- **Status:** done
- **File:** `seeds/harness/navigation.module.ts`
- **Classification:** DONE
- **Source:** N/A
- **Effort:** S

#### 4.17 — Harness: capture.module

- **Status:** done
- **File:** `seeds/harness/capture.module.ts`
- **Classification:** DONE
- **Source:** N/A
- **Effort:** S

#### 4.18 — Harness: selector.module

- **Status:** done
- **File:** `seeds/harness/selector.module.ts`
- **Classification:** DONE
- **Source:** N/A
- **Effort:** S

#### 4.19 — Store contracts: Phase 4   → `src/storage/contracts/` (6 files)

- **Status:** done
- **File:** `N/A`
- **Classification:** DONE
- **Source:** N/A
- **Effort:** S

#### 4.20 — Store impls: Phase 4       → `src/storage/impl/` (6 files)

- **Status:** done
- **File:** `N/A`
- **Classification:** DONE
- **Source:** N/A
- **Effort:** S

#### 4.21 — Alerting subsystem (Alerter) → `src/alerting/alerter.ts` (ported survivor)

- **Status:** done
- **File:** `N/A`
- **Classification:** DONE
- **Source:** N/A
- **Effort:** S

#### 4.22 — Automation scheduler        → `src/automation/scheduler.ts` (ported survivor)

- **Status:** done
- **File:** `N/A`
- **Classification:** DONE
- **Source:** N/A
- **Effort:** S

#### 4.23 — Router subsystem            → `src/router/` (ported survivor)

- **Status:** done
- **File:** `N/A`
- **Classification:** DONE
- **Source:** N/A
- **Effort:** S

#### 4.24 — HarnessCheckpoint persistence

- **Status:** done
- **File:** `src/engines/harness-checkpoint.ts`
- **Classification:** DONE
- **Source:** N/A
- **Effort:** S

#### 4.25 — CapabilityMacro support

- **Status:** done
- **File:** `src/engines/capability-macro.ts`
- **Classification:** DONE
- **Source:** N/A
- **Effort:** S

#### 4.26 — Session checkpointing

- **Status:** done
- **File:** `src/engines/session-checkpoint.ts`
- **Classification:** DONE
- **Source:** N/A
- **Effort:** S

#### 4.27 — Survivor: src/errors.ts      → `src/errors.ts` (port/verify)

- **Status:** done
- **File:** `N/A`
- **Classification:** DONE
- **Source:** N/A
- **Effort:** S

#### 4.28 — Survivor: src/config.ts      → `src/config.ts` (port/verify)

- **Status:** done
- **File:** `N/A`
- **Classification:** DONE
- **Source:** N/A
- **Effort:** S

#### 4.29 — Survivor: src/executor/*     → `src/executor/` (6 files, port/verify)

- **Status:** done
- **File:** `N/A`
- **Classification:** DONE
- **Source:** N/A
- **Effort:** S

#### 4.30 — State Transition recording

- **Status:** done
- **File:** `src/engines/state-transition.ts`
- **Classification:** DONE
- **Source:** N/A
- **Effort:** S

#### 4.31 — Shared types + barrel exports

- **Status:** done
- **File:** `src/schema/types.ts` + `src/index.ts`
- **Classification:** DONE
- **Source:** N/A
- **Effort:** S

### Phase 5

#### 5.1 — Server entry (Bun.serve + routes)

- **Status:** done
- **File:** `src/server/index.ts`
- **Classification:** DONE
- **Source:** N/A
- **Effort:** S

#### 5.2 — Response helpers (CORS + JSON)

- **Status:** done
- **File:** `src/server/response.ts`
- **Classification:** DONE
- **Source:** N/A
- **Effort:** S

#### 5.3 — WebSocket bridge + EventBus integration

- **Status:** done
- **File:** `src/server/websocket.ts`
- **Classification:** DONE
- **Source:** N/A
- **Effort:** S

#### 5.4 — Conversation Router

- **Status:** done
- **File:** `src/server/conversation-router.ts`
- **Classification:** DONE
- **Source:** N/A
- **Effort:** S

#### 5.5 — Auth Gate (Bearer token)

- **Status:** done
- **File:** `src/server/auth-gate.ts`
- **Classification:** DONE
- **Source:** N/A
- **Effort:** S

#### 5.6 — SDK Client (full typed)

- **Status:** done
- **File:** `sdk/src/client.ts`
- **Classification:** DONE
- **Source:** N/A
- **Effort:** S

#### 5.7 — CLI entry + command registry

- **Status:** done
- **File:** `src/cli/index.ts`
- **Classification:** DONE
- **Source:** N/A
- **Effort:** S

#### 5.8 — CLI: output formatter

- **Status:** done
- **File:** `src/cli/output-formatter.ts`
- **Classification:** DONE
- **Source:** N/A
- **Effort:** S

#### 5.9 — CLI: pipeline engine

- **Status:** done
- **File:** `src/cli/pipeline-engine.ts`
- **Classification:** DONE
- **Source:** N/A
- **Effort:** S

#### 5.10 — CLI: bridges (3 files)

- **Status:** done
- **File:** `src/cli/bridges/`
- **Classification:** DONE
- **Source:** N/A
- **Effort:** S

#### 5.11 — CLI: commands (9 files)

- **Status:** done
- **File:** `src/cli/commands/`
- **Classification:** DONE
- **Source:** N/A
- **Effort:** S

#### 5.12 — Zod Validators (all endpoints)

- **Status:** done
- **File:** `src/schema/validators.ts`
- **Classification:** DONE
- **Source:** N/A
- **Effort:** S

### Phase 6

#### 6.1 — Doc alignment (verify all 25+ items) → check against merged-design-v2

- **Status:** done
- **File:** `N/A`
- **Classification:** DONE
- **Source:** N/A
- **Effort:** S

#### 6.2 — E2E tests (Claude, ChatGPT, Gemini, multi-turn)

- **Status:** done
- **File:** `tests/e2e/`
- **Classification:** DONE
- **Source:** N/A
- **Effort:** S

#### 6.3 — Performance gates (latency budgets, resource limits) → perf profile

- **Status:** done
- **File:** `N/A`
- **Classification:** DONE
- **Source:** N/A
- **Effort:** S

### Phase 7

#### 7.1 — MirrorEngine (UI ⇄ Chrome bidirectional sync)

- **Status:** done
- **File:** `src/engines/mirror-engine.ts`
- **Classification:** DONE
- **Source:** N/A
- **Effort:** S

#### 7.2 — ObservationTap (Governor subsystem) → add to ChromeGovernor

- **Status:** done
- **File:** `N/A`
- **Classification:** DONE
- **Source:** N/A
- **Effort:** S

#### 7.3 — AgenticLoopEngine (sense→plan→act→observe→reflect)

- **Status:** done
- **File:** `src/engines/agentic-loop.ts`
- **Classification:** DONE
- **Source:** N/A
- **Effort:** S

#### 7.4 — ToolUseProtocol (agentic loop ↔ capability bridge)

- **Status:** done
- **File:** `src/engines/tool-use-protocol.ts`
- **Classification:** DONE
- **Source:** N/A
- **Effort:** S

#### 7.5 — Latency budgets + optimistic updates → mirror-engine subsystem

- **Status:** done
- **File:** `N/A`
- **Classification:** DONE
- **Source:** N/A
- **Effort:** S

#### 7.6 — UI Mirror State persistence

- **Status:** done
- **File:** `src/storage/contracts/mirror-store.ts`
- **Classification:** DONE
- **Source:** N/A
- **Effort:** S

#### 7.7 — Live observation projection → observation-tap subsystem

- **Status:** done
- **File:** `N/A`
- **Classification:** DONE
- **Source:** N/A
- **Effort:** S

#### 7.8 — Store impls: Phase 7

- **Status:** done
- **File:** `src/storage/impl/`
- **Classification:** DONE
- **Source:** N/A
- **Effort:** S

### Phase 8

#### 8.1 — CapabilityShapeRegistry

- **Status:** done
- **File:** `src/engines/capability-shape-registry.ts`
- **Classification:** DONE
- **Source:** N/A
- **Effort:** S

#### 8.2 — ProviderDiscoveryEngine

- **Status:** done
- **File:** `src/engines/provider-discovery.ts`
- **Classification:** DONE
- **Source:** N/A
- **Effort:** S

#### 8.3 — ManifestInferenceEngine

- **Status:** done
- **File:** `src/engines/manifest-inference.ts`
- **Classification:** DONE
- **Source:** N/A
- **Effort:** S

#### 8.4 — Polymorphic resolution      → add to CapabilityResolutionEngine

- **Status:** done
- **File:** `N/A`
- **Classification:** DONE
- **Source:** N/A
- **Effort:** S

#### 8.5 — Plugin system (self-describing providers)

- **Status:** done
- **File:** `src/engines/plugin-system.ts`
- **Classification:** DONE
- **Source:** N/A
- **Effort:** S

#### 8.6 — Schema delta: Phase 8 tables → SOTA-07 new tables

- **Status:** done
- **File:** `N/A`
- **Classification:** DONE
- **Source:** N/A
- **Effort:** S

### Phase 9

#### 9.1 — WorkflowEngine (DAG execution)

- **Status:** done
- **File:** `src/engines/workflow-engine.ts`
- **Classification:** DONE
- **Source:** N/A
- **Effort:** S

#### 9.2 — WorkflowCompiler (visual JSON → HarnessDAG)

- **Status:** done
- **File:** `src/engines/workflow-compiler.ts`
- **Classification:** DONE
- **Source:** N/A
- **Effort:** S

#### 9.3 — SemanticGroundingEngine (accessibility + visual)

- **Status:** done
- **File:** `src/engines/semantic-grounding.ts`
- **Classification:** DONE
- **Source:** N/A
- **Effort:** S

#### 9.4 — SelectorHealer (LLM-powered repair)

- **Status:** done
- **File:** `src/engines/selector-healer.ts`
- **Classification:** DONE
- **Source:** N/A
- **Effort:** S

#### 9.5 — Shadow DOM traversal         → add to SemanticGroundingEngine

- **Status:** done
- **File:** `N/A`
- **Classification:** DONE
- **Source:** N/A
- **Effort:** S

#### 9.6 — Cross-origin frame support   → add to SemanticGroundingEngine

- **Status:** done
- **File:** `N/A`
- **Classification:** DONE
- **Source:** N/A
- **Effort:** S

#### 9.7 — Anti-detection stealth

- **Status:** done
- **File:** `seeds/harness/stealth.module.ts`
- **Classification:** DONE
- **Source:** N/A
- **Effort:** S

#### 9.8 — Human-in-the-loop workflow   → add to WorkflowEngine

- **Status:** done
- **File:** `N/A`
- **Classification:** DONE
- **Source:** N/A
- **Effort:** S

#### 9.9 — Webhook triggers             → add to WorkflowEngine

- **Status:** done
- **File:** `N/A`
- **Classification:** DONE
- **Source:** N/A
- **Effort:** S

#### 9.10 — Schema delta: Phase 9 tables → SOTA-07 new tables

- **Status:** done
- **File:** `N/A`
- **Classification:** DONE
- **Source:** N/A
- **Effort:** S

### Phase 10

#### 10.1 — MemoryEngine (episodic)

- **Status:** done
- **File:** `src/engines/memory-engine.ts`
- **Classification:** DONE
- **Source:** N/A
- **Effort:** S

#### 10.2 — MemoryEngine (semantic)     → memory-engine subsystem

- **Status:** done
- **File:** `N/A`
- **Classification:** DONE
- **Source:** N/A
- **Effort:** S

#### 10.3 — MemoryEngine (procedural)   → memory-engine subsystem

- **Status:** done
- **File:** `N/A`
- **Classification:** DONE
- **Source:** N/A
- **Effort:** S

#### 10.4 — TransferAccelerator

- **Status:** done
- **File:** `src/engines/transfer-accelerator.ts`
- **Classification:** DONE
- **Source:** N/A
- **Effort:** S

#### 10.5 — StreamingProtocol (progressive blocks) → replace batch-only

- **Status:** done
- **File:** `N/A`
- **Classification:** DONE
- **Source:** N/A
- **Effort:** S

#### 10.6 — McpServerAdapter (Governor as MCP server)

- **Status:** done
- **File:** `src/engines/mcp-server-adapter.ts`
- **Classification:** DONE
- **Source:** N/A
- **Effort:** S

#### 10.7 — McpClientAdapter (MCP providers)

- **Status:** done
- **File:** `src/engines/mcp-client-adapter.ts`
- **Classification:** DONE
- **Source:** N/A
- **Effort:** S

#### 10.8 — HarnessProtocolEngine: PromptAugmenter

- **Status:** done
- **File:** `src/engines/harness-protocol-engine.ts`
- **Classification:** DONE
- **Source:** N/A
- **Effort:** S

#### 10.9 — HarnessProtocolEngine: ResponseExtractor → HPE subsystem

- **Status:** done
- **File:** `N/A`
- **Classification:** DONE
- **Source:** N/A
- **Effort:** S

#### 10.10 — HarnessProtocolEngine: ActionRouter + feedback loop → HPE subsystem

- **Status:** done
- **File:** `N/A`
- **Classification:** DONE
- **Source:** N/A
- **Effort:** S

#### 10.11 — Schema delta: Phase 10 tables (~28 new) → SOTA-07 full schema delta

- **Status:** done
- **File:** `N/A`
- **Classification:** DONE
- **Source:** N/A
- **Effort:** S

#### 10.12 — Store impls: Phase 8-10

- **Status:** done
- **File:** `src/storage/impl/`
- **Classification:** DONE
- **Source:** N/A
- **Effort:** S

#### 10.13 — HPE hpe_session store contract

- **Status:** done
- **File:** `src/storage/contracts/hpe-session-store.ts`
- **Classification:** DONE
- **Source:** N/A
- **Effort:** S

### Phase 11

#### 11.1 — CDP Client           → `src/executor/cdp.ts` (built against vivim-final core)

- **Status:** done
- **File:** `N/A`
- **Classification:** DONE
- **Source:** N/A
- **Effort:** S

#### 11.2 — Chrome Launcher      → `src/executor/launcher.ts` (built against vivim-final core)

- **Status:** done
- **File:** `N/A`
- **Classification:** DONE
- **Source:** N/A
- **Effort:** S

#### 11.3 — Profile Allocator    → `src/executor/profile-allocator.ts` (built against vivim-final core)

- **Status:** done
- **File:** `N/A`
- **Classification:** DONE
- **Source:** N/A
- **Effort:** S

#### 11.4 — Port Reaper          → `src/executor/port-reaper.ts` (built against vivim-final core)

- **Status:** done
- **File:** `N/A`
- **Classification:** DONE
- **Source:** N/A
- **Effort:** S

#### 11.5 — Fleet Supervisor     → `src/executor/fleet-supervisor.ts` (built against vivim-final core)

- **Status:** done
- **File:** `N/A`
- **Classification:** DONE
- **Source:** N/A
- **Effort:** S

#### 11.6 — Slave Write          → `src/executor/slave-write.ts` (built against vivim-final core)

- **Status:** done
- **File:** `N/A`
- **Classification:** DONE
- **Source:** N/A
- **Effort:** S

#### 11.11 — Executor Barrel     → `src/executor/index.ts` (wiring + factory)

- **Status:** blocked
- **File:** `N/A`
- **Classification:** CREATE
- **Source:** N/A
- **Effort:** M
- **Vivim API:** BunCdpClient.send()

#### 11.13 — MirrorEngine Action Stubs → `src/engines/mirror-engine.ts` (3 stubs → real)

- **Status:** blocked
- **File:** `N/A`
- **Classification:** CREATE
- **Source:** N/A
- **Effort:** M

#### 11.14 — Slave Setup Script   → `scripts/setup-slaves.ts` (bootstrap logged-in profiles for chatgpt/claude/gemini; manual login + headless reuse)

- **Status:** done
- **File:** `N/A`
- **Classification:** DONE
- **Source:** N/A
- **Effort:** S

### Phase 13

#### 13.1 — Monorepo Scaffold → `web/` workspace (Vite + React 19 + TS + Tailwind + Zustand)

- **Status:** done
- **File:** `N/A`
- **Classification:** DONE
- **Source:** N/A
- **Effort:** S

#### 13.2 — Shared tsconfig + Path Aliases → `web/tsconfig.base.json` + `@ui`, `@api-client` aliases

- **Status:** done
- **File:** `N/A`
- **Classification:** DONE
- **Source:** N/A
- **Effort:** S

#### 13.3 — web/api-client Typed SDK → `web/api-client/src/index.ts` (typed from 07-merged-api.md)

- **Status:** done
- **File:** `N/A`
- **Classification:** DONE
- **Source:** N/A
- **Effort:** S

#### 13.4 — ActionRegistry → `web/ui/src/actions/registry.ts` (registerAction / dispatch / listActions)

- **Status:** done
- **File:** `N/A`
- **Classification:** DONE
- **Source:** N/A
- **Effort:** S

#### 13.5 — AgentBridge → `web/ui/src/actions/agent-bridge.ts` (WS agent:command / agent:discover)

- **Status:** done
- **File:** `N/A`
- **Classification:** DONE
- **Source:** N/A
- **Effort:** S

#### 13.6 — Capability API Endpoints → `src/server/routes/capabilities.ts` (GET /capabilities, POST /execute)

- **Status:** done
- **File:** `N/A`
- **Classification:** DONE
- **Source:** N/A
- **Effort:** S

#### 13.7 — WS Agent Command Channel → `src/server/websocket.ts` (agent:command / agent:discover routing)

- **Status:** done
- **File:** `N/A`
- **Classification:** DONE
- **Source:** N/A
- **Effort:** S

#### 13.8 — Sandbox App MVP → `web/sandbox/` (catalog + harness + debug panel)

- **Status:** done
- **File:** `N/A`
- **Classification:** DONE
- **Source:** N/A
- **Effort:** S

#### 13.9 — Provider Setup Wizard → `web/ui/src/features/provider-setup-wizard.tsx` (workspace selection + Chrome login UI)

- **Status:** done
- **File:** `N/A`
- **Classification:** DONE
- **Source:** N/A
- **Effort:** S

#### 13.10 — First Feature E2E → proof that sandbox system works end-to-end

- **Status:** blocked
- **File:** `N/A`
- **Classification:** CREATE
- **Source:** N/A
- **Effort:** M

### Phase 14

#### 14.1 — CDPTransport Implementation

- **Status:** done
- **File:** `src/executor/cdp-transport.ts`
- **Classification:** DONE
- **Source:** N/A
- **Effort:** S

#### 14.2 — ChromeGovernor CDP Real

- **Status:** done
- **File:** `src/engines/chrome-governor.ts`
- **Classification:** DONE
- **Source:** N/A
- **Effort:** S

#### 14.3 — ChromeGovernor Trace Real → governor subsystem

- **Status:** done
- **File:** `N/A`
- **Classification:** DONE
- **Source:** N/A
- **Effort:** S

#### 14.4 — ChromeGovernor Health Probe Real → governor subsystem

- **Status:** done
- **File:** `N/A`
- **Classification:** DONE
- **Source:** N/A
- **Effort:** S

#### 14.5 — ConversationManager EventBus Fix

- **Status:** done
- **File:** `src/engines/conversation-manager.ts`
- **Classification:** DONE
- **Source:** N/A
- **Effort:** S

#### 14.6 — Server → ConversationManager Wiring

- **Status:** done
- **File:** `src/server/index.ts`
- **Classification:** DONE
- **Source:** N/A
- **Effort:** S

#### 14.7 — HarnessRuntime Real Context

- **Status:** done
- **File:** `src/engines/harness-runtime.ts`
- **Classification:** DONE
- **Source:** N/A
- **Effort:** S

#### 14.8 — Router listRequests/getEvents + RouterStore

- **Status:** done
- **File:** `src/router/`
- **Classification:** DONE
- **Source:** N/A
- **Effort:** S

### Phase 15

#### 15.1 — KnowledgeIngestionEngine + Store

- **Status:** done
- **File:** `src/engines/knowledge-ingestion.ts`
- **Classification:** DONE
- **Source:** N/A
- **Effort:** S

#### 15.2 — ChatGPT Export Parser

- **Status:** done
- **File:** `seeds/parsers/chatgpt/export.ts`
- **Classification:** DONE
- **Source:** N/A
- **Effort:** S

#### 15.3 — Claude Export Parser

- **Status:** done
- **File:** `seeds/parsers/claude/export.ts`
- **Classification:** DONE
- **Source:** N/A
- **Effort:** S

#### 15.4 — Gemini Export Parser

- **Status:** done
- **File:** `seeds/parsers/gemini/export.ts`
- **Classification:** DONE
- **Source:** N/A
- **Effort:** S

#### 15.5 — KnowledgeExtractor (facts, decisions, patterns, entities)

- **Status:** done
- **File:** `src/engines/knowledge-extractor.ts`
- **Classification:** DONE
- **Source:** N/A
- **Effort:** S

#### 15.6 — SemanticSearchEngine + Embedding Store

- **Status:** done
- **File:** `src/engines/semantic-search.ts`
- **Classification:** DONE
- **Source:** N/A
- **Effort:** S

#### 15.7 — CrossConversationSynthesisEngine

- **Status:** done
- **File:** `src/engines/cross-conversation-synthesis.ts`
- **Classification:** DONE
- **Source:** N/A
- **Effort:** S

#### 15.8 — MemoryEngine ULID Fix + 10-type expansion

- **Status:** done
- **File:** `src/engines/memory-engine.ts`
- **Classification:** DONE
- **Source:** N/A
- **Effort:** S

#### 15.9 — Schema: Memory Intelligence Tables

- **Status:** done
- **File:** `prisma/schema.prisma`
- **Classification:** DONE
- **Source:** N/A
- **Effort:** S

#### 15.10 — Store Impls: Knowledge

- **Status:** done
- **File:** `src/storage/impl/knowledge-*-store-impl.ts`
- **Classification:** DONE
- **Source:** N/A
- **Effort:** S

#### 15.11 — Server Routes — Knowledge

- **Status:** done
- **File:** `src/server/knowledge-router.ts`
- **Classification:** DONE
- **Source:** N/A
- **Effort:** S

#### 15.12 — Full Export Engine (JSON/CSV)

- **Status:** done
- **File:** `src/engines/export.ts`
- **Classification:** DONE
- **Source:** N/A
- **Effort:** S

### Phase 16

#### 16.1 — ProviderMuxEngine + Store

- **Status:** done
- **File:** `src/engines/provider-mux.ts`
- **Classification:** DONE
- **Source:** N/A
- **Effort:** S

#### 16.2 — Round-Robin Deep Research → mux subsystem

- **Status:** done
- **File:** `N/A`
- **Classification:** DONE
- **Source:** N/A
- **Effort:** S

#### 16.3 — Response Synthesis Engine

- **Status:** done
- **File:** `src/engines/provider-mux.ts`
- **Classification:** DONE
- **Source:** N/A
- **Effort:** S

#### 16.4 — Automatic Failover → mux subsystem

- **Status:** done
- **File:** `N/A`
- **Classification:** DONE
- **Source:** N/A
- **Effort:** S

#### 16.5 — Cost Optimization Engine

- **Status:** done
- **File:** `src/engines/cost-optimizer.ts`
- **Classification:** DONE
- **Source:** N/A
- **Effort:** S

#### 16.6 — Learned Routing Preferences → mux subsystem

- **Status:** done
- **File:** `N/A`
- **Classification:** DONE
- **Source:** N/A
- **Effort:** S

#### 16.7 — Schema: Mux Tables

- **Status:** done
- **File:** `prisma/schema.prisma`
- **Classification:** DONE
- **Source:** N/A
- **Effort:** S

#### 16.8 — Server Routes for Mux

- **Status:** done
- **File:** `src/server/mux-router.ts`
- **Classification:** DONE
- **Source:** N/A
- **Effort:** S

### Phase 17

#### 17.1 — SituationDetector + Store

- **Status:** done
- **File:** `src/engines/situation-detector.ts`
- **Classification:** DONE
- **Source:** N/A
- **Effort:** S

#### 17.2 — ContextAssemblyEngine (5-stage pipeline)

- **Status:** done
- **File:** `src/engines/context-assembly.ts`
- **Classification:** DONE
- **Source:** N/A
- **Effort:** S

#### 17.3 — Predictive Pre-warming → context subsystem

- **Status:** done
- **File:** `N/A`
- **Classification:** DONE
- **Source:** N/A
- **Effort:** S

#### 17.4 — Budget-Aware Token Allocation → context subsystem

- **Status:** done
- **File:** `N/A`
- **Classification:** DONE
- **Source:** N/A
- **Effort:** S

#### 17.5 — Schema: Context Tables

- **Status:** done
- **File:** `prisma/schema.prisma`
- **Classification:** DONE
- **Source:** N/A
- **Effort:** S

#### 17.6 — ConversationManager Integration

- **Status:** done
- **File:** `src/engines/conversation-manager.ts`
- **Classification:** DONE
- **Source:** N/A
- **Effort:** S

### Phase 18

#### 18.1 — UnifiedCapabilityRegistry

- **Status:** done
- **File:** `src/engines/unified-registry.ts`
- **Classification:** DONE
- **Source:** N/A
- **Effort:** S

#### 18.2 — CLI Complete (all capabilities as commands)

- **Status:** done
- **File:** `src/cli/`
- **Classification:** DONE
- **Source:** N/A
- **Effort:** S

#### 18.3 — Workflow Builder API

- **Status:** done
- **File:** `src/engines/workflow-builder.ts`
- **Classification:** DONE
- **Source:** N/A
- **Effort:** S

#### 18.4 — Plugin Hot-Reload System

- **Status:** done
- **File:** `src/engines/plugin-hot-reload.ts`
- **Classification:** DONE
- **Source:** N/A
- **Effort:** S

#### 18.5 — WebSocket Agent Bridge V2

- **Status:** done
- **File:** `src/server/websocket.ts`
- **Classification:** DONE
- **Source:** N/A
- **Effort:** S

#### 18.6 — Adaptive Workspace Modes

- **Status:** done
- **File:** `src/engines/adaptive-workspace.ts`
- **Classification:** DONE
- **Source:** N/A
- **Effort:** S

#### 18.7 — Conversation Organization (Projects/Topics)

- **Status:** done
- **File:** `src/engines/conversation-organization.ts`
- **Classification:** DONE
- **Source:** N/A
- **Effort:** S

#### 18.8 — Memory Visualization API

- **Status:** done
- **File:** `src/server/routes/memory-viz.ts`
- **Classification:** DONE
- **Source:** N/A
- **Effort:** S

#### 18.9 — Schema: Workspace Tables

- **Status:** done
- **File:** `prisma/schema.prisma`
- **Classification:** DONE
- **Source:** N/A
- **Effort:** S

#### 18.10 — Progressive Disclosure UI

- **Status:** done
- **File:** `web/ui/src/`
- **Classification:** DONE
- **Source:** N/A
- **Effort:** S

### Phase 19

#### 19.1 — AutonomousExecutionEngine

- **Status:** done
- **File:** `src/engines/autonomous-execution.ts`
- **Classification:** DONE
- **Source:** N/A
- **Effort:** S

#### 19.2 — Execution Policy Engine

- **Status:** done
- **File:** `src/engines/execution-policy.ts`
- **Classification:** DONE
- **Source:** N/A
- **Effort:** S

#### 19.3 — HITL Gate System → extends 19.1

- **Status:** done
- **File:** `N/A`
- **Classification:** DONE
- **Source:** N/A
- **Effort:** S

#### 19.4 — Self-Healing Pipeline → extends 19.1

- **Status:** done
- **File:** `N/A`
- **Classification:** DONE
- **Source:** N/A
- **Effort:** S

#### 19.5 — Full AgenticLoop → extends `src/engines/agentic-loop.ts`

- **Status:** done
- **File:** `N/A`
- **Classification:** DONE
- **Source:** N/A
- **Effort:** S

#### 19.6 — Autonomous REST API

- **Status:** done
- **File:** `src/server/autonomous-router.ts`
- **Classification:** DONE
- **Source:** N/A
- **Effort:** S

#### 19.7 — Schema: Autonomous Tables

- **Status:** done
- **File:** `prisma/schema.prisma`
- **Classification:** DONE
- **Source:** N/A
- **Effort:** S

#### 19.8 — Visual Workflow DAG → extends `src/engines/workflow-engine.ts`

- **Status:** done
- **File:** `N/A`
- **Classification:** DONE
- **Source:** N/A
- **Effort:** S

### Phase 20

#### 20.1 — EncryptionEngine (at-rest)

- **Status:** done
- **File:** `src/engines/encryption.ts`
- **Classification:** DONE
- **Source:** N/A
- **Effort:** S

#### 20.2 — WAL Mode Configuration

- **Status:** done
- **File:** `src/storage/prisma.ts`
- **Classification:** DONE
- **Source:** N/A
- **Effort:** S

#### 20.3 — Export Engine (full JSON/CSV)

- **Status:** done
- **File:** `src/engines/export.ts`
- **Classification:** DONE
- **Source:** N/A
- **Effort:** S

#### 20.4 — Air-Gap Mode

- **Status:** done
- **File:** `src/engines/airgap.ts`
- **Classification:** DONE
- **Source:** N/A
- **Effort:** S

#### 20.5 — Local Model Integration (Ollama/llama.cpp)

- **Status:** done
- **File:** `src/engines/local-model-adapter.ts`
- **Classification:** DONE
- **Source:** N/A
- **Effort:** S

#### 20.6 — SyncEngine (E2E-encrypted)

- **Status:** done
- **File:** `src/engines/sync.ts`
- **Classification:** DONE
- **Source:** N/A
- **Effort:** S

#### 20.7 — Telemetry Audit (zero-cloud proof)

- **Status:** done
- **File:** `src/engines/telemetry-audit.ts`
- **Classification:** DONE
- **Source:** N/A
- **Effort:** S

#### 20.8 — Schema: Sovereign Data Tables → `prisma/schema.prisma` (SyncLog + SyncPeer + migration)

- **Status:** done
- **File:** `N/A`
- **Classification:** DONE
- **Source:** N/A
- **Effort:** S

### Phase 22

#### 22.1 — DiscoveryStore contract

- **Status:** done
- **File:** `src/storage/contracts/discovery-store.ts`
- **Classification:** DONE
- **Source:** N/A
- **Effort:** S

#### 22.2 — DiscoveryStore Prisma impl

- **Status:** done
- **File:** `src/storage/impl/discovery-store-impl.ts`
- **Classification:** DONE
- **Source:** N/A
- **Effort:** S

#### 22.3 — ShapeBindingStore contract

- **Status:** done
- **File:** `src/storage/contracts/shape-binding-store.ts`
- **Classification:** DONE
- **Source:** N/A
- **Effort:** S

#### 22.4 — ShapeBindingStore Prisma impl

- **Status:** done
- **File:** `src/storage/impl/shape-binding-store-impl.ts`
- **Classification:** DONE
- **Source:** N/A
- **Effort:** S

#### 22.5 — Enhanced ProviderDiscoveryEngine → `src/engines/provider-discovery.ts` (persistence, CDP ops, network obs, interactive probing)

- **Status:** done
- **File:** `N/A`
- **Classification:** DONE
- **Source:** N/A
- **Effort:** S

#### 22.6 — Enhanced ManifestInferenceEngine → `src/engines/manifest-inference.ts` (confidence scoring, needsReview, llmInferred)

- **Status:** done
- **File:** `N/A`
- **Classification:** DONE
- **Source:** N/A
- **Effort:** S

#### 22.7 — Enhanced CapabilityShapeRegistry → `src/engines/capability-shape-registry.ts` (adapter loading, shape inheritance)

- **Status:** done
- **File:** `N/A`
- **Classification:** DONE
- **Source:** N/A
- **Effort:** S

#### 22.8 — Adapter seed modules (4 files) → `seeds/adapters/` (chat_app, coding_ide, search_engine, custom)

- **Status:** done
- **File:** `N/A`
- **Classification:** DONE
- **Source:** N/A
- **Effort:** S

#### 22.9 — MCP Server scaffold → `src/mcp/server.ts` (stdio transport, tool registry, engine wiring)

- **Status:** done
- **File:** `N/A`
- **Classification:** DONE
- **Source:** N/A
- **Effort:** S

#### 22.10 — MCP tools: Session + Navigation (6 tools)

- **Status:** done
- **File:** `src/mcp/discovery-tools.ts`
- **Classification:** DONE
- **Source:** N/A
- **Effort:** S

#### 22.11 — MCP tools: DOM + Interaction (7 tools)

- **Status:** done
- **File:** `src/mcp/discovery-tools.ts`
- **Classification:** DONE
- **Source:** N/A
- **Effort:** S

#### 22.12 — MCP tools: Network Observation (4 tools)

- **Status:** done
- **File:** `src/mcp/discovery-tools.ts`
- **Classification:** DONE
- **Source:** N/A
- **Effort:** S

#### 22.13 — MCP tools: Analysis + Manifest (6 tools)

- **Status:** done
- **File:** `src/mcp/discovery-tools.ts`
- **Classification:** DONE
- **Source:** N/A
- **Effort:** S

#### 22.14 — MCP tools: Parser Testing (2 tools)

- **Status:** done
- **File:** `src/mcp/discovery-tools.ts`
- **Classification:** DONE
- **Source:** N/A
- **Effort:** S

#### 22.15 — MCP tools: Registration (2 tools)

- **Status:** done
- **File:** `src/mcp/discovery-tools.ts`
- **Classification:** DONE
- **Source:** N/A
- **Effort:** S

### Phase 90

#### 90.1 — Monorepo scaffold (web/, packages) — `web/` workspace

- **Status:** done
- **File:** `N/A`
- **Classification:** DONE
- **Source:** N/A
- **Effort:** S

#### 90.2 — TSConfig path aliases (@ui, @api-client) — `web/tsconfig.base.json`

- **Status:** done
- **File:** `N/A`
- **Classification:** DONE
- **Source:** N/A
- **Effort:** S

#### 90.3 — Typed API client — `web/api-client/src/index.ts`

- **Status:** done
- **File:** `N/A`
- **Classification:** DONE
- **Source:** N/A
- **Effort:** S

#### 90.4 — ActionRegistry (all UI actions) — `web/ui/src/actions/registry.ts`

- **Status:** done
- **File:** `N/A`
- **Classification:** DONE
- **Source:** N/A
- **Effort:** S

#### 90.5 — AgentBridge (agent:command parity, B8) — `web/ui/src/actions/agent-bridge.ts`

- **Status:** done
- **File:** `N/A`
- **Classification:** DONE
- **Source:** N/A
- **Effort:** S

#### 90.6 — Capability API endpoints — `src/server/conversation-router.ts` (GET /conversations/:id/capabilities, POST /conversations/:id/capabilities/:slug/execute, flattened contract)

- **Status:** done
- **File:** `N/A`
- **Classification:** DONE
- **Source:** N/A
- **Effort:** S

#### 90.7 — WS agent channel — `src/server/websocket.ts` (agent:command routing to frontend session)

- **Status:** done
- **File:** `N/A`
- **Classification:** DONE
- **Source:** N/A
- **Effort:** S

#### 90.8 — Sandbox MVP — `web/sandbox/src/app/sandbox-app.tsx` (catalog + harness + debug panel + /api/sandbox/debug reset)

- **Status:** done
- **File:** `N/A`
- **Classification:** DONE
- **Source:** N/A
- **Effort:** S

#### 90.9 — Shared UI registry + promotion ledger — `web/ui/src/registry/index.ts`, `web/sandbox/src/features/generic-capability-renderer.tsx`, `docs/sandbox/PROMOTED.md`, `bun run sandbox new <slug>`

- **Status:** done
- **File:** `N/A`
- **Classification:** DONE
- **Source:** N/A
- **Effort:** S

#### 90.10 — First feature e2e loop — single capability execution via sandbox harness → backend execute → WS events → promoted; agent reaches same via agent:command (B8 parity)

- **Status:** done
- **File:** `N/A`
- **Classification:** DONE
- **Source:** N/A
- **Effort:** S

---

## Implementation Order

1. **2.14 — ProviderEndpoint selectorsJson Rename** (CREATE, M)
1. **2.16 — ProviderStreamConfig Delta Path Validation** (PORT, M)
1. **11.11 — Executor Barrel     → `src/executor/index.ts` (wiring + factory)** (CREATE, M)
1. **11.13 — MirrorEngine Action Stubs → `src/engines/mirror-engine.ts` (3 stubs → real)** (CREATE, M)
1. **13.10 — First Feature E2E → proof that sandbox system works end-to-end** (CREATE, M)
