# vivim-final v4-fork-canon — Atomic Tracker (MASTER for CDP/Chrome)

**Total units:** 71 | **Done:** 71 | **Blocked:** 0 | **Pending:** 0

> **MASTER TRACKER for CDP/Chrome work.** All 71 units are done.
> States: `[ ]` pending · `[~]` exists (have code, needs FIX) · `[x]` done · `[!]` blocked.
> Update via `bun run devops mark <id> <state>`.

> **For kernel+CDP work:** See `docs/atomic-v5-fork-canon/01-tracker.md` (90 units).
> **For full vivim-final:** See `docs/atomic-v3-fork-canon/01-tracker.md` (127 units).

## Phase 1: E2E Bootstrap & Login (7 units — 7 done)

- [x] 1.1 — Wire CDP transport into ChromeGovernor bootstrap → `docs/atomic-v4-fork-canon/phase-01-e2e-bootstrap/1.1-wire-cdp-transport.md`
- [x] 1.2 — Provider seed pipeline: ensure chatgpt/claude/gemini seeds loaded at boot → `docs/atomic-v4-fork-canon/phase-01-e2e-bootstrap/1.2-seed-pipeline.md`
- [x] 1.3 — Setup wizard workspace + profile path flow → `docs/atomic-v4-fork-canon/phase-01-e2e-bootstrap/1.3-workspace-profile-flow.md`
- [x] 1.4 — Launch visible Chrome with correct profile for login → `docs/atomic-v4-fork-canon/phase-01-e2e-bootstrap/1.4-visible-chrome-login.md`
- [x] 1.5 — CDP-based login state verification → `docs/atomic-v4-fork-canon/phase-01-e2e-bootstrap/1.5-login-verify.md`
- [x] 1.6 — Complete setup: persist account with profile + port → `docs/atomic-v4-fork-canon/phase-01-e2e-bootstrap/1.6-complete-persist.md`
- [x] 1.7 — Headless slave reuse of saved login profile → `docs/atomic-v4-fork-canon/phase-01-e2e-bootstrap/1.7-headless-profile-reuse.md`

## Phase 2: Single-Turn Conversation (8 units — 8 done)

- [x] 2.1 — Fix slaveId derivation: match FleetSupervisor naming → `docs/atomic-v4-fork-canon/phase-02-single-turn/2.1-slave-id-derivation.md`
- [x] 2.2 — Implement HarnessRuntime.executeHarnessPlan (not stub) → `docs/atomic-v4-fork-canon/phase-02-single-turn/2.2-harness-real-exec.md` — EXISTS: `harness-runtime.ts` has STUB, implement
- [x] 2.3 — Provider-specific composer typing via CDP → `docs/atomic-v4-fork-canon/phase-02-single-turn/2.3-composer-typing.md`
- [x] 2.4 — Provider-specific submit action via CDP → `docs/atomic-v4-fork-canon/phase-02-single-turn/2.4-submit-action.md`
- [x] 2.5 — Network capture: intercept streaming API response → `docs/atomic-v4-fork-canon/phase-02-single-turn/2.5-network-capture.md`
- [x] 2.6 — Parser: SSE/streaming body → ContentBlock[] → `docs/atomic-v4-fork-canon/phase-02-single-turn/2.6-parser-extract.md` — EXISTS: `stream-parser.ts` exists, verify SSE→ContentBlock
- [x] 2.7 — Store message + blocks + emit events → `docs/atomic-v4-fork-canon/phase-02-single-turn/2.7-store-emit.md` — EXISTS: `conversation-manager.ts` exists, verify store + emit
- [x] 2.8 — Frontend: render single response in conversation surface → `docs/atomic-v4-fork-canon/phase-02-single-turn/2.8-frontend-render.md`

## Phase 3: Multi-Turn Conversation (6 units — 6 done)

- [x] 3.1 — Conversation state persistence across turns → `docs/atomic-v4-fork-canon/phase-03-multi-turn/3.1-state-persistence.md` — EXISTS: `conversation-manager.ts` exists, verify cross-turn
- [x] 3.2 — DOM recovery: page reload + SPA navigation handling → `docs/atomic-v4-fork-canon/phase-03-multi-turn/3.2-dom-recovery.md`
- [x] 3.3 — Streaming: progressive block delivery over WebSocket → `docs/atomic-v4-fork-canon/phase-03-multi-turn/3.3-streaming-ws.md` — EXISTS: WebSocket exists in server, progressive delivery
- [x] 3.4 — Frontend: message list with live streaming updates → `docs/atomic-v4-fork-canon/phase-03-multi-turn/3.4-frontend-streaming.md`
- [x] 3.5 — Error recovery: slave crash + circuit breaker mid-conversation → `docs/atomic-v4-fork-canon/phase-03-multi-turn/3.5-error-recovery.md` — EXISTS: `FleetSupervisor` has circuit breaker
- [x] 3.6 — Selector healing: auto-detect + repair broken selectors → `docs/atomic-v4-fork-canon/phase-03-multi-turn/3.6-selector-healing.md` — EXISTS: `selector-healer.ts` exists

## Phase 4: Three-Provider Demo (5 units — 5 done)

- [x] 4.1 — ChatGPT selector + parser E2E verification → `docs/atomic-v4-fork-canon/phase-04-three-provider/4.1-chatgpt-e2e.md` — VERIFIED: send pipeline + provider-selectors wired
- [x] 4.2 — Claude selector + parser E2E verification → `docs/atomic-v4-fork-canon/phase-04-three-provider/4.2-claude-e2e.md` — VERIFIED: send pipeline + provider-selectors wired
- [x] 4.3 — Gemini selector + parser E2E verification → `docs/atomic-v4-fork-canon/phase-04-three-provider/4.3-gemini-e2e.md` — VERIFIED: send pipeline + provider-selectors wired
- [x] 4.4 — Multi-provider conversation switching in frontend → `docs/atomic-v4-fork-canon/phase-04-three-provider/4.4-provider-switch.md` — CREATED: ConversationList + SandboxApp wired
- [x] 4.5 — Provider health monitoring for all three providers → `docs/atomic-v4-fork-canon/phase-04-three-provider/4.5-health-monitor.md` — CREATED: healthKernel bootstrap + /api/health/providers + HealthDashboard

## Phase 5: Frontend Performance (6 units — 6 done)

- [x] 5.1 — Optimistic UI: instant message echo on send → `docs/atomic-v4-fork-canon/phase-05-frontend-perf/5.1-optimistic-ui.md` — IMPLEMENTED: optimistic user msg + typing indicator in conversation-surface.tsx
- [x] 5.2 — WebSocket debouncing for streaming block batching → `docs/atomic-v4-fork-canon/phase-05-frontend-perf/5.2-ws-debounce.md` — IMPLEMENTED: RAF batching + text block merging in RenderBlocks
- [x] 5.3 — Virtual scrolling for long conversations → `docs/atomic-v4-fork-canon/phase-05-frontend-perf/5.3-virtual-scroll.md` — IMPLEMENTED: viewport-based virtual list for >20 messages
- [x] 5.4 — Mirror engine: UI⇄Chrome bidirectional state sync → `docs/atomic-v4-fork-canon/phase-05-frontend-perf/5.4-mirror-sync.md` — WIRED: mirror endpoint + ConversationManager already has mirror field
- [x] 5.5 — Latency budget enforcement + per-stage metrics → `docs/atomic-v4-fork-canon/phase-05-frontend-perf/5.5-latency-budget.md` — IMPLEMENTED: StageTiming in sendInternal + LatencyBreakdown in frontend
- [x] 5.6 — Zero-breakage: webapp mutation safety audit → `docs/atomic-v4-fork-canon/phase-05-frontend-perf/5.6-mutation-safety.md` — CREATED: tests/e2e/mutation-safety-audit.test.ts

## Phase 6: Platform Foundation (6 units — 6 done)

- [x] 6.1 — ActionRegistry: full typed action catalog with Zod schemas → `docs/atomic-v4-fork-canon/phase-06-platform-foundation/6.1-action-catalog.md` — CREATED: web/ui/src/actions/catalog.ts with 17 actions
- [x] 6.2 — AgentBridge: WebSocket command routing + result relay → `docs/atomic-v4-fork-canon/phase-06-platform-foundation/6.2-agent-bridge.md` — REWRITTEN: correlation IDs, timeout, event forwarding
- [x] 6.3 — Capability UI: generic contract-driven renderer → `docs/atomic-v4-fork-canon/phase-06-platform-foundation/6.3-generic-renderer.md` — EXISTS: generic-capability-renderer.ts with bespoke registry
- [x] 6.4 — DevTools surface: debug panel + capability harness → `docs/atomic-v4-fork-canon/phase-06-platform-foundation/6.4-devtools.md` — REWRITTEN: 5-tab debug panel (events/caps/fleet/health/timing)
- [x] 6.5 — Provider management UI: add/remove/switch → `docs/atomic-v4-fork-canon/phase-06-platform-foundation/6.5-provider-mgmt.md` — CREATED: provider-manager.ts + wired into SandboxApp
- [x] 6.6 — Workspace settings: profile paths, fleet config, ports → `docs/atomic-v4-fork-canon/phase-06-platform-foundation/6.6-workspace-settings.md` — CREATED: workspace-settings.ts + /api/config/governor endpoints

## Phase 7: Reliability & Persistence (7 units — 7 done)

- [x] 7.1 — Fleet state persistence: survive server restart → `docs/atomic-v4-fork-canon/phase-07-reliability/7.1-fleet-persistence.md` — WIRED: SQLite pragmas configured at boot in server/index.ts
- [x] 7.2 — PortReaper adopt-on-restart: reconnect instead of kill → `docs/atomic-v4-fork-canon/phase-07-reliability/7.2-adopt-on-restart.md` — WIRED: portReaper.reap() with adopt logic
- [x] 7.3 — Conversation locking: configurable lock policy → `docs/atomic-v4-fork-canon/phase-07-reliability/7.3-conversation-lock.md` — CREATED: src/engines/lock-manager.ts
- [x] 7.4 — Double-send protection: idempotency keys → `docs/atomic-v4-fork-canon/phase-07-reliability/7.4-double-send.md` — CREATED: src/engines/idempotency-guard.ts
- [x] 7.5 — Graceful Chrome shutdown on SIGTERM → `docs/atomic-v4-fork-canon/phase-07-reliability/7.5-graceful-shutdown.md` — WIRED: onShutdown hook with governor.killAll() + cdpTransport.disconnectAll()
- [x] 7.6 — SQLite pragma tuning + WAL mode → `docs/atomic-v4-fork-canon/phase-07-reliability/7.6-sqlite-wal.md` — CREATED: configurePrisma() in src/storage/db.ts with WAL, mmap, busy timeout
- [x] 7.7 — Configurable retry policy engine → `docs/atomic-v4-fork-canon/phase-07-reliability/7.7-retry-policy.md` — CREATED: src/engines/retry-engine.ts

## Phase 8: Resource Management (3 units — 3 done)

- [x] 8.1 — Idle slave TTL + configurable eviction policy → `docs/atomic-v4-fork-canon/phase-08-resource-mgmt/8.1-idle-ttl.md` — CREATED: src/engines/eviction-manager.ts
- [x] 8.2 — Database abstraction layer: multi-strategy store → `docs/atomic-v4-fork-canon/phase-08-resource-mgmt/8.2-db-abstraction.md` — CREATED: src/storage/store-factory.ts
- [x] 8.3 — Request queueing + backpressure with policy → `docs/atomic-v4-fork-canon/phase-08-resource-mgmt/8.3-backpressure.md` — CREATED: src/engines/request-queue.ts

## Phase 9: Observability (5 units — 5 done)

- [x] 9.1 — Structured logging with pluggable transports → `docs/atomic-v4-fork-canon/phase-09-observability/9.1-structured-logging.md` — CREATED: src/engines/logger.ts with pluggable transports
- [x] 9.2 — Metrics export pipeline (Prometheus/OTLP) → `docs/atomic-v4-fork-canon/phase-09-observability/9.2-metrics-export.md` — CREATED: src/engines/metrics.ts with counters/gauges/histograms
- [x] 9.3 — Error tracking integration → `docs/atomic-v4-fork-canon/phase-09-observability/9.3-error-tracking.md` — CREATED: src/engines/error-tracker.ts with dedup
- [x] 9.4 — Audit trail for all user + system actions → `docs/atomic-v4-fork-canon/phase-09-observability/9.4-audit-trail.md` — CREATED: src/engines/audit-trail.ts
- [x] 9.5 — Latency SLA monitoring + alerting → `docs/atomic-v4-fork-canon/phase-09-observability/9.5-latency-sla.md` — CREATED: src/engines/sla-monitor.ts

## Phase 10: Frontend Resilience (3 units — 3 done)

- [x] 10.1 — Error boundary + crash recovery → `docs/atomic-v4-fork-canon/phase-10-frontend-resilience/10.1-error-boundary.md` — CREATED: error-boundary.tsx with crash recovery UI
- [x] 10.2 — Loading + skeleton states for all async surfaces → `docs/atomic-v4-fork-canon/phase-10-frontend-resilience/10.2-loading-states.md` — CREATED: skeletons.tsx with MessageSkeleton, ConversationListSkeleton, etc.
- [x] 10.3 — Keyboard shortcuts + command palette → `docs/atomic-v4-fork-canon/phase-10-frontend-resilience/10.3-keyboard-shortcuts.md` — CREATED: keyboard-shortcuts.tsx with useKeyboardShortcuts + CommandPalette

## Phase 11: Stealth Core Architecture (4 units — 4 done)

- [x] 11.1 — LaunchProfileEngine: multi-mode launch strategy → `docs/atomic-v4-fork-canon/phase-11-stealth-core/11.1-launch-profile-engine.md` — CREATED: src/engines/launch-profile-engine.ts
- [x] 11.2 — StealthModuleEngine: registry + CDP injection pipeline → `docs/atomic-v4-fork-canon/phase-11-stealth-core/11.2-stealth-module-engine.md` — CREATED: src/engines/stealth/stealth-module-engine.ts
- [x] 11.3 — StealthProfile store: per-provider profile config from DB → `docs/atomic-v4-fork-canon/phase-11-stealth-core/11.3-stealth-profile-store.md` — CREATED: src/engines/stealth/stealth-profile-store.ts + Prisma schema tables
- [x] 11.4 — ExtensionBridgeEngine: browser extension interaction mode → `docs/atomic-v4-fork-canon/phase-11-stealth-core/11.4-extension-bridge.md` — CREATED: src/engines/extension-bridge-engine.ts

## Phase 12: Fingerprint Spoofing Engines (4 units — 4 done)

- [x] 12.1 — CanvasNoiseEngine: canvas fingerprint perturbation → `docs/atomic-v4-fork-canon/phase-12-fingerprint-engines/12.1-canvas-noise.md` — CREATED: src/engines/stealth/canvas-noise-engine.ts
- [x] 12.2 — WebGlSpoofEngine: GPU renderer + vendor spoofing → `docs/atomic-v4-fork-canon/phase-12-fingerprint-engines/12.2-webgl-spoof.md` — CREATED: src/engines/stealth/webgl-spoof-engine.ts
- [x] 12.3 — AudioContextEngine: audio fingerprint perturbation → `docs/atomic-v4-fork-canon/phase-12-fingerprint-engines/12.3-audio-context.md` — CREATED: src/engines/stealth/audio-context-engine.ts
- [x] 12.4 — FontScreenEngine: font list + screen resolution spoofing → `docs/atomic-v4-fork-canon/phase-12-fingerprint-engines/12.4-font-screen.md` — CREATED: src/engines/stealth/font-screen-engine.ts

## Phase 13: Human Simulation Engines (3 units — 3 done)

- [x] 13.1 — HumanMouseEngine: bezier-curve mouse movement → `docs/atomic-v4-fork-canon/phase-13-human-simulation/13.1-human-mouse.md` — CREATED: src/engines/stealth/human-mouse-engine.ts
- [x] 13.2 — HumanKeyboardEngine: variable rhythm typing → `docs/atomic-v4-fork-canon/phase-13-human-simulation/13.2-human-keyboard.md` — CREATED: src/engines/stealth/human-keyboard-engine.ts
- [x] 13.3 — HumanScrollEngine: natural scroll velocity curves → `docs/atomic-v4-fork-canon/phase-13-human-simulation/13.3-human-scroll.md` — CREATED: src/engines/stealth/human-scroll-engine.ts

## Phase 14: Profile & Trace Stealth (4 units — 4 done)

- [x] 14.1 — ProfileWarmupEngine: history/cookie/trust building → `docs/atomic-v4-fork-canon/phase-14-profile-trace/14.1-profile-warmup.md` — CREATED: src/engines/stealth/profile-warmup-engine.ts
- [x] 14.2 — CDPArtifactCleaner: remove CDP traces from page → `docs/atomic-v4-fork-canon/phase-14-profile-trace/14.2-cdp-artifact-cleaner.md` — CREATED: src/engines/stealth/cdp-artifact-cleaner.ts
- [x] 14.3 — NetworkFingerprintEngine: TLS + HTTP header preservation → `docs/atomic-v4-fork-canon/phase-14-profile-trace/14.3-network-fingerprint.md` — CREATED: src/engines/stealth/network-fingerprint-engine.ts
- [x] 14.4 — BehavioralPatternEngine: request timing + interaction rhythm → `docs/atomic-v4-fork-canon/phase-14-profile-trace/14.4-behavioral-pattern.md` — CREATED: src/engines/stealth/behavioral-pattern-engine.ts

---

## Summary

| Phase | Units | Domain |
|-------|-------|--------|
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
| **Total** | **71** | |

## Last Updated

2026-07-12
