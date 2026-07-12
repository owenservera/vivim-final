# Cross-Version Gap Analysis & Implementation Strategy

*Generated: 2026-07-12 | Versions: v3 (108 units) + v4 (71 units) + v5 (85 units) = 264 total planned*

## Executive Summary

Three plan versions exist with significant overlap. v5 = v4 + Kernel, v4 = user-journey driven rewrite of v3's abstract phases. The codebase already has **61 engine files, 34 store contracts, 15+ server routes**. The real work is not building from scratch — it's completing stubs, wiring gaps, and adding the kernel layer.

**Key finding:** ~30% of v3 units map to existing code that needs FIX (stubs, wiring), ~20% are DONE (already implemented), ~50% need CREATE. v4/v5 Phase 0 (Kernel) is entirely new. The implementation strategy must prioritize **Phase 0 Kernel → v4 Phase 1-2 (E2E Bootstrap + Single-Turn) → then branch**.

---

## 1. Codebase Inventory (What Exists)

### Engines (61 files in `src/engines/`)

| Engine | Status | Notes |
|--------|--------|-------|
| `agentic-loop.ts` | ✅ Real | SENSE→PLAN→ACT→OBSERVE→REFLECT→ADAPT |
| `autonomous-execution.ts` | ✅ Real | Multi-step executor with HITL gates |
| `chrome-governor.ts` | ⚠️ Partial | `executeHarnessPlan()` is STUB (line 192) |
| `conversation-manager.ts` | ✅ Real | 8-step send pipeline |
| `context-assembly.ts` | ✅ Real | 5-stage pipeline |
| `knowledge-extractor.ts` | ✅ Real | Facts/decisions/entities extraction |
| `memory-engine.ts` | ✅ Real | Episodic/semantic/procedural |
| `mirror-engine.ts` | ✅ Real | UI⇄Chrome bidirectional sync |
| `provider-health.ts` | ✅ Real | 6-signal weighted scoring |
| `stream-parser.ts` | ✅ Real | SSE/streaming parser |
| `telemetry-aggregator.ts` | ✅ Real | 4 schedules |
| `unified-registry.ts` | ✅ Real | Capabilities with surfaces |
| `capability-event-bus.ts` | ⚠️ Needs Upgrade | No error isolation, no envelopes, no wildcards |
| `config-manager.ts` | ✅ Real | Schema registration + audit |
| `fleet-supervisor.ts` | ✅ Real | Chrome lifecycle + circuit breaker |
| `provider-mux.ts` | ✅ Real | Provider dispatch |
| `registration-auditor.ts` | ✅ Real | Audit checks |
| `selector-healer.ts` | ✅ Real | Selector repair |
| `session-checkpoint.ts` | ✅ Real | Session state |
| `harness-runtime.ts` | ⚠️ Stub | `executeHarnessPlan` not implemented |
| `harness-checkpoint.ts` | ✅ Real | Checkpoint save/restore |
| `execution-memoizer.ts` | ✅ Real | Memoization |
| `execution-policy.ts` | ✅ Real | Policy engine |
| `observation-tap.ts` | ✅ Real | Tap events |
| `cost-optimizer.ts` | ✅ Real | Cost tracking |
| `capability-resolution.ts` | ✅ Real | Selector resolution |
| `capability-shape-registry.ts` | ✅ Real | Shape registry |
| `knowledge-ingestion.ts` | ✅ Real | Ingestion pipeline |
| `cross-conversation-synthesis.ts` | ✅ Real | Synthesis |
| `semantic-search.ts` | ✅ Real | Semantic search |
| `state-transition.ts` | ✅ Real | State machine |
| `version-manager.ts` | ✅ Real | Version management |
| `workflow-engine.ts` | ✅ Real | Workflow engine |
| `workflow-compiler.ts` | ✅ Real | Workflow compiler |
| `plugin-system.ts` | ✅ Real | Plugin system |
| `plugin-hot-reload.ts` | ✅ Real | Hot reload |
| `mcp-server-adapter.ts` | ✅ Real | MCP server |
| `mcp-client-adapter.ts` | ✅ Real | MCP client |
| `local-model-adapter.ts` | ✅ Real | Local model |
| `manifest-inference.ts` | ✅ Real | Manifest inference |
| `transfer-accelerator.ts` | ✅ Real | Transfer acceleration |
| `tool-use-protocol.ts` | ✅ Real | Tool use protocol |
| `streaming-protocol.ts` | ✅ Real | Streaming protocol |
| `stream-block-store.ts` | ✅ Real | Block store |
| `airgap.ts` | ✅ Real | Airgap mode |
| `adaptive-workspace.ts` | ✅ Real | Adaptive workspace |
| `encryption.ts` | ✅ Real | Encryption |
| `export.ts` | ✅ Real | Export |
| `sync.ts` | ✅ Real | Sync |
| `capability.ts` | ✅ Real | Base capability |
| `capability-bootstrap.ts` | ✅ Real | Bootstrap |
| `capability-macro.ts` | ✅ Real | Macros |
| `conversation-organizer.ts` | ✅ Real | Organizer |
| `parser-store.ts` | ✅ Real | Parser store |
| `provider-registrar.ts` | ✅ Real | Provider registrar |
| `provider-discovery.ts` | ✅ Real | Provider discovery |
| `harness-protocol-engine.ts` | ✅ Real | Protocol engine |
| `semantic-grounding.ts` | ✅ Real | Semantic grounding |

