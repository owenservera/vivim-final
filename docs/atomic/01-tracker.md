# Atomic Implementation Tracker

**Total units:** 208 | **Done:** 148 | **Blocked:** 3 | **Pending:** 57

> Phases 1-13: v1 core + SOTA + executor + frontend (139 units)
> Phases 14-20: Sovereign AI OS Upgrade (60 units) — all pending
> Phase 21: v1 Gap Closure (41 units) — all pending
> Phase 22: Agentic Discovery Tooling (15 units) — all pending

---

## Phase 1: Skeleton ✓

- [x] 1.1 — Prisma Schema              → `prisma/schema.prisma`
- [x] 1.2 — Seed SQL (CHECK constraints, 9 views) → `prisma/seed.sql`
- [x] 1.3 — Prisma Client Singleton     → `src/storage/prisma.ts`
- [x] 1.4 — CapStoreDb (PrismaClient wrapper) → `src/storage/db.ts`
- [x] 1.5 — Tooling (biome.json, lefthook.yml, tsup.config.ts) → root configs

---

## Phase 2: Provider Knowledge Graph (12 units)

- [x] 2.1 — ProviderRegistrar           → `src/engines/provider-registrar.ts`
- [x] 2.2 — RegistrationAuditor         → `src/engines/registration-auditor.ts`
- [x] 2.3 — ConfigManager               → `src/engines/config-manager.ts`
- [x] 2.4 — ExecutionMemoizer           → `src/engines/execution-memoizer.ts`
- [x] 2.5 — Seed: claude.json           → `seeds/providers/claude.json`
- [x] 2.6 — Seed: chatgpt.json          → `seeds/providers/chatgpt.json`
- [x] 2.7 — Seed: gemini.json           → `seeds/providers/gemini.json`
- [x] 2.8 — Seed: deepseek.json         → `seeds/providers/deepseek.json`
- [x] 2.9 — Seed: studio-ai.json        → `seeds/providers/studio-ai.json`
- [x] 2.10 — Seed: z-ai.json            → `seeds/providers/z-ai.json`
- [x] 2.11 — Seed: qwen.json            → `seeds/providers/qwen.json`
- [x] 2.12 — ProviderManifest Zod schema → `src/schema/provider-manifest.ts`

---

## Phase 3: ChromeGovernor + ConversationManager (14 units)

- [x] 3.1 — ChromeGovernor (public API + boot) → `src/engines/chrome-governor.ts`
- [x] 3.2 — Governor: LifecycleManager (spawn/kill/ensure/reap) → governor subsystem
- [x] 3.3 — Governor: CDPProxy (send/capture/executeHarnessPlan) → governor subsystem
- [x] 3.4 — Governor: TraceLog (CDP tracing) → governor subsystem
- [x] 3.5 — Governor: HealthMonitor (liveness probes + circuit breaker) → governor subsystem
- [x] 3.6 — ConversationManager (8-step pipe) → `src/engines/conversation-manager.ts`
- [x] 3.7 — CapabilityEventBus (typed pub/sub) → `src/engines/capability-event-bus.ts`
- [x] 3.8 — StreamBlockStore (ContentBlock persistence) → `src/engines/stream-block-store.ts`
- [x] 3.9 — Store: GovernorStore        → `src/storage/contracts/governor-store.ts`
- [x] 3.10 — Store: ConversationStore   → `src/storage/contracts/conversation-store.ts`
- [x] 3.11 — Store: StreamBlockStore    → `src/storage/contracts/stream-block-store.ts`
- [x] 3.12 — Store: HealthStore         → `src/storage/contracts/health-store.ts`
- [x] 3.13 — Store impls: Phase 3 stores → `src/storage/impl/` (4 files)
- [x] 3.14 — ConversationManager context injection → add to 3.6 pipeline

---

## Phase 4: Core Engines (31 units)

