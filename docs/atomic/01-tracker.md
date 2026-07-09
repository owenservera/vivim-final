# Atomic Implementation Tracker

**Total units:** 114 | **Done:** 37 | **Blocked:** 0 | **Pending:** 77

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
- [ ] 4.7 — HarnessRuntime              → `src/engines/harness-runtime.ts`
- [ ] 4.8 — Parser Seed: claude/sse     → `seeds/parsers/claude/001_streaming_sse.ts`
- [ ] 4.9 — Parser Seed: gemini/batch   → `seeds/parsers/gemini/001_batchexecute.ts`
- [ ] 4.10 — Parser Seed: chatgpt/sse   → `seeds/parsers/chatgpt/001_openai_sse.ts`
- [ ] 4.11 — Parser Seed: generic/sse   → `seeds/parsers/generic/001_sse_frames.ts`
- [ ] 4.12 — Parser Seed: generic/delta → `seeds/parsers/generic/002_openai_delta.ts`
- [ ] 4.13 — Parser Seed: fallback      → `seeds/parsers/system/001_fallback.ts`
- [ ] 4.14 — Harness: composer.module   → `seeds/harness/composer.module.ts`
- [ ] 4.15 — Harness: login.module      → `seeds/harness/login.module.ts`
- [ ] 4.16 — Harness: navigation.module → `seeds/harness/navigation.module.ts`
- [ ] 4.17 — Harness: capture.module    → `seeds/harness/capture.module.ts`
- [ ] 4.18 — Harness: selector.module   → `seeds/harness/selector.module.ts`
- [ ] 4.19 — Store contracts: Phase 4   → `src/storage/contracts/` (6 files)
- [ ] 4.20 — Store impls: Phase 4       → `src/storage/impl/` (6 files)
- [ ] 4.21 — Alerting subsystem (Alerter) → `src/alerting/alerter.ts` (ported survivor)
- [ ] 4.22 — Automation scheduler        → `src/automation/scheduler.ts` (ported survivor)
- [ ] 4.23 — Router subsystem            → `src/router/` (ported survivor)
- [ ] 4.24 — HarnessCheckpoint persistence → `src/engines/harness-checkpoint.ts`
- [ ] 4.25 — CapabilityMacro support     → `src/engines/capability-macro.ts`
- [ ] 4.26 — Session checkpointing       → `src/engines/session-checkpoint.ts`
- [ ] 4.27 — Survivor: src/errors.ts      → `src/errors.ts` (port/verify)
- [ ] 4.28 — Survivor: src/config.ts      → `src/config.ts` (port/verify)
- [ ] 4.29 — Survivor: src/executor/*     → `src/executor/` (6 files, port/verify)
- [ ] 4.30 — State Transition recording   → `src/engines/state-transition.ts`
- [ ] 4.31 — Shared types + barrel exports → `src/schema/types.ts` + `src/index.ts`

---

## Phase 5: Server + SDK + CLI (13 units)

- [ ] 5.1 — Server entry (Bun.serve + routes) → `src/server/index.ts`
- [ ] 5.2 — Response helpers (CORS + JSON) → `src/server/response.ts`
- [ ] 5.3 — WebSocket bridge + EventBus integration → `src/server/websocket.ts`
- [ ] 5.4 — Conversation Router         → `src/server/conversation-router.ts`
- [ ] 5.5 — Auth Gate (Bearer token)    → `src/server/auth-gate.ts`
- [ ] 5.6 — SDK Client (full typed)     → `sdk/src/client.ts`
- [ ] 5.7 — CLI entry + command registry → `src/cli/index.ts`
- [ ] 5.8 — CLI: output formatter       → `src/cli/output-formatter.ts`
- [ ] 5.9 — CLI: pipeline engine        → `src/cli/pipeline-engine.ts`
- [ ] 5.10 — CLI: bridges (3 files)     → `src/cli/bridges/`
- [ ] 5.11 — CLI: commands (9 files)    → `src/cli/commands/`
- [ ] 5.12 — Zod Validators (all endpoints) → `src/schema/validators.ts`

---

## Phase 6: Ship (3 units)

- [ ] 6.1 — Doc alignment (verify all 25+ items) → check against merged-design-v2
- [ ] 6.2 — E2E tests (Claude, ChatGPT, Gemini, multi-turn) → `tests/e2e/`
- [ ] 6.3 — Performance gates (latency budgets, resource limits) → perf profile

---

## Phase 7: SOTA Priority Pipe (8 units)

- [ ] 7.1 — MirrorEngine (UI ⇄ Chrome bidirectional sync) → `src/engines/mirror-engine.ts`
- [ ] 7.2 — ObservationTap (Governor subsystem) → add to ChromeGovernor
- [ ] 7.3 — AgenticLoopEngine (sense→plan→act→observe→reflect) → `src/engines/agentic-loop.ts`
- [ ] 7.4 — ToolUseProtocol (agentic loop ↔ capability bridge) → `src/engines/tool-use-protocol.ts`
- [ ] 7.5 — Latency budgets + optimistic updates → mirror-engine subsystem
- [ ] 7.6 — UI Mirror State persistence → `src/storage/contracts/mirror-store.ts`
- [ ] 7.7 — Live observation projection → observation-tap subsystem
- [ ] 7.8 — Store impls: Phase 7        → `src/storage/impl/`

---

## Phase 8: SOTA Shape-Agnostic Registration (6 units)

- [ ] 8.1 — CapabilityShapeRegistry     → `src/engines/capability-shape-registry.ts`
- [ ] 8.2 — ProviderDiscoveryEngine     → `src/engines/provider-discovery.ts`
- [ ] 8.3 — ManifestInferenceEngine     → `src/engines/manifest-inference.ts`
- [ ] 8.4 — Polymorphic resolution      → add to CapabilityResolutionEngine
- [ ] 8.5 — Plugin system (self-describing providers) → `src/engines/plugin-system.ts`
- [ ] 8.6 — Schema delta: Phase 8 tables → SOTA-07 new tables

---

## Phase 9: SOTA Workflow + Browser Automation (10 units)

- [ ] 9.1 — WorkflowEngine (DAG execution) → `src/engines/workflow-engine.ts`
- [ ] 9.2 — WorkflowCompiler (visual JSON → HarnessDAG) → `src/engines/workflow-compiler.ts`
- [ ] 9.3 — SemanticGroundingEngine (accessibility + visual) → `src/engines/semantic-grounding.ts`
- [ ] 9.4 — SelectorHealer (LLM-powered repair) → `src/engines/selector-healer.ts`
- [ ] 9.5 — Shadow DOM traversal         → add to SemanticGroundingEngine
- [ ] 9.6 — Cross-origin frame support   → add to SemanticGroundingEngine
- [ ] 9.7 — Anti-detection stealth       → `seeds/harness/stealth.module.ts`
- [ ] 9.8 — Human-in-the-loop workflow   → add to WorkflowEngine
- [ ] 9.9 — Webhook triggers             → add to WorkflowEngine
- [ ] 9.10 — Schema delta: Phase 9 tables → SOTA-07 new tables

---

## Phase 10: SOTA Memory + MCP + Harness Protocol (13 units)

- [ ] 10.1 — MemoryEngine (episodic)     → `src/engines/memory-engine.ts`
- [ ] 10.2 — MemoryEngine (semantic)     → memory-engine subsystem
- [ ] 10.3 — MemoryEngine (procedural)   → memory-engine subsystem
- [ ] 10.4 — TransferAccelerator         → `src/engines/transfer-accelerator.ts`
- [ ] 10.5 — StreamingProtocol (progressive blocks) → replace batch-only
- [ ] 10.6 — McpServerAdapter (Governor as MCP server) → `src/engines/mcp-server-adapter.ts`
- [ ] 10.7 — McpClientAdapter (MCP providers) → `src/engines/mcp-client-adapter.ts`
- [ ] 10.8 — HarnessProtocolEngine: PromptAugmenter → `src/engines/harness-protocol-engine.ts`
- [ ] 10.9 — HarnessProtocolEngine: ResponseExtractor → HPE subsystem
- [ ] 10.10 — HarnessProtocolEngine: ActionRouter + feedback loop → HPE subsystem
- [ ] 10.11 — Schema delta: Phase 10 tables (~28 new) → SOTA-07 full schema delta
- [ ] 10.12 — Store impls: Phase 8-10    → `src/storage/impl/`
- [ ] 10.13 — HPE hpe_session store contract → `src/storage/contracts/hpe-session-store.ts`

---

## Blocked Units

(None yet — will be populated as blockers are discovered)

---

## Last Updated
 2026-07-09
2026-07-09