### Store Contracts (34 files in `src/storage/contracts/`)

All 34 store contracts exist and are typed. This is a strong foundation.

### Server Routes

- REST API routes exist in `src/server/routes/`
- WebSocket handling exists
- MCP server exists (`src/mcp/server.ts`)

### CLI

- `src/cli/` directory exists with command structure
- DevOps CLI exists (`devops/cli.ts`)

---

## 2. Cross-Version Overlap Matrix

### v3 → v4/v5 Mapping

| v3 Unit | v3 Status | Maps to v4/v5 | Overlap Type |
|---------|-----------|---------------|--------------|
| 1.1 Remove provider-logic | ✅ DONE | — | No overlap |
| 1.2 Wire AutonomousExecution | ✅ DONE | — | No overlap |
| 1.3 Capability bootstrap | ✅ DONE | — | No overlap |
| 1.4 Eliminate stubs | ✅ DONE | v4 2.2 (harness stub) | v4 extends |
| 1.5 Remove `as any` | ✅ DONE | — | No overlap |
| 1.6 Error classes | ✅ DONE | — | No overlap |
| 1.7 SQLite dialect | ✅ DONE | — | No overlap |
| 1.8 Knowledge extract wiring | ✅ DONE | — | No overlap |
| 1.9 Real mux dispatcher | ✅ DONE | — | No overlap |
| 1.10 Consolidate mocks | ✅ DONE | — | No overlap |
| 1.11 Coverage target | ⬜ PENDING | — | Independent |
| 1.12 v3 baseline | ⬜ PENDING | — | Independent |
| 2.1-2.3 IntentDecomposer | ⬜ PENDING | — | **v3-only (not in v4/v5)** |
| 2.4-2.6 CapabilityComposer | ⬜ PENDING | — | **v3-only (not in v4/v5)** |
| 2.7-2.10 LiveCapabilityRegistry | ⬜ PENDING | — | **v3-only (not in v4/v5)** |
| 2.11 Agentic loop | ⬜ PENDING | v4 2.2 (harness) | v4 replaces |
| 2.12 Loop integration | ⬜ PENDING | v4 2.2 (harness) | v4 replaces |
| 2.13 SandboxRunner | ⬜ PENDING | — | **v3-only (not in v4/v5)** |
| 2.14 Provenance storage | ⬜ PENDING | v5 0.4 (kernel provenance) | v5 replaces |
| 2.15 Provenance query | ⬜ PENDING | v5 15.1 (oracle query) | v5 replaces |
| 3.1-3.13 Canvas system | ⬜ PENDING | — | DEFERRED (no v4/v5 equivalent) |
| 4.1 WorkspaceManager | ⬜ PENDING | v4 6.6 | Partial overlap |
| 4.2 Workspace presets | ⬜ PENDING | v4 6.6 | Partial overlap |
| 4.3 Workspace host | ⬜ PENDING | — | **v3-only (not in v4/v5)** |
| 4.4 ConversationSurface | ⬜ PENDING | v4 2.8 | Partial overlap |
| 4.5 AgentFrontendSurface | ⬜ PENDING | v4 6.4 | Partial overlap |
| 4.6 CapabilityPaletteSurface | ⬜ PENDING | v4 6.3 | Partial overlap |
| 4.7 MemoryBrowserSurface | ⬜ PENDING | — | **v3-only (not in v4/v5)** |
| 4.8 ProviderSettingsSurface | ⬜ PENDING | v4 6.5 | Partial overlap |
| 4.9 TelemetryDashboardSurface | ⬜ PENDING | v4 6.4 | Partial overlap |
| 4.10 DevopsConsoleSurface | ⬜ PENDING | v5 16.4 | Partial overlap |
| 4.11 Workspace agent actions | ⬜ PENDING | — | **v3-only (not in v4/v5)** |
| 5.1 Ollama provider | ⬜ PENDING | v4 4.1-4.3 | Partial overlap |
| 5.2 llama.cpp provider | ⬜ PENDING | v4 4.1-4.3 | Partial overlap |
| 5.3 API-direct providers | ⬜ PENDING | — | **v3-only (not in v4/v5)** |
| 5.4 Capability taxonomy v2 | ⬜ PENDING | — | **v3-only (not in v4/v5)** |
| 5.5 Binding matrix | ⬜ PENDING | — | **v3-only (not in v4/v5)** |
| 5.6 MCP discovery | ⬜ PENDING | — | **v3-only (not in v4/v5)** |
| 5.7 MCP exposure | ⬜ PENDING | — | **v3-only (not in v4/v5)** |
| 5.8 Consent enforcement | ⬜ PENDING | — | **v3-only (not in v4/v5)** |
| 5.9 Discovery UI | ⬜ PENDING | — | **v3-only (not in v4/v5)** |
| 5.10 Provider test harness | ⬜ PENDING | — | **v3-only (not in v4/v5)** |
| 6.1-6.10 Memory/knowledge | ⬜ PENDING | — | DEFERRED |
| 7.1 LLM planner | ⬜ PENDING | v4 2.2 (harness) | v4 simplifies |
| 7.2 Step reflection | ⬜ PENDING | v4 2.2 (harness) | v4 simplifies |
| 7.3 HITL clarify | ⬜ PENDING | v4 3.5 | Partial overlap |
| 7.4 HITL pause/resume | ⬜ PENDING | v4 3.5 | Partial overlap |
| 7.5 Replay branching | ⬜ PENDING | — | **v3-only (not in v4/v5)** |
| 7.6 Task budgets | ⬜ PENDING | v4 8.3 | Partial overlap |
| 7.7 Selector healing v2 | ⬜ PENDING | v4 3.6 | v4 replaces |
| 7.8 Provider failover | ⬜ PENDING | v4 4.5 | v4 replaces |
| 7.9 Composite step | ⬜ PENDING | — | **v3-only (not in v4/v5)** |
| 7.10 Task templates | ⬜ PENDING | — | **v3-only (not in v4/v5)** |
| 7.11 Task search + history | ⬜ PENDING | — | **v3-only (not in v4/v5)** |
| 7.12 Canvas integration | ⬜ PENDING | — | DEFERRED |
| 8.1 Distributed tracing | ⬜ PENDING | v5 0.3 (kernel tracer) | v5 replaces |
| 8.2 Provenance surface | ⬜ PENDING | v5 16.1 (kernel REST) | v5 replaces |
| 8.3 Telemetry dashboard v2 | ⬜ PENDING | v4 6.4 (devtools) | Partial overlap |
| 8.4 Audit interceptor | ⬜ PENDING | v4 9.4 | v4 replaces |
| 8.5 Audit report v2 | ⬜ PENDING | — | **v3-only (not in v4/v5)** |
| 8.6 Cost tracking | ⬜ PENDING | — | **v3-only (not in v4/v5)** |
| 8.7 Latency budget | ⬜ PENDING | v4 5.5 | Partial overlap |
| 8.8 Health digest | ⬜ PENDING | v5 15.1 | v5 replaces |
| 9.1-9.9 Sovereign data | ⬜ PENDING | — | DEFERRED |
| 10.1-10.8 Polish/SDK | ⬜ PENDING | — | DEFERRED |

### v4 → v5 Mapping

v5 = v4 + Kernel. Every v4 unit gets one addition: register with KernelContext.

| v4 Phase | v4 Units | v5 Addition |
|----------|----------|-------------|
| 0 (Kernel) | — | 6 new units (0.1-0.6) |
| 1 (E2E Bootstrap) | 7 units | +KernelContext registration |
| 2 (Single-Turn) | 8 units | +KernelContext registration |
| 3 (Multi-Turn) | 6 units | +KernelContext registration |
| 4 (Three-Provider) | 5 units | +KernelContext registration |
| 5 (Frontend Perf) | 6 units | +KernelContext registration |
| 6 (Platform) | 6 units | +KernelContext registration |
| 7 (Reliability) | 7 units | +KernelContext registration |
| 8 (Resource) | 3 units | +KernelContext registration |
| 9 (Observability) | 5 units | +KernelContext registration |
| 10 (Frontend Resilience) | 3 units | +KernelContext registration |
| 11-14 (Stealth) | 15 units | +KernelContext registration |
| 15 (Oracle) | — | 4 new units (15.1-15.4) |
| 16 (Surfaces) | — | 4 new units (16.1-16.4) |

---

## 3. Gap Analysis by Domain

### Domain A: Kernel Core (v5 Phase 0) — ALL NEW
**Status:** 0/6 done | **Priority:** MUST be first

| Unit | What Exists | Gap | Effort |
|------|-------------|-----|--------|
| 0.1 KernelRegistry | Nothing | Create from scratch | M |
| 0.2 KernelContext | Nothing | Create from scratch | S |
| 0.3 KernelTracer | Nothing | Create from scratch | M |
| 0.4 KernelProvenance | Nothing | Create from scratch | M |
| 0.5 KernelSchema | Prisma exists | Add 4 tables + migration | S |
| 0.6 KernelBootstrap | `createServerWithEngines()` exists | Modify bootstrap sequence | S |

### Domain B: E2E Bootstrap (v4 Phase 1) — MOSTLY NEW
**Status:** 0/7 done | **Priority:** HIGH

| Unit | What Exists | Gap | Effort |
|------|-------------|-----|--------|
| 1.1 Wire CDP transport | `ChromeGovernor` exists, `setCdpTransport()` missing | Wire at line 212 of server/index.ts | S |
| 1.2 Seed pipeline | Provider seeds exist in `seeds/providers/` | Verify loading at boot | S |
| 1.3 Setup wizard | `adaptive-workspace.ts` exists | Build wizard UI flow | M |
| 1.4 Visible Chrome launch | `FleetSupervisor` exists | Launch with correct profile | M |
| 1.5 Login verification | `ProviderHealthKernel` exists | CDP-based login check | M |
| 1.6 Complete persist | `ProviderStore` exists | Persist account + profile | S |
| 1.7 Headless profile reuse | `FleetSupervisor` exists | Reuse saved profile | S |

### Domain C: Single-Turn (v4 Phase 2) — PARTIALLY EXISTS
**Status:** 0/8 done | **Priority:** HIGH

| Unit | What Exists | Gap | Effort |
|------|-------------|-----|--------|
| 2.1 SlaveId derivation | `FleetSupervisor` has naming | Fix mismatch in ConversationManager | S |
| 2.2 Harness real exec | `harness-runtime.ts` has STUB | Implement `executeHarnessPlan()` | L |
| 2.3 Composer typing | `ChromeGovernor` + CDP | Provider-specific selectors | M |
| 2.4 Submit action | `ChromeGovernor` + CDP | Provider-specific submit | M |
| 2.5 Network capture | `observation-tap.ts` exists | Intercept streaming API | M |
| 2.6 Parser extract | `stream-parser.ts` exists | Verify SSE→ContentBlock | S |
| 2.7 Store + emit | `conversation-manager.ts` exists | Verify store + emit flow | S |
| 2.8 Frontend render | Frontend exists in `web/` | Render conversation surface | M |

### Domain D: Multi-Turn (v4 Phase 3) — PARTIALLY EXISTS
**Status:** 0/6 done | **Priority:** HIGH

| Unit | What Exists | Gap | Effort |
|------|-------------|-----|--------|
| 3.1 State persistence | `conversation-manager.ts` exists | Verify cross-turn persistence | S |
| 3.2 DOM recovery | Nothing | CDP-based DOM recovery | L |
| 3.3 Streaming WS | WebSocket exists in server | Progressive block delivery | M |
| 3.4 Frontend streaming | Frontend exists | Live streaming updates | M |
| 3.5 Error recovery | `FleetSupervisor` has circuit breaker | Mid-conversation recovery | M |
| 3.6 Selector healing | `selector-healer.ts` exists | Auto-detect + repair | S |

### Domain E: Event Bus Upgrade (Cross-cutting) — EXISTS BUT NEEDS UPGRADE
**Status:** 0/8 done | **Priority:** CRITICAL (blocks kernel)

| Gap | What Exists | What's Needed | Effort |
|-----|-------------|---------------|--------|
| Error isolation | Synchronous `handler(event)` | `Promise.resolve().then().catch()` per handler | S |
| Event envelope | No metadata | `{ event, metadata: { eventId, correlationId, causationId, source } }` | M |
| Async handlers | Sync only | `void \| Promise<void>` support | S |
| Wildcard subscriptions | Not supported | `on('capability:*', handler)` | M |
| Ring buffer | `shift()` O(n) | Circular buffer O(1) + DB overflow | S |
| Snapshot dispatch | Live Set iteration | Copy before iterate | S |
| Dead letter queue | Not exists | Failed events → DLQ | M |
| `publishAndWait()` | Not exists | Awaitable variant for tests | S |

### Domain F: Stealth (v4 Phases 11-14) — ALL NEW
**Status:** 0/15 done | **Priority:** MEDIUM (after E2E works)

Entirely new engines: LaunchProfileEngine, StealthModuleEngine, CanvasNoiseEngine, WebGlSpoofEngine, AudioContextEngine, FontScreenEngine, HumanMouseEngine, HumanKeyboardEngine, HumanScrollEngine, ProfileWarmupEngine, CDPArtifactCleaner, NetworkFingerprintEngine, BehavioralPatternEngine, ExtensionBridgeEngine, StealthProfile store.

### Domain G: Platform & Frontend (v4 Phases 5-6, 10) — PARTIALLY EXISTS
**Status:** 0/15 done | **Priority:** MEDIUM

Frontend exists in `web/` but needs: optimistic UI, virtual scrolling, error boundaries, loading states, keyboard shortcuts, DevTools surface.

### Domain H: Reliability (v4 Phase 7) — PARTIALLY EXISTS
**Status:** 0/7 done | **Priority:** MEDIUM

Fleet persistence, conversation locking, double-send protection, graceful shutdown, SQLite WAL, retry policy — all need implementation but have existing foundations.

### Domain I: Observability (v4 Phase 9) — PARTIALLY EXISTS
**Status:** 0/5 done | **Priority:** MEDIUM (kernel covers some)

Structured logging, metrics export, error tracking, audit trail, latency SLA — some overlap with kernel oracle.

### Domain J: v3-Only Features — NOT IN v4/v5
**Status:** 0/26 done | **Priority:** MEDIUM (needs plan)

26 v3 units have no equivalent in v4/v5. These are:
- **Phase 2:** IntentDecomposer (3), CapabilityComposer (3), LiveCapabilityRegistry (4), SandboxRunner (1) = 11 units
- **Phase 4:** Workspace host, MemoryBrowser, Agent actions = 3 units
- **Phase 5:** API providers, Capability taxonomy v2, Binding matrix, MCP discovery/exposure, Consent, Discovery UI, Provider harness = 8 units
- **Phase 7:** Replay branching, Composite step, Task templates, Task search = 4 units