- [x] 4.1 — StreamParserEngine          → `src/engines/stream-parser.ts`
- [x] 4.2 — CapabilityEngine            → `src/engines/capability.ts`
- [x] 4.3 — CapabilityResolutionEngine  → `src/engines/capability-resolution.ts`
- [x] 4.4 — ProviderHealthKernel        → `src/engines/provider-health.ts`
- [x] 4.5 — VersionManager              → `src/engines/version-manager.ts`
- [x] 4.6 — TelemetryAggregator         → `src/engines/telemetry-aggregator.ts`
- [x] 4.7 — HarnessRuntime              → `src/engines/harness-runtime.ts`
- [x] 4.8 — Parser Seed: claude/sse     → `seeds/parsers/claude/001_streaming_sse.ts`
- [x] 4.9 — Parser Seed: gemini/batch   → `seeds/parsers/gemini/001_batchexecute.ts`
- [x] 4.10 — Parser Seed: chatgpt/sse   → `seeds/parsers/chatgpt/001_openai_sse.ts`
- [x] 4.11 — Parser Seed: generic/sse   → `seeds/parsers/generic/001_sse_frames.ts`
- [x] 4.12 — Parser Seed: generic/delta → `seeds/parsers/generic/002_openai_delta.ts`
- [x] 4.13 — Parser Seed: fallback      → `seeds/parsers/system/001_fallback.ts`
- [x] 4.14 — Harness: composer.module   → `seeds/harness/composer.module.ts`
- [x] 4.15 — Harness: login.module      → `seeds/harness/login.module.ts`
- [x] 4.16 — Harness: navigation.module → `seeds/harness/navigation.module.ts`
- [x] 4.17 — Harness: capture.module    → `seeds/harness/capture.module.ts`
- [x] 4.18 — Harness: selector.module   → `seeds/harness/selector.module.ts`
- [x] 4.19 — Store contracts: Phase 4   → `src/storage/contracts/` (6 files)
- [x] 4.20 — Store impls: Phase 4       → `src/storage/impl/` (6 files)
- [x] 4.21 — Alerting subsystem (Alerter) → `src/alerting/alerter.ts` (ported survivor)
- [x] 4.22 — Automation scheduler        → `src/automation/scheduler.ts` (ported survivor)
- [x] 4.23 — Router subsystem            → `src/router/` (ported survivor)
- [x] 4.24 — HarnessCheckpoint persistence → `src/engines/harness-checkpoint.ts`
- [x] 4.25 — CapabilityMacro support     → `src/engines/capability-macro.ts`
- [x] 4.26 — Session checkpointing       → `src/engines/session-checkpoint.ts`
- [x] 4.27 — Survivor: src/errors.ts      → `src/errors.ts` (port/verify)
- [x] 4.28 — Survivor: src/config.ts      → `src/config.ts` (port/verify)
- [x] 4.29 — Survivor: src/executor/*     → `src/executor/` (6 files, port/verify)
- [x] 4.30 — State Transition recording   → `src/engines/state-transition.ts`
- [x] 4.31 — Shared types + barrel exports → `src/schema/types.ts` + `src/index.ts`

---

## Phase 5: Server + SDK + CLI (13 units)

- [x] 5.1 — Server entry (Bun.serve + routes) → `src/server/index.ts`
- [x] 5.2 — Response helpers (CORS + JSON) → `src/server/response.ts`
- [x] 5.3 — WebSocket bridge + EventBus integration → `src/server/websocket.ts`
- [x] 5.4 — Conversation Router         → `src/server/conversation-router.ts`
- [x] 5.5 — Auth Gate (Bearer token)    → `src/server/auth-gate.ts`
- [x] 5.6 — SDK Client (full typed)     → `sdk/src/client.ts`
- [x] 5.7 — CLI entry + command registry → `src/cli/index.ts`
- [x] 5.8 — CLI: output formatter       → `src/cli/output-formatter.ts`
- [x] 5.9 — CLI: pipeline engine        → `src/cli/pipeline-engine.ts`
- [x] 5.10 — CLI: bridges (3 files)     → `src/cli/bridges/`
- [x] 5.11 — CLI: commands (9 files)    → `src/cli/commands/`
- [x] 5.12 — Zod Validators (all endpoints) → `src/schema/validators.ts`

---

## Phase 6: Ship (3 units)

- [x] 6.1 — Doc alignment (verify all 25+ items) → check against merged-design-v2
- [x] 6.2 — E2E tests (Claude, ChatGPT, Gemini, multi-turn) → `tests/e2e/`
- [x] 6.3 — Performance gates (latency budgets, resource limits) → perf profile

---

## Phase 7: SOTA Priority Pipe (8 units)

- [x] 7.1 — MirrorEngine (UI ⇄ Chrome bidirectional sync) → `src/engines/mirror-engine.ts`
- [x] 7.2 — ObservationTap (Governor subsystem) → add to ChromeGovernor
- [x] 7.3 — AgenticLoopEngine (sense→plan→act→observe→reflect) → `src/engines/agentic-loop.ts`
- [x] 7.4 — ToolUseProtocol (agentic loop ↔ capability bridge) → `src/engines/tool-use-protocol.ts`
- [x] 7.5 — Latency budgets + optimistic updates → mirror-engine subsystem
- [x] 7.6 — UI Mirror State persistence → `src/storage/contracts/mirror-store.ts`
- [x] 7.7 — Live observation projection → observation-tap subsystem
- [x] 7.8 — Store impls: Phase 7        → `src/storage/impl/`

---

## Phase 8: SOTA Shape-Agnostic Registration (6 units)

- [x] 8.1 — CapabilityShapeRegistry     → `src/engines/capability-shape-registry.ts`
- [x] 8.2 — ProviderDiscoveryEngine     → `src/engines/provider-discovery.ts`
- [x] 8.3 — ManifestInferenceEngine     → `src/engines/manifest-inference.ts`
- [x] 8.4 — Polymorphic resolution      → add to CapabilityResolutionEngine
- [x] 8.5 — Plugin system (self-describing providers) → `src/engines/plugin-system.ts`
- [x] 8.6 — Schema delta: Phase 8 tables → SOTA-07 new tables

---

## Phase 9: SOTA Workflow + Browser Automation (10 units)

- [x] 9.1 — WorkflowEngine (DAG execution) → `src/engines/workflow-engine.ts`
- [x] 9.2 — WorkflowCompiler (visual JSON → HarnessDAG) → `src/engines/workflow-compiler.ts`
- [x] 9.3 — SemanticGroundingEngine (accessibility + visual) → `src/engines/semantic-grounding.ts`
- [x] 9.4 — SelectorHealer (LLM-powered repair) → `src/engines/selector-healer.ts`
- [x] 9.5 — Shadow DOM traversal         → add to SemanticGroundingEngine
- [x] 9.6 — Cross-origin frame support   → add to SemanticGroundingEngine
- [x] 9.7 — Anti-detection stealth       → `seeds/harness/stealth.module.ts`
- [x] 9.8 — Human-in-the-loop workflow   → add to WorkflowEngine
- [x] 9.9 — Webhook triggers             → add to WorkflowEngine
- [x] 9.10 — Schema delta: Phase 9 tables → SOTA-07 new tables

---

## Phase 10: SOTA Memory + MCP + Harness Protocol (13 units)

- [x] 10.1 — MemoryEngine (episodic)     → `src/engines/memory-engine.ts`
- [x] 10.2 — MemoryEngine (semantic)     → memory-engine subsystem
- [x] 10.3 — MemoryEngine (procedural)   → memory-engine subsystem
- [x] 10.4 — TransferAccelerator         → `src/engines/transfer-accelerator.ts`
- [x] 10.5 — StreamingProtocol (progressive blocks) → replace batch-only
- [x] 10.6 — McpServerAdapter (Governor as MCP server) → `src/engines/mcp-server-adapter.ts`
- [x] 10.7 — McpClientAdapter (MCP providers) → `src/engines/mcp-client-adapter.ts`
- [x] 10.8 — HarnessProtocolEngine: PromptAugmenter → `src/engines/harness-protocol-engine.ts`
- [x] 10.9 — HarnessProtocolEngine: ResponseExtractor → HPE subsystem
- [x] 10.10 — HarnessProtocolEngine: ActionRouter + feedback loop → HPE subsystem
- [x] 10.11 — Schema delta: Phase 10 tables (~28 new) → SOTA-07 full schema delta
- [x] 10.12 — Store impls: Phase 8-10    → `src/storage/impl/`
- [x] 10.13 — HPE hpe_session store contract → `src/storage/contracts/hpe-session-store.ts`

---

## Blocked Units

(None yet — will be populated as blockers are discovered)

---

---

## Phase 11: Executor Porting (14 units)

Truth-grounded rebuild: port executor files from cap-store, fix design doc claims.

- [x] 11.1 — CDP Client           → `src/executor/cdp.ts` (built against vivim-final core)
- [x] 11.2 — Chrome Launcher      → `src/executor/launcher.ts` (built against vivim-final core)
- [x] 11.3 — Profile Allocator    → `src/executor/profile-allocator.ts` (built against vivim-final core)
- [x] 11.4 — Port Reaper          → `src/executor/port-reaper.ts` (built against vivim-final core)
- [x] 11.5 — Fleet Supervisor     → `src/executor/fleet-supervisor.ts` (built against vivim-final core)
  - Integration tests: `tests/integration/executor/fleet-integration.test.ts`
- [x] 11.6 — Slave Write          → `src/executor/slave-write.ts` (built against vivim-final core)
- [>] 11.7 — Slave Read           → SKIPPED — redundant (CdpTransportImpl + HarnessRuntime cover all methods)
- [>] 11.8 — Conversation Driver  → SKIPPED — superseded by ConversationManager (Phase 3.6)
- [>] 11.9 — Stream Capture       → SKIPPED — superseded by StreamBlockStore (Phase 3.8)
- [>] 11.10 — Network Capture     → SKIPPED — superseded by ObservationTap (Phase 7.2)
- [!] 11.11 — Executor Barrel     → `src/executor/index.ts` (wiring + factory)
- [>] 11.12 — ChromeGovernor Boot Stubs → REDUNDANT — superseded by Phase 14.2-14.4
- [!] 11.13 — MirrorEngine Action Stubs → `src/engines/mirror-engine.ts` (3 stubs → real)
- [x] 11.14 — Slave Setup Script   → `scripts/setup-slaves.ts` (bootstrap logged-in profiles for chatgpt/claude/gemini; manual login + headless reuse)

---

## Phase 13: Frontend Sandbox System (10 units)

Frontend-native sandbox for testing backend capabilities. Enforces B8 (Agent-Addressable UI Actions).

- [x] 13.1 — Monorepo Scaffold → `web/` workspace (Vite + React 19 + TS + Tailwind + Zustand)
- [x] 13.2 — Shared tsconfig + Path Aliases → `web/tsconfig.base.json` + `@ui`, `@api-client` aliases
- [x] 13.3 — web/api-client Typed SDK → `web/api-client/src/index.ts` (typed from 07-merged-api.md)
- [x] 13.4 — ActionRegistry → `web/ui/src/actions/registry.ts` (registerAction / dispatch / listActions)
- [x] 13.5 — AgentBridge → `web/ui/src/actions/agent-bridge.ts` (WS agent:command / agent:discover)
- [x] 13.6 — Capability API Endpoints → `src/server/routes/capabilities.ts` (GET /capabilities, POST /execute)
- [x] 13.7 — WS Agent Command Channel → `src/server/websocket.ts` (agent:command / agent:discover routing)
- [x] 13.8 — Sandbox App MVP → `web/sandbox/` (catalog + harness + debug panel)
- [x] 13.9 — Provider Setup Wizard → `web/ui/src/features/provider-setup-wizard.tsx` (workspace selection + Chrome login UI)
- [!] 13.10 — First Feature E2E → proof that sandbox system works end-to-end

---

## Phase 14: Wire Stubs → Real CDP (8 units)

Replace stub implementations with real CDP transport and wiring.

- [x] 14.1 — CDPTransport Implementation → `src/executor/cdp-transport.ts`
- [x] 14.2 — ChromeGovernor CDP Real → `src/engines/chrome-governor.ts`
- [x] 14.3 — ChromeGovernor Trace Real → governor subsystem
- [x] 14.4 — ChromeGovernor Health Probe Real → governor subsystem
- [x] 14.5 — ConversationManager EventBus Fix → `src/engines/conversation-manager.ts`
- [x] 14.6 — Server → ConversationManager Wiring → `src/server/index.ts`
- [x] 14.7 — HarnessRuntime Real Context → `src/engines/harness-runtime.ts`
- [x] 14.8 — Router listRequests/getEvents + RouterStore → `src/router/`

---

## Phase 15: Sovereign Intelligence Layer (12 units)

Ingest, extract, search, and synthesize knowledge across all conversations.

- [x] 15.1 — KnowledgeIngestionEngine + Store → `src/engines/knowledge-ingestion.ts`
- [x] 15.2 — ChatGPT Export Parser → `seeds/parsers/chatgpt/export.ts`
- [x] 15.3 — Claude Export Parser → `seeds/parsers/claude/export.ts`
- [x] 15.4 — Gemini Export Parser → `seeds/parsers/gemini/export.ts`
- [x] 15.5 — KnowledgeExtractor (facts, decisions, patterns, entities) → `src/engines/knowledge-extractor.ts`
- [x] 15.6 — SemanticSearchEngine + Embedding Store → `src/engines/semantic-search.ts`
- [x] 15.7 — CrossConversationSynthesisEngine → `src/engines/cross-conversation-synthesis.ts`
- [x] 15.8 — Full Export Engine (JSON/CSV) → `src/engines/full-export.ts`
- [x] 15.9 — Schema: Memory Intelligence Tables → `prisma/schema.prisma`
- [x] 15.10 — Memory Engine ULID Fix + 10-type expansion → `src/engines/memory-engine.ts`
- [ ] 15.11 — Topic/Project Organization → `src/engines/conversation-organization.ts`
- [ ] 15.12 — Memory Consolidation Daemon → `src/engines/memory-consolidation.ts`

---

## Phase 16: Invisible Router (8 units)

Multi-provider mux, round-robin, failover, cost optimization.

- [ ] 16.1 — ProviderMuxEngine + Store → `src/engines/provider-mux.ts`
- [ ] 16.2 — Round-Robin Deep Research → mux subsystem
- [ ] 16.3 — Response Synthesis Engine → `src/engines/response-synthesis.ts`
- [ ] 16.4 — Automatic Failover → mux subsystem
- [ ] 16.5 — Cost Optimization Engine → `src/engines/cost-optimizer.ts`
- [ ] 16.6 — Learned Routing Preferences → mux subsystem
- [ ] 16.7 — Schema: Mux Tables → `prisma/schema.prisma`
- [ ] 16.8 — Server Routes for Mux → `src/server/routes/mux.ts`

---

## Phase 17: Context-Aware Agent (6 units)

Situation detection, 5-stage context assembly, predictive pre-warming.

- [ ] 17.1 — SituationDetector + Store → `src/engines/situation-detector.ts`
- [ ] 17.2 — ContextAssemblyEngine (5-stage pipeline) → `src/engines/context-assembly.ts`
- [ ] 17.3 — Predictive Pre-warming → context subsystem
- [ ] 17.4 — Budget-Aware Token Allocation → context subsystem
- [ ] 17.5 — Schema: Context Tables → `prisma/schema.prisma`
- [ ] 17.6 — ConversationManager Integration → `src/engines/conversation-manager.ts`

---

## Phase 18: Composable Interface (10 units)

Unified capability registry, CLI, workflow builder, plugin hot-reload, adaptive UI.

- [ ] 18.1 — UnifiedCapabilityRegistry → `src/engines/unified-capability-registry.ts`
- [ ] 18.2 — CLI Complete (all capabilities as commands) → `src/cli/`
- [ ] 18.3 — Workflow Builder API → `src/engines/workflow-builder.ts`
- [ ] 18.4 — Plugin Hot-Reload System → `src/engines/plugin-hot-reload.ts`
- [ ] 18.5 — WebSocket Agent Bridge V2 → `src/server/websocket.ts`
- [ ] 18.6 — Adaptive Workspace Modes → `src/engines/adaptive-workspace.ts`
- [ ] 18.7 — Conversation Organization (Projects/Topics) → `src/engines/conversation-organization.ts`
- [ ] 18.8 — Memory Visualization API → `src/server/routes/memory-viz.ts`
- [ ] 18.9 — Schema: Workspace Tables → `prisma/schema.prisma`
- [ ] 18.10 — Progressive Disclosure UI → `web/ui/src/`

---

## Phase 19: Autonomous Execution (8 units)

Full autonomous execution engine, self-healing pipeline, HITL gates.

- [ ] 19.1 — AutonomousExecutionEngine → `src/engines/autonomous-execution.ts`
- [ ] 19.2 — Enhanced Harness (real CDP integration) → `src/engines/harness-runtime.ts`
- [ ] 19.3 — Visual Workflow DAG Engine → `src/engines/visual-workflow-dag.ts`
- [ ] 19.4 — Self-Healing Pipeline → `src/engines/self-healing.ts`
- [ ] 19.5 — Human-in-the-Loop Gates → `src/engines/hitl-gates.ts`
- [ ] 19.6 — Full Observability Layer → `src/engines/observability.ts`
- [ ] 19.7 — Schema: Autonomous Tables → `prisma/schema.prisma`
- [ ] 19.8 — Execution Policy Engine → `src/engines/execution-policy.ts`

---

## Phase 20: Sovereign Data (8 units)

At-rest encryption, export, air-gap mode, sync, telemetry audit.

- [ ] 20.1 — EncryptionEngine (at-rest) → `src/engines/encryption.ts`
- [ ] 20.2 — WAL Mode Configuration → `prisma/schema.prisma`
- [ ] 20.3 — Export Engine (full JSON/CSV) → `src/engines/export-engine.ts`
- [ ] 20.4 — Air-Gap Mode → `src/engines/airgap-engine.ts`
- [ ] 20.5 — Local Model Integration (Ollama/llama.cpp) → `src/engines/local-model-adapter.ts`
- [ ] 20.6 — SyncEngine (E2E-encrypted) → `src/engines/sync-engine.ts`
- [ ] 20.7 — Telemetry Audit (zero-cloud proof) → `src/engines/telemetry-audit.ts`
- [ ] 20.8 — Schema: Sovereign Data Tables → `prisma/schema.prisma`

---

## Phase 21: v1 Gap Closure (41 units)

Close all 41 remaining gaps from the original v1 gap analysis that were NOT addressed by Phases 14-20.

### 21.1 — Store Implementations (6 units)

- [ ] 21.1.1 — WorkflowStoreImpl → `src/storage/impl/workflow-store-impl.ts`
- [ ] 21.1.2 — CapabilityMacroStoreImpl → `src/storage/impl/capability-macro-store-impl.ts`
- [ ] 21.1.3 — HarnessCheckpointStoreImpl → `src/storage/impl/harness-checkpoint-store-impl.ts`
- [ ] 21.1.4 — AlertStoreImpl → `src/storage/impl/alert-store-impl.ts`
- [ ] 21.1.5 — AutomationStoreImpl → `src/storage/impl/automation-store-impl.ts`
- [ ] 21.1.6 — HpeSessionStoreImpl → `src/storage/impl/hpe-session-store-impl.ts`

### 21.2 — MCP/Mirror Stub Fixes (4 units)

- [ ] 21.2.1 — McpServerAdapter HTTP bind → `src/engines/mcp-server-adapter.ts`
- [ ] 21.2.2 — McpClientAdapter real connection → `src/engines/mcp-client-adapter.ts`
- [ ] 21.2.3 — MirrorEngine.sendAction → Governor CDP → `src/engines/mirror-engine.ts`
- [ ] 21.2.4 — MirrorEngine.startObservation → ObservationTap → `src/engines/mirror-engine.ts`

### 21.3 — Schema Type Mismatches (3 units)

- [ ] 21.3.1 — ConfigEntryRow alignment → `src/schema/types.ts`
- [ ] 21.3.2 — HealthHistoryRow alignment → `src/schema/types.ts`
- [ ] 21.3.3 — SelectorStrategyRow alignment → `src/storage/contracts/capability-store.ts`

### 21.4 — Protocol Integration (3 units)

- [ ] 21.4.1 — StreamingProtocol → StreamBlockStore → `src/engines/streaming-protocol.ts`
- [ ] 21.4.2 — ToolUseProtocol implementation → `src/engines/tool-use-protocol.ts`
- [ ] 21.4.3 — TelemetryAggregator cron scheduling → `src/engines/telemetry-aggregator.ts`

### 21.5 — Test Coverage (25 units)

- [ ] 21.5.1 — MemoryEngine tests → `tests/unit/engines/memory-engine.test.ts`
- [ ] 21.5.2 — HarnessRuntime tests → `tests/unit/engines/harness-runtime.test.ts`
- [ ] 21.5.3 — MirrorEngine tests → `tests/unit/engines/mirror-engine.test.ts`
- [ ] 21.5.4 — SelectorHealer tests → `tests/unit/engines/selector-healer.test.ts`
- [ ] 21.5.5 — SemanticGroundingEngine tests → `tests/unit/engines/semantic-grounding.test.ts`
- [ ] 21.5.6 — ObservationTap tests → `tests/unit/engines/observation-tap.test.ts`
- [ ] 21.5.7 — WorkflowEngine tests → `tests/unit/engines/workflow-engine.test.ts`
- [ ] 21.5.8 — WorkflowCompiler tests → `tests/unit/engines/workflow-compiler.test.ts`
- [ ] 21.5.9 — AgenticLoopEngine tests → `tests/unit/engines/agentic-loop.test.ts`
- [ ] 21.5.10 — TransferAccelerator tests → `tests/unit/engines/transfer-accelerator.test.ts`
- [ ] 21.5.11 — StreamingProtocol tests → `tests/unit/engines/streaming-protocol.test.ts`
- [ ] 21.5.12 — HarnessProtocolEngine tests → `tests/unit/engines/harness-protocol-engine.test.ts`
- [ ] 21.5.13 — PluginSystem tests → `tests/unit/engines/plugin-system.test.ts`
- [ ] 21.5.14 — McpServerAdapter tests → `tests/unit/engines/mcp-server-adapter.test.ts`
- [ ] 21.5.15 — McpClientAdapter tests → `tests/unit/engines/mcp-client-adapter.test.ts`
- [ ] 21.5.16 — ProviderDiscoveryEngine tests → `tests/unit/engines/provider-discovery.test.ts`
- [ ] 21.5.17 — ManifestInferenceEngine tests → `tests/unit/engines/manifest-inference.test.ts`
- [ ] 21.5.18 — CapabilityShapeRegistry tests → `tests/unit/engines/capability-shape-registry.test.ts`
- [ ] 21.5.19 — SessionCheckpointEngine tests → `tests/unit/engines/session-checkpoint.test.ts`
- [ ] 21.5.20 — StateTransitionEngine tests → `tests/unit/engines/state-transition.test.ts`
- [ ] 21.5.21 — HarnessCheckpointEngine tests → `tests/unit/engines/harness-checkpoint.test.ts`
- [ ] 21.5.22 — CapabilityMacroEngine tests → `tests/unit/engines/capability-macro.test.ts`
- [ ] 21.5.23 — Router tests → `tests/unit/engines/router.test.ts`
- [ ] 21.5.24 — Alerter tests → `tests/unit/engines/alerter.test.ts`
- [ ] 21.5.25 — Scheduler tests → `tests/unit/engines/scheduler.test.ts`

---

## Phase 22: Agentic Discovery Tooling (15 units)

MCP server exposing provider discovery as agent-callable tools. Agent drives the full loop: URL → DOM inspection → shape matching → capability inference → manifest generation → registration.

### 22.1–22.4: Store Contracts + Impls

- [ ] 22.1 — DiscoveryStore contract → `src/storage/contracts/discovery-store.ts`
- [ ] 22.2 — DiscoveryStore Prisma impl → `src/storage/impl/discovery-store-impl.ts`
- [ ] 22.3 — ShapeBindingStore contract → `src/storage/contracts/shape-binding-store.ts`
- [ ] 22.4 — ShapeBindingStore Prisma impl → `src/storage/impl/shape-binding-store-impl.ts`

### 22.5–22.8: Engine Enhancements

- [ ] 22.5 — Enhanced ProviderDiscoveryEngine → `src/engines/provider-discovery.ts` (persistence, CDP ops, network obs, interactive probing)
- [ ] 22.6 — Enhanced ManifestInferenceEngine → `src/engines/manifest-inference.ts` (confidence scoring, needsReview, llmInferred)
- [ ] 22.7 — Enhanced CapabilityShapeRegistry → `src/engines/capability-shape-registry.ts` (adapter loading, shape inheritance)
- [ ] 22.8 — Adapter seed modules (4 files) → `seeds/adapters/` (chat_app, coding_ide, search_engine, custom)

### 22.9–22.15: MCP Server + Tools

- [ ] 22.9 — MCP Server scaffold → `src/mcp/server.ts` (stdio transport, tool registry, engine wiring)
- [ ] 22.10 — MCP tools: Session + Navigation (6 tools) → `src/mcp/discovery-tools.ts`
- [ ] 22.11 — MCP tools: DOM + Interaction (7 tools) → `src/mcp/discovery-tools.ts`
- [ ] 22.12 — MCP tools: Network Observation (4 tools) → `src/mcp/discovery-tools.ts`
- [ ] 22.13 — MCP tools: Analysis + Manifest (6 tools) → `src/mcp/discovery-tools.ts`
- [ ] 22.14 — MCP tools: Parser Testing (2 tools) → `src/mcp/discovery-tools.ts`
- [ ] 22.15 — MCP tools: Registration (2 tools) → `src/mcp/discovery-tools.ts`

---

## Last Updated
 2026-07-11
2026-07-11