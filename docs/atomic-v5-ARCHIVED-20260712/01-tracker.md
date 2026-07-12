# vivim-final v5 — Atomic Tracker (SUPERSEDED)

> **⚠️ SUPERSEDED — DO NOT IMPLEMENT FROM THIS TRACKER**
>
> This tracker has been archived. **`docs/atomic-v5-fork-canon/01-tracker.md`** (90 units) is the MASTER.
> v5-fork-canon is the MASTER source of truth — 16 units done, 64 pending.
>
> **ACTIVE TRACKERS (for implementation):**
> - `docs/atomic-v3-fork-canon/01-tracker.md` — MASTER source of truth (127 units, 12 done)
> - `docs/atomic-v4-fork-canon/01-tracker.md` — CDP/Chrome subset (71 units, all done)
> - `docs/atomic-v5-fork-canon/01-tracker.md` — Kernel+CDP fork (90 units, 16 done) — **USE THIS FOR kernel+CDP work**
>
> **This file is archived reference. All implementation must use fork-canon trackers.**

> **v5 Philosophy:** v5 = v4 + Kernel. The VIVIM Kernel is a native self-understanding
> layer that makes the system self-aware, self-diagnosing, and self-healing. Every engine,
> store, capability, and route registers with the kernel at construction time. The kernel
> provides topology, telemetry, provenance, diagnostics, and self-healing — all queryable
> via REST, WebSocket, MCP, CLI, and frontend.

> **Kernel Architecture (5 layers):**
>   L0: KernelRegistry — live topology map (what engines exist, what's wired)
>   L1: KernelTracer — span-based tracing (every operation creates spans)
>   L2: KernelProvenance — causal chains (what caused what, selector/parser/result)
>   L3: KernelOracle — queryable self-model (ask questions, get answers about the system)
>   L4: KernelActuator — self-healing (detect problems, fix them automatically)

> **v4 Units Reference:** Phases 1-14 are identical to v4 (`docs/atomic-v4/`).
> Each v4 unit gets one addition: register with KernelContext at construction.
> Atomic specs for v4 content live in `docs/atomic-v4/phase-{01..14}-*/`.

---

## Phase 0: Kernel Core (10 units)

**⚠ MUST be completed before Phase 1.** Every subsequent engine registers with the kernel.

- [ ] 0.0 — CapabilityEventBus Upgrade: error isolation, envelopes, wildcards, DLQ → `docs/atomic-v5/phase-00-surgical-edit/0.0-capability-event-bus-upgrade.md`
- [ ] 0.1 — KernelRegistry: engine/store/capability self-registration → `docs/atomic-v5/phase-00-kernel-core/0.1-kernel-registry.md`
- [ ] 0.2 — KernelContext: unified context object for all engines → `docs/atomic-v5/phase-00-kernel-core/0.2-kernel-context.md`
- [ ] 0.3 — KernelTracer: span-based tracing engine → `docs/atomic-v5/phase-00-kernel-core/0.3-kernel-tracer.md`
- [ ] 0.4 — KernelProvenance: causal chain recording → `docs/atomic-v5/phase-00-kernel-core/0.4-kernel-provenance.md`
- [ ] 0.5 — Prisma Schema Migration: 4 kernel tables → `docs/atomic-v5/phase-00-surgical-edit/0.5-prisma-schema-migration.md`
- [ ] 0.6 — KernelBootstrap: wire into createServerWithEngines → `docs/atomic-v5/phase-00-kernel-core/0.6-kernel-bootstrap.md`
- [ ] 0.6a — Server Bootstrap Refactor: kernel-first bootstrap → `docs/atomic-v5/phase-00-surgical-edit/0.6a-server-bootstrap-refactor.md`
- [ ] 0.7 — Test Infrastructure Consolidation: shared mocks, coverage targets → `docs/atomic-v5/phase-00-surgical-edit/0.7-test-infrastructure.md`

---

## Phase 1: E2E Bootstrap & Login (7 units — 5 EXISTS, 2 CREATE)

> Identical to v4 Phase 1. Atomic specs: `docs/atomic-v4/phase-01-e2e-bootstrap/`
> Addition: each engine registers with KernelContext.

- [~] 1.1 — Wire CDP transport into ChromeGovernor bootstrap → `docs/atomic-v4/phase-01-e2e-bootstrap/1.1-wire-cdp-transport.md` — EXISTS: `ChromeGovernor` exists, wire `setCdpTransport()`
- [~] 1.2 — Provider seed pipeline: ensure chatgpt/claude/gemini seeds loaded at boot → `docs/atomic-v4/phase-01-e2e-bootstrap/1.2-seed-pipeline.md` — EXISTS: seeds in `seeds/providers/`, verify loading
- [ ] 1.3 — Setup wizard workspace + profile path flow → `docs/atomic-v4/phase-01-e2e-bootstrap/1.3-workspace-profile-flow.md`
- [~] 1.4 — Launch visible Chrome with correct profile for login → `docs/atomic-v4/phase-01-e2e-bootstrap/1.4-visible-chrome-login.md` — EXISTS: `FleetSupervisor` exists, launch with profile
- [ ] 1.5 — CDP-based login state verification → `docs/atomic-v4/phase-01-e2e-bootstrap/1.5-login-verify.md`
- [~] 1.6 — Complete setup: persist account with profile + port → `docs/atomic-v4/phase-01-e2e-bootstrap/1.6-complete-persist.md` — EXISTS: `ProviderStore` exists, persist account
- [~] 1.7 — Headless slave reuse of saved login profile → `docs/atomic-v4/phase-01-e2e-bootstrap/1.7-headless-profile-reuse.md` — EXISTS: `FleetSupervisor` exists, reuse profile

## Phase 2: Single-Turn Conversation (8 units — 5 EXISTS, 3 CREATE)

> Identical to v4 Phase 2. Atomic specs: `docs/atomic-v4/phase-02-single-turn/`

- [~] 2.1 — Fix slaveId derivation: match FleetSupervisor naming → `docs/atomic-v4/phase-02-single-turn/2.1-slave-id-derivation.md` — EXISTS: `FleetSupervisor` has naming, fix mismatch
- [~] 2.2 — Implement HarnessRuntime.executeHarnessPlan (not stub) → `docs/atomic-v4/phase-02-single-turn/2.2-harness-real-exec.md` — EXISTS: `harness-runtime.ts` has STUB, implement
- [ ] 2.3 — Provider-specific composer typing via CDP → `docs/atomic-v4/phase-02-single-turn/2.3-composer-typing.md`
- [ ] 2.4 — Provider-specific submit action via CDP → `docs/atomic-v4/phase-02-single-turn/2.4-submit-action.md`
- [ ] 2.5 — Network capture: intercept streaming API response → `docs/atomic-v4/phase-02-single-turn/2.5-network-capture.md`
- [~] 2.6 — Parser: SSE/streaming body → ContentBlock[] → `docs/atomic-v4/phase-02-single-turn/2.6-parser-extract.md` — EXISTS: `stream-parser.ts` exists, verify SSE→ContentBlock
- [~] 2.7 — Store message + blocks + emit events → `docs/atomic-v4/phase-02-single-turn/2.7-store-emit.md` — EXISTS: `conversation-manager.ts` exists, verify store + emit
- [ ] 2.8 — Frontend: render single response in conversation surface → `docs/atomic-v4/phase-02-single-turn/2.8-frontend-render.md`

## Phase 3: Multi-Turn Conversation (6 units — 4 EXISTS, 2 CREATE)

> Identical to v4 Phase 3. Atomic specs: `docs/atomic-v4/phase-03-multi-turn/`

- [~] 3.1 — Conversation state persistence across turns → `docs/atomic-v4/phase-03-multi-turn/3.1-state-persistence.md` — EXISTS: `conversation-manager.ts` exists, verify cross-turn
- [ ] 3.2 — DOM recovery: page reload + SPA navigation handling → `docs/atomic-v4/phase-03-multi-turn/3.2-dom-recovery.md`
- [~] 3.3 — Streaming: progressive block delivery over WebSocket → `docs/atomic-v4/phase-03-multi-turn/3.3-streaming-ws.md` — EXISTS: WebSocket exists in server, progressive delivery
- [ ] 3.4 — Frontend: message list with live streaming updates → `docs/atomic-v4/phase-03-multi-turn/3.4-frontend-streaming.md`
- [~] 3.5 — Error recovery: slave crash + circuit breaker mid-conversation → `docs/atomic-v4/phase-03-multi-turn/3.5-error-recovery.md` — EXISTS: `FleetSupervisor` has circuit breaker
- [~] 3.6 — Selector healing: auto-detect + repair broken selectors → `docs/atomic-v4/phase-03-multi-turn/3.6-selector-healing.md` — EXISTS: `selector-healer.ts` exists

## Phase 4: Three-Provider Demo (5 units — 1 EXISTS, 4 CREATE)

> Identical to v4 Phase 4. Atomic specs: `docs/atomic-v4/phase-04-three-provider/`

- [ ] 4.1 — ChatGPT selector + parser E2E verification → `docs/atomic-v4/phase-04-three-provider/4.1-chatgpt-e2e.md`
- [ ] 4.2 — Claude selector + parser E2E verification → `docs/atomic-v4/phase-04-three-provider/4.2-claude-e2e.md`
- [ ] 4.3 — Gemini selector + parser E2E verification → `docs/atomic-v4/phase-04-three-provider/4.3-gemini-e2e.md`
- [ ] 4.4 — Multi-provider conversation switching in frontend → `docs/atomic-v4/phase-04-three-provider/4.4-provider-switch.md`
- [~] 4.5 — Provider health monitoring for all three providers → `docs/atomic-v4/phase-04-three-provider/4.5-health-monitor.md` — EXISTS: `provider-health.ts` exists, 6-signal scoring

## Phase 5: Frontend Performance (6 units)

> Identical to v4 Phase 5. Atomic specs: `docs/atomic-v4/phase-05-frontend-perf/`

- [ ] 5.1 — Optimistic UI: instant message echo on send → `docs/atomic-v4/phase-05-frontend-perf/5.1-optimistic-ui.md`
- [ ] 5.2 — WebSocket debouncing for streaming block batching → `docs/atomic-v4/phase-05-frontend-perf/5.2-ws-debounce.md`
- [ ] 5.3 — Virtual scrolling for long conversations → `docs/atomic-v4/phase-05-frontend-perf/5.3-virtual-scroll.md`
- [ ] 5.4 — Mirror engine: UI⇄Chrome bidirectional state sync → `docs/atomic-v4/phase-05-frontend-perf/5.4-mirror-sync.md`
- [ ] 5.5 — Latency budget enforcement + per-stage metrics → `docs/atomic-v4/phase-05-frontend-perf/5.5-latency-budget.md`
- [ ] 5.6 — Zero-breakage: webapp mutation safety audit → `docs/atomic-v4/phase-05-frontend-perf/5.6-mutation-safety.md`

## Phase 6: Platform Foundation (6 units)

> Identical to v4 Phase 6. Atomic specs: `docs/atomic-v4/phase-06-platform-foundation/`

- [ ] 6.1 — ActionRegistry: full typed action catalog with Zod schemas → `docs/atomic-v4/phase-06-platform-foundation/6.1-action-catalog.md`
- [ ] 6.2 — AgentBridge: WebSocket command routing + result relay → `docs/atomic-v4/phase-06-platform-foundation/6.2-agent-bridge.md`
- [ ] 6.3 — Capability UI: generic contract-driven renderer → `docs/atomic-v4/phase-06-platform-foundation/6.3-generic-renderer.md`
- [ ] 6.4 — DevTools surface: debug panel + capability harness → `docs/atomic-v4/phase-06-platform-foundation/6.4-devtools.md`
- [ ] 6.5 — Provider management UI: add/remove/switch → `docs/atomic-v4/phase-06-platform-foundation/6.5-provider-mgmt.md`
- [ ] 6.6 — Workspace settings: profile paths, fleet config, ports → `docs/atomic-v4/phase-06-platform-foundation/6.6-workspace-settings.md`

## Phase 7: Reliability & Persistence (7 units)

> Identical to v4 Phase 7. Atomic specs: `docs/atomic-v4/phase-07-reliability/`

- [ ] 7.1 — Fleet state persistence: survive server restart → `docs/atomic-v4/phase-07-reliability/7.1-fleet-persistence.md`
- [ ] 7.2 — PortReaper adopt-on-restart: reconnect instead of kill → `docs/atomic-v4/phase-07-reliability/7.2-adopt-on-restart.md`
- [ ] 7.3 — Conversation locking: configurable lock policy → `docs/atomic-v4/phase-07-reliability/7.3-conversation-lock.md`
- [ ] 7.4 — Double-send protection: idempotency keys → `docs/atomic-v4/phase-07-reliability/7.4-double-send.md`
- [ ] 7.5 — Graceful Chrome shutdown on SIGTERM → `docs/atomic-v4/phase-07-reliability/7.5-graceful-shutdown.md`
- [ ] 7.6 — SQLite pragma tuning + WAL mode → `docs/atomic-v4/phase-07-reliability/7.6-sqlite-wal.md`
- [ ] 7.7 — Configurable retry policy engine → `docs/atomic-v4/phase-07-reliability/7.7-retry-policy.md`

## Phase 8: Resource Management (3 units)

> Identical to v4 Phase 8. Atomic specs: `docs/atomic-v4/phase-08-resource-mgmt/`

- [ ] 8.1 — Idle slave TTL + configurable eviction policy → `docs/atomic-v4/phase-08-resource-mgmt/8.1-idle-ttl.md`
- [ ] 8.2 — Database abstraction layer: multi-strategy store → `docs/atomic-v4/phase-08-resource-mgmt/8.2-db-abstraction.md`
- [ ] 8.3 — Request queueing + backpressure with policy → `docs/atomic-v4/phase-08-resource-mgmt/8.3-backpressure.md`

## Phase 9: Observability (5 units)

> Identical to v4 Phase 9. Atomic specs: `docs/atomic-v4/phase-09-observability/`

- [ ] 9.1 — Structured logging with pluggable transports → `docs/atomic-v4/phase-09-observability/9.1-structured-logging.md`
- [ ] 9.2 — Metrics export pipeline (Prometheus/OTLP) → `docs/atomic-v4/phase-09-observability/9.2-metrics-export.md`
- [ ] 9.3 — Error tracking integration → `docs/atomic-v4/phase-09-observability/9.3-error-tracking.md`
- [ ] 9.4 — Audit trail for all user + system actions → `docs/atomic-v4/phase-09-observability/9.4-audit-trail.md`
- [ ] 9.5 — Latency SLA monitoring + alerting → `docs/atomic-v4/phase-09-observability/9.5-latency-sla.md`

## Phase 10: Frontend Resilience (3 units)

> Identical to v4 Phase 10. Atomic specs: `docs/atomic-v4/phase-10-frontend-resilience/`

- [ ] 10.1 — Error boundary + crash recovery → `docs/atomic-v4/phase-10-frontend-resilience/10.1-error-boundary.md`
- [ ] 10.2 — Loading + skeleton states for all async surfaces → `docs/atomic-v4/phase-10-frontend-resilience/10.2-loading-states.md`
- [ ] 10.3 — Keyboard shortcuts + command palette → `docs/atomic-v4/phase-10-frontend-resilience/10.3-keyboard-shortcuts.md`

## Phase 11: Stealth Core Architecture (4 units)

> Identical to v4 Phase 11. Atomic specs: `docs/atomic-v4/phase-11-stealth-core/`

- [ ] 11.1 — LaunchProfileEngine: multi-mode launch strategy → `docs/atomic-v4/phase-11-stealth-core/11.1-launch-profile-engine.md`
- [ ] 11.2 — StealthModuleEngine: registry + CDP injection pipeline → `docs/atomic-v4/phase-11-stealth-core/11.2-stealth-module-engine.md`
- [ ] 11.3 — StealthProfile store: per-provider profile config from DB → `docs/atomic-v4/phase-11-stealth-core/11.3-stealth-profile-store.md`
- [ ] 11.4 — ExtensionBridgeEngine: browser extension interaction mode → `docs/atomic-v4/phase-11-stealth-core/11.4-extension-bridge.md`

## Phase 12: Fingerprint Spoofing Engines (4 units)

> Identical to v4 Phase 12. Atomic specs: `docs/atomic-v4/phase-12-fingerprint-engines/`

- [ ] 12.1 — CanvasNoiseEngine: canvas fingerprint perturbation → `docs/atomic-v4/phase-12-fingerprint-engines/12.1-canvas-noise.md`
- [ ] 12.2 — WebGlSpoofEngine: GPU renderer + vendor spoofing → `docs/atomic-v4/phase-12-fingerprint-engines/12.2-webgl-spoof.md`
- [ ] 12.3 — AudioContextEngine: audio fingerprint perturbation → `docs/atomic-v4/phase-12-fingerprint-engines/12.3-audio-context.md`
- [ ] 12.4 — FontScreenEngine: font list + screen resolution spoofing → `docs/atomic-v4/phase-12-fingerprint-engines/12.4-font-screen.md`

## Phase 13: Human Simulation Engines (3 units)

> Identical to v4 Phase 13. Atomic specs: `docs/atomic-v4/phase-13-human-simulation/`

- [ ] 13.1 — HumanMouseEngine: bezier-curve mouse movement → `docs/atomic-v4/phase-13-human-simulation/13.1-human-mouse.md`
- [ ] 13.2 — HumanKeyboardEngine: variable rhythm typing → `docs/atomic-v4/phase-13-human-simulation/13.2-human-keyboard.md`
- [ ] 13.3 — HumanScrollEngine: natural scroll velocity curves → `docs/atomic-v4/phase-13-human-simulation/13.3-human-scroll.md`

## Phase 14: Profile & Trace Stealth (4 units)

> Identical to v4 Phase 14. Atomic specs: `docs/atomic-v4/phase-14-profile-trace/`

- [ ] 14.1 — ProfileWarmupEngine: history/cookie/trust building → `docs/atomic-v4/phase-14-profile-trace/14.1-profile-warmup.md`
- [ ] 14.2 — CDPArtifactCleaner: remove CDP traces from page → `docs/atomic-v4/phase-14-profile-trace/14.2-cdp-artifact-cleaner.md`
- [ ] 14.3 — NetworkFingerprintEngine: TLS + HTTP header preservation → `docs/atomic-v4/phase-14-profile-trace/14.3-network-fingerprint.md`
- [ ] 14.4 — BehavioralPatternEngine: request timing + interaction rhythm → `docs/atomic-v4/phase-14-profile-trace/14.4-behavioral-pattern.md`

---

## Phase 15: Kernel Oracle (4 units)

The system's self-understanding layer — queryable self-model.

- [ ] 15.1 — OracleQueryEngine: structured queries about system state → `docs/atomic-v5/phase-15-kernel-oracle/15.1-oracle-query.md`
- [ ] 15.2 — OracleDiagnosticEngine: detect stubs, broken wires, missing deps → `docs/atomic-v5/phase-15-kernel-oracle/15.2-oracle-diagnostic.md`
- [ ] 15.3 — OracleActuator: self-healing actions (restart, heal, reconfig) → `docs/atomic-v5/phase-15-kernel-oracle/15.3-oracle-actuator.md`
- [ ] 15.4 — OracleEventStream: real-time system state over WebSocket → `docs/atomic-v5/phase-15-kernel-oracle/15.4-oracle-event-stream.md`

## Phase 16: Kernel Surfaces (6 units)

Expose the kernel to all user/system surfaces.

- [ ] 16.1 — Kernel REST API: /api/kernel/* routes → `docs/atomic-v5/phase-16-kernel-surfaces/16.1-kernel-rest.md`
- [ ] 16.2 — Kernel MCP Tools: system.describe/diagnose/heal/explain → `docs/atomic-v5/phase-16-kernel-surfaces/16.2-kernel-mcp.md`
- [ ] 16.3 — Kernel CLI: kernel status/diagnose/trace/config commands → `docs/atomic-v5/phase-16-kernel-surfaces/16.3-kernel-cli.md`
- [ ] 16.4 — Kernel Frontend Surface: OracleDashboard in UI → `docs/atomic-v5/phase-16-kernel-surfaces/16.4-kernel-frontend.md`
- [ ] 16.5 — MCP Server Kernel Integration: register kernel tools in DiscoveryMcpServer → `docs/atomic-v5/phase-00-surgical-edit/16.5-mcp-server-integration.md`
- [ ] 16.6 — CLI Kernel Commands: bun run kernel status/diagnose/trace → `docs/atomic-v5/phase-00-surgical-edit/16.6-cli-kernel-commands.md`

---

## Summary

| Phase | Units | Domain |
|-------|-------|--------|
| 0 | 10 | Kernel Core (event bus, registry, tracer, provenance, schema, bootstrap, test infra) |
| 1 | 7 | E2E Bootstrap & Login |
| 2 | 8 | Single-Turn Conversation |
| 3 | 6 | Multi-Turn Conversation |
| 4 | 5 | Three-Provider Demo |
| 5 | 6 | Frontend Performance |
| 6 | 6 | Platform Foundation |
| 7 | 7 | Reliability & Persistence |
| 8 | 3 | Resource Management |
| 9 | 5 | Observability |
| 10 | 3 | Frontend Resilience |
| 11 | 4 | Stealth Core |
| 12 | 4 | Fingerprint Spoofing |
| 13 | 3 | Human Simulation |
| 14 | 4 | Profile & Trace Stealth |
| 15 | 4 | Kernel Oracle |
| 16 | 6 | Kernel Surfaces |
| **Total** | **91** | |

## Last Updated

2026-07-12