### Domain K: v3 Deferred Features — NOT IN v4/v5 (by choice)
**Status:** 0/40 done | **Priority:** LOW (deferred)

40 v3 units are intentionally deferred (not in v4/v5 scope):
- **Phase 3:** Canvas system = 13 units
- **Phase 6:** Memory/Knowledge = 10 units
- **Phase 9:** Sovereign Data = 9 units
- **Phase 10:** Polish/SDK = 8 units

---

## 4. Implementation Strategy

### Phase 0: Foundation (Week 1-2)

**Must be done first. Everything depends on it.**

1. **Event Bus Upgrade** (8 hours)
   - Error isolation with `Promise.resolve().then().catch()`
   - Event envelope with metadata
   - Async handler support
   - Snapshot dispatch
   - Wildcard subscriptions
   - Bounded ring buffer + DB overflow
   - `publishAndWait()` for tests
   - Dead letter queue

2. **Kernel Core** (16 hours)
   - 0.5 KernelSchema (Prisma migration — 4 tables)
   - 0.1 KernelRegistry (engine/store/capability registration)
   - 0.3 KernelTracer (span-based tracing)
   - 0.4 KernelProvenance (causal chains)
   - 0.2 KernelContext (unified context object)
   - 0.6 KernelBootstrap (wire into createServerWithEngines)

### Phase 1: E2E Bootstrap (Week 2-3)

**First vertical slice — login through Chrome.**

3. **Bootstrap Wiring** (8 hours)
   - 1.1 Wire CDP transport into ChromeGovernor
   - 1.2 Verify seed pipeline loads at boot
   - 1.6 Persist account with profile + port
   - 1.7 Headless slave reuse saved profile

4. **Login Flow** (12 hours)
   - 1.3 Setup wizard workspace + profile path
   - 1.4 Launch visible Chrome with correct profile
   - 1.5 CDP-based login state verification

### Phase 2: Single-Turn (Week 3-4)

**Second vertical slice — send message, get response.**

5. **Harness Execution** (16 hours)
   - 2.1 Fix slaveId derivation
   - 2.2 Implement `executeHarnessPlan()` (the big one)
   - 2.3 Provider-specific composer typing
   - 2.4 Provider-specific submit action

6. **Response Pipeline** (12 hours)
   - 2.5 Network capture: intercept streaming API
   - 2.6 Verify parser extract
   - 2.7 Verify store + emit flow
   - 2.8 Frontend render

### Phase 3: Multi-Turn + Providers (Week 4-5)

**Third vertical slice — conversation persistence + three providers.**

7. **Multi-Turn** (12 hours)
   - 3.1 State persistence across turns
   - 3.2 DOM recovery
   - 3.3 Streaming WS
   - 3.4 Frontend streaming
   - 3.5 Error recovery
   - 3.6 Selector healing

8. **Three Providers** (8 hours)
   - 4.1-4.3 ChatGPT/Claude/Gemini E2E verification
   - 4.4 Provider switching
   - 4.5 Health monitoring

### Phase 4: Kernel Oracle + Surfaces (Week 5-6)

**Self-understanding layer.**

9. **Kernel Oracle** (12 hours)
   - 15.1 OracleQueryEngine
   - 15.2 OracleDiagnosticEngine
   - 15.3 OracleActuator
   - 15.4 OracleEventStream

10. **Kernel Surfaces** (12 hours)
    - 16.1 REST API (`/api/kernel/*`)
    - 16.2 MCP Tools (`system.describe/diagnose/heal/explain`)
    - 16.3 CLI (`bun run kernel status/diagnose/trace`)
    - 16.4 Frontend (OracleDashboard)

### Phase 5: Reliability + Observability (Week 6-7)

**Production hardening.**

11. **Reliability** (12 hours)
    - 7.1-7.7 Fleet persistence, locking, double-send, shutdown, WAL, retry

12. **Observability** (8 hours)
    - 9.1-9.5 Structured logging, metrics, error tracking, audit, latency

### Phase 6: Frontend + Platform (Week 7-8)

**UI polish.**

13. **Frontend Performance** (8 hours)
    - 5.1-5.6 Optimistic UI, debounce, virtual scroll, mirror, latency, safety

14. **Platform Foundation** (8 hours)
    - 6.1-6.6 Action catalog, agent bridge, capability UI, devtools, settings

### Phase 7: Stealth (Week 8-10)

**Anti-detection layer (deferred until E2E works).**

15. **Stealth Core + Fingerprint + Human Sim** (40 hours)
    - 11.1-14.4 — 15 new engines

---

## 5. Priority Order (Implementation Sequence)

```
1. Event Bus Upgrade          ← blocks everything
2. Kernel Schema (Prisma)     ← blocks kernel
3. Kernel Core (0.1-0.6)      ← blocks all engines
4. Server Bootstrap (0.6)     ← wires kernel
5. CDP Transport (1.1)        ← enables Chrome
6. Seed Pipeline (1.2)        ← enables providers
7. Harness Execution (2.2)    ← the big stub
8. Composer/Submit (2.3-2.4)  ← enables conversation
9. Network Capture (2.5)      ← enables response
10. Parser (2.6)              ← enables content extraction
11. Store+Emit (2.7)          ← enables persistence
12. Frontend Render (2.8)     ← enables UI
13. Multi-Turn (3.1-3.6)      ← enables conversation
14. Three Providers (4.1-4.5) ← enables multi-provider
15. Kernel Oracle (15.1-15.4) ← self-understanding
16. Kernel Surfaces (16.1-16.4) ← exposed to user
17. Reliability (7.1-7.7)     ← production hardening
18. Observability (9.1-9.5)   ← monitoring
19. Frontend Perf (5.1-5.6)   ← UI polish
20. Platform (6.1-6.6)        ← extensibility
21. Stealth (11.1-14.4)       ← anti-detection (deferred)
```

---

## 6. Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| `executeHarnessPlan()` is the biggest stub | Blocks all conversation flow | Prioritize as #1 implementation task |
| v3 Canvas/Memory/Sovereign/SDK not in v4/v5 | 40 units intentionally deferred | Accept deferral — v4/v5 is the active plan |
| 26 v3-only units not in v4/v5 | 26 units with no v4/v5 equivalent | Decision needed: add to v5 or keep as parallel plan |
| Three plan versions create confusion | Team alignment | Declare v5 as canonical, archive v3/v4 |
| Kernel adds complexity before E2E works | Delayed gratification | Build kernel incrementally — Schema first, Oracle later |
| Event bus upgrade breaks existing handlers | Regression | Upgrade with backward-compatible wrapper |

---

## 7. Recommendations

1. **v5 is the primary plan. v3 is an active reference.** Do NOT archive v3 — 26 v3-only units still need implementation. Keep v3 tracker as an active reference alongside v5.

2. **Start with Event Bus upgrade.** It's 8 hours of work that unblocks the entire kernel and improves reliability immediately.

3. **Build Kernel Schema first.** Prisma migration is low-risk, high-value — enables all kernel features.

4. **Implement `executeHarnessPlan()` as the #1 engine task.** It's the single biggest blocker for E2E conversation flow.

5. **Defer stealth (Phases 11-14) until E2E works.** Anti-detection is important but not when the basic conversation doesn't work.

6. **Run `bun run devops roadmap --discover` after Phase 2 completes.** The E2E working system will reveal new gaps.

## Sources

- v3 tracker: `docs/atomic-v3/01-tracker.md` (108 units, 9 done)
- v4 tracker: `docs/atomic-v4/01-tracker.md` (71 units, 0 done)
- v5 tracker: `docs/atomic-v5/01-tracker.md` (85 units, 0 done)
- Codebase: 61 engines, 34 store contracts, 15+ routes
- Event bus research: `docs/research/event-bus-sota-2026.md` (18 sources)
