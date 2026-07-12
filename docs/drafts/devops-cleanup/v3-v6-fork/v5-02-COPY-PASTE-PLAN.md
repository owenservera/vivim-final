# v5 Copy/Paste Atomic List

## Overview

90 units across 17 phases. v5 = v4 (71 units, phases 1-14) + kernel (9 units, phase 0) + oracle (4 units, phase 15) + surfaces (6 units, phase 16).

## Phase 0: Kernel Core (10 units)

| Fork ID | Source | Spec Path | Description |
|---------|--------|-----------|-------------|
| 0.0 | v5 0.0 | `docs/atomic-v5/phase-00-surgical-edit/0.0-capability-event-bus-upgrade.md` | CapabilityEventBus Upgrade: error isolation, envelopes, wildcards, DLQ |
| 0.1 | v5 0.1 | `docs/atomic-v5/phase-00-kernel-core/0.1-kernel-registry.md` | KernelRegistry: engine/store/capability self-registration |
| 0.2 | v5 0.2 | `docs/atomic-v5/phase-00-kernel-core/0.2-kernel-context.md` | KernelContext: unified context object for all engines |
| 0.3 | v5 0.3 | `docs/atomic-v5/phase-00-kernel-core/0.3-kernel-tracer.md` | KernelTracer: span-based tracing engine |
| 0.4 | v5 0.4 | `docs/atomic-v5/phase-00-kernel-core/0.4-kernel-provenance.md` | KernelProvenance: causal chain recording |
| 0.5 | v5 0.5 | `docs/atomic-v5/phase-00-surgical-edit/0.5-prisma-schema-migration.md` | Prisma Schema Migration: 4 kernel tables |
| 0.6 | v5 0.6 | `docs/atomic-v5/phase-00-kernel-core/0.6-kernel-bootstrap.md` | KernelBootstrap: wire into createServerWithEngines |
| 0.6a | v5 0.6a | `docs/atomic-v5/phase-00-surgical-edit/0.6a-server-bootstrap-refactor.md` | Server Bootstrap Refactor: kernel-first bootstrap |
| 0.7 | v5 0.7 | `docs/atomic-v5/phase-00-surgical-edit/0.7-test-infrastructure.md` | Test Infrastructure Consolidation: shared mocks, coverage targets |

## Phase 1: E2E Bootstrap & Login (7 units)

| Fork ID | Source | Spec Path | Description |
|---------|--------|-----------|-------------|
| 1.1 | v4 1.1 | `docs/atomic-v4/phase-01-e2e-bootstrap/1.1-wire-cdp-transport.md` | Wire CDP transport into ChromeGovernor bootstrap |
| 1.2 | v4 1.2 | `docs/atomic-v4/phase-01-e2e-bootstrap/1.2-seed-pipeline.md` | Provider seed pipeline: ensure seeds loaded at boot |
| 1.3 | v4 1.3 | `docs/atomic-v4/phase-01-e2e-bootstrap/1.3-workspace-profile-flow.md` | Setup wizard workspace + profile path flow |
| 1.4 | v4 1.4 | `docs/atomic-v4/phase-01-e2e-bootstrap/1.4-visible-chrome-login.md` | Launch visible Chrome with correct profile for login |
| 1.5 | v4 1.5 | `docs/atomic-v4/phase-01-e2e-bootstrap/1.5-login-verify.md` | CDP-based login state verification |
| 1.6 | v4 1.6 | `docs/atomic-v4/phase-01-e2e-bootstrap/1.6-complete-persist.md` | Complete setup: persist account with profile + port |
| 1.7 | v4 1.7 | `docs/atomic-v4/phase-01-e2e-bootstrap/1.7-headless-profile-reuse.md` | Headless slave reuse of saved login profile |

## Phase 2: Single-Turn Conversation (8 units)

| Fork ID | Source | Spec Path | Description |
|---------|--------|-----------|-------------|
| 2.1 | v4 2.1 | `docs/atomic-v4/phase-02-single-turn/2.1-slave-id-derivation.md` | Fix slaveId derivation: match FleetSupervisor naming |
| 2.2 | v4 2.2 | `docs/atomic-v4/phase-02-single-turn/2.2-harness-real-exec.md` | Implement HarnessRuntime.executeHarnessPlan (not stub) |
| 2.3 | v4 2.3 | `docs/atomic-v4/phase-02-single-turn/2.3-composer-typing.md` | Provider-specific composer typing via CDP |
| 2.4 | v4 2.4 | `docs/atomic-v4/phase-02-single-turn/2.4-submit-action.md` | Provider-specific submit action via CDP |
| 2.5 | v4 2.5 | `docs/atomic-v4/phase-02-single-turn/2.5-network-capture.md` | Network capture: intercept streaming API response |
| 2.6 | v4 2.6 | `docs/atomic-v4/phase-02-single-turn/2.6-parser-extract.md` | Parser: SSE/streaming body → ContentBlock[] |
| 2.7 | v4 2.7 | `docs/atomic-v4/phase-02-single-turn/2.7-store-emit.md` | Store message + blocks + emit events |
| 2.8 | v4 2.8 | `docs/atomic-v4/phase-02-single-turn/2.8-frontend-render.md` | Frontend: render single response in conversation surface |

## Phase 3: Multi-Turn Conversation (6 units)

| Fork ID | Source | Spec Path | Description |
|---------|--------|-----------|-------------|
| 3.1 | v4 3.1 | `docs/atomic-v4/phase-03-multi-turn/3.1-state-persistence.md` | Conversation state persistence across turns |
| 3.2 | v4 3.2 | `docs/atomic-v4/phase-03-multi-turn/3.2-dom-recovery.md` | DOM recovery: page reload + SPA navigation handling |
| 3.3 | v4 3.3 | `docs/atomic-v4/phase-03-multi-turn/3.3-streaming-ws.md` | Streaming: progressive block delivery over WebSocket |
| 3.4 | v4 3.4 | `docs/atomic-v4/phase-03-multi-turn/3.4-frontend-streaming.md` | Frontend: message list with live streaming updates |
| 3.5 | v4 3.5 | `docs/atomic-v4/phase-03-multi-turn/3.5-error-recovery.md` | Error recovery: slave crash + circuit breaker mid-conversation |
| 3.6 | v4 3.6 | `docs/atomic-v4/phase-03-multi-turn/3.6-selector-healing.md` | Selector healing: auto-detect + repair broken selectors |

## Phase 4: Three-Provider Demo (5 units)

| Fork ID | Source | Spec Path | Description |
|---------|--------|-----------|-------------|
| 4.1 | v4 4.1 | `docs/atomic-v4/phase-04-three-provider/4.1-chatgpt-e2e.md` | ChatGPT selector + parser E2E verification |
| 4.2 | v4 4.2 | `docs/atomic-v4/phase-04-three-provider/4.2-claude-e2e.md` | Claude selector + parser E2E verification |
| 4.3 | v4 4.3 | `docs/atomic-v4/phase-04-three-provider/4.3-gemini-e2e.md` | Gemini selector + parser E2E verification |
| 4.4 | v4 4.4 | `docs/atomic-v4/phase-04-three-provider/4.4-provider-switch.md` | Multi-provider conversation switching in frontend |
| 4.5 | v4 4.5 | `docs/atomic-v4/phase-04-three-provider/4.5-health-monitor.md` | Provider health monitoring for all three providers |

## Phase 5: Frontend Performance (6 units)

| Fork ID | Source | Spec Path | Description |
|---------|--------|-----------|-------------|
| 5.1 | v4 5.1 | `docs/atomic-v4/phase-05-frontend-perf/5.1-optimistic-ui.md` | Optimistic UI: instant message echo on send |
| 5.2 | v4 5.2 | `docs/atomic-v4/phase-05-frontend-perf/5.2-ws-debounce.md` | WebSocket debouncing for streaming block batching |
| 5.3 | v4 5.3 | `docs/atomic-v4/phase-05-frontend-perf/5.3-virtual-scroll.md` | Virtual scrolling for long conversations |
| 5.4 | v4 5.4 | `docs/atomic-v4/phase-05-frontend-perf/5.4-mirror-sync.md` | Mirror engine: UI⇄Chrome bidirectional state sync |
| 5.5 | v4 5.5 | `docs/atomic-v4/phase-05-frontend-perf/5.5-latency-budget.md` | Latency budget enforcement + per-stage metrics |
| 5.6 | v4 5.6 | `docs/atomic-v4/phase-05-frontend-perf/5.6-mutation-safety.md` | Zero-breakage: webapp mutation safety audit |

## Phase 6: Platform Foundation (6 units)

| Fork ID | Source | Spec Path | Description |
|---------|--------|-----------|-------------|
| 6.1 | v4 6.1 | `docs/atomic-v4/phase-06-platform-foundation/6.1-action-catalog.md` | ActionRegistry: full typed action catalog with Zod schemas |
| 6.2 | v4 6.2 | `docs/atomic-v4/phase-06-platform-foundation/6.2-agent-bridge.md` | AgentBridge: WebSocket command routing + result relay |
| 6.3 | v4 6.3 | `docs/atomic-v4/phase-06-platform-foundation/6.3-generic-renderer.md` | Capability UI: generic contract-driven renderer |
| 6.4 | v4 6.4 | `docs/atomic-v4/phase-06-platform-foundation/6.4-devtools.md` | DevTools surface: debug panel + capability harness |
| 6.5 | v4 6.5 | `docs/atomic-v4/phase-06-platform-foundation/6.5-provider-mgmt.md` | Provider management UI: add/remove/switch |
| 6.6 | v4 6.6 | `docs/atomic-v4/phase-06-platform-foundation/6.6-workspace-settings.md` | Workspace settings: profile paths, fleet config, ports |

## Phase 7: Reliability & Persistence (7 units)

| Fork ID | Source | Spec Path | Description |
|---------|--------|-----------|-------------|
| 7.1 | v4 7.1 | `docs/atomic-v4/phase-07-reliability/7.1-fleet-persistence.md` | Fleet state persistence: survive server restart |
| 7.2 | v4 7.2 | `docs/atomic-v4/phase-07-reliability/7.2-adopt-on-restart.md` | PortReaper adopt-on-restart: reconnect instead of kill |
| 7.3 | v4 7.3 | `docs/atomic-v4/phase-07-reliability/7.3-conversation-lock.md` | Conversation locking: configurable lock policy |
| 7.4 | v4 7.4 | `docs/atomic-v4/phase-07-reliability/7.4-double-send.md` | Double-send protection: idempotency keys |
| 7.5 | v4 7.5 | `docs/atomic-v4/phase-07-reliability/7.5-graceful-shutdown.md` | Graceful Chrome shutdown on SIGTERM |
| 7.6 | v4 7.6 | `docs/atomic-v4/phase-07-reliability/7.6-sqlite-wal.md` | SQLite pragma tuning + WAL mode |
| 7.7 | v4 7.7 | `docs/atomic-v4/phase-07-reliability/7.7-retry-policy.md` | Configurable retry policy engine |

## Phase 8: Resource Management (3 units)

| Fork ID | Source | Spec Path | Description |
|---------|--------|-----------|-------------|
| 8.1 | v4 8.1 | `docs/atomic-v4/phase-08-resource-mgmt/8.1-idle-ttl.md` | Idle slave TTL + configurable eviction policy |
| 8.2 | v4 8.2 | `docs/atomic-v4/phase-08-resource-mgmt/8.2-db-abstraction.md` | Database abstraction layer: multi-strategy store |
| 8.3 | v4 8.3 | `docs/atomic-v4/phase-08-resource-mgmt/8.3-backpressure.md` | Request queueing + backpressure with policy |

## Phase 9: Observability (5 units)

| Fork ID | Source | Spec Path | Description |
|---------|--------|-----------|-------------|
| 9.1 | v4 9.1 | `docs/atomic-v4/phase-09-observability/9.1-structured-logging.md` | Structured logging with pluggable transports |
| 9.2 | v4 9.2 | `docs/atomic-v4/phase-09-observability/9.2-metrics-export.md` | Metrics export pipeline (Prometheus/OTLP) |
| 9.3 | v4 9.3 | `docs/atomic-v4/phase-09-observability/9.3-error-tracking.md` | Error tracking integration |
| 9.4 | v4 9.4 | `docs/atomic-v4/phase-09-observability/9.4-audit-trail.md` | Audit trail for all user + system actions |
| 9.5 | v4 9.5 | `docs/atomic-v4/phase-09-observability/9.5-latency-sla.md` | Latency SLA monitoring + alerting |

## Phase 10: Frontend Resilience (3 units)

| Fork ID | Source | Spec Path | Description |
|---------|--------|-----------|-------------|
| 10.1 | v4 10.1 | `docs/atomic-v4/phase-10-frontend-resilience/10.1-error-boundary.md` | Error boundary + crash recovery |
| 10.2 | v4 10.2 | `docs/atomic-v4/phase-10-frontend-resilience/10.2-loading-states.md` | Loading + skeleton states for all async surfaces |
| 10.3 | v4 10.3 | `docs/atomic-v4/phase-10-frontend-resilience/10.3-keyboard-shortcuts.md` | Keyboard shortcuts + command palette |

## Phase 11: Stealth Core Architecture (4 units)

| Fork ID | Source | Spec Path | Description |
|---------|--------|-----------|-------------|
| 11.1 | v4 11.1 | `docs/atomic-v4/phase-11-stealth-core/11.1-launch-profile-engine.md` | LaunchProfileEngine: multi-mode launch strategy |
| 11.2 | v4 11.2 | `docs/atomic-v4/phase-11-stealth-core/11.2-stealth-module-engine.md` | StealthModuleEngine: registry + CDP injection pipeline |
| 11.3 | v4 11.3 | `docs/atomic-v4/phase-11-stealth-core/11.3-stealth-profile-store.md` | StealthProfile store: per-provider profile config from DB |
| 11.4 | v4 11.4 | `docs/atomic-v4/phase-11-stealth-core/11.4-extension-bridge.md` | ExtensionBridgeEngine: browser extension interaction mode |

## Phase 12: Fingerprint Spoofing (4 units)

| Fork ID | Source | Spec Path | Description |
|---------|--------|-----------|-------------|
| 12.1 | v4 12.1 | `docs/atomic-v4/phase-12-fingerprint-engines/12.1-canvas-noise.md` | CanvasNoiseEngine: canvas fingerprint perturbation |
| 12.2 | v4 12.2 | `docs/atomic-v4/phase-12-fingerprint-engines/12.2-webgl-spoof.md` | WebGlSpoofEngine: GPU renderer + vendor spoofing |
| 12.3 | v4 12.3 | `docs/atomic-v4/phase-12-fingerprint-engines/12.3-audio-context.md` | AudioContextEngine: audio fingerprint perturbation |
| 12.4 | v4 12.4 | `docs/atomic-v4/phase-12-fingerprint-engines/12.4-font-screen.md` | FontScreenEngine: font list + screen resolution spoofing |

## Phase 13: Human Simulation (3 units)

| Fork ID | Source | Spec Path | Description |
|---------|--------|-----------|-------------|
| 13.1 | v4 13.1 | `docs/atomic-v4/phase-13-human-simulation/13.1-human-mouse.md` | HumanMouseEngine: bezier-curve mouse movement |
| 13.2 | v4 13.2 | `docs/atomic-v4/phase-13-human-simulation/13.2-human-keyboard.md` | HumanKeyboardEngine: variable rhythm typing |
| 13.3 | v4 13.3 | `docs/atomic-v4/phase-13-human-simulation/13.3-human-scroll.md` | HumanScrollEngine: natural scroll velocity curves |

## Phase 14: Profile & Trace Stealth (4 units)

| Fork ID | Source | Spec Path | Description |
|---------|--------|-----------|-------------|
| 14.1 | v4 14.1 | `docs/atomic-v4/phase-14-profile-trace/14.1-profile-warmup.md` | ProfileWarmupEngine: history/cookie/trust building |
| 14.2 | v4 14.2 | `docs/atomic-v4/phase-14-profile-trace/14.2-cdp-artifact-cleaner.md` | CDPArtifactCleaner: remove CDP traces from page |
| 14.3 | v4 14.3 | `docs/atomic-v4/phase-14-profile-trace/14.3-network-fingerprint.md` | NetworkFingerprintEngine: TLS + HTTP header preservation |
| 14.4 | v4 14.4 | `docs/atomic-v4/phase-14-profile-trace/14.4-behavioral-pattern.md` | BehavioralPatternEngine: request timing + interaction rhythm |

## Phase 15: Kernel Oracle (4 units)

| Fork ID | Source | Spec Path | Description |
|---------|--------|-----------|-------------|
| 15.1 | v5 15.1 | `docs/atomic-v5/phase-15-kernel-oracle/15.1-oracle-query.md` | OracleQueryEngine: structured queries about system state |
| 15.2 | v5 15.2 | `docs/atomic-v5/phase-15-kernel-oracle/15.2-oracle-diagnostic.md` | OracleDiagnosticEngine: detect stubs, broken wires, missing deps |
| 15.3 | v5 15.3 | `docs/atomic-v5/phase-15-kernel-oracle/15.3-oracle-actuator.md` | OracleActuator: self-healing actions (restart, heal, reconfig) |
| 15.4 | v5 15.4 | `docs/atomic-v5/phase-15-kernel-oracle/15.4-oracle-event-stream.md` | OracleEventStream: real-time system state over WebSocket |

## Phase 16: Kernel Surfaces (6 units)

| Fork ID | Source | Spec Path | Description |
|---------|--------|-----------|-------------|
| 16.1 | v5 16.1 | `docs/atomic-v5/phase-16-kernel-surfaces/16.1-kernel-rest.md` | Kernel REST API: /api/kernel/* routes |
| 16.2 | v5 16.2 | `docs/atomic-v5/phase-16-kernel-surfaces/16.2-kernel-mcp.md` | Kernel MCP Tools: system.describe/diagnose/heal/explain |
| 16.3 | v5 16.3 | `docs/atomic-v5/phase-16-kernel-surfaces/16.3-kernel-cli.md` | Kernel CLI: kernel status/diagnose/trace/config commands |
| 16.4 | v5 16.4 | `docs/atomic-v5/phase-16-kernel-surfaces/16.4-kernel-frontend.md` | Kernel Frontend Surface: OracleDashboard in UI |
| 16.5 | v5 16.5 | `docs/atomic-v5/phase-00-surgical-edit/16.5-mcp-server-integration.md` | MCP Server Kernel Integration: register kernel tools |
| 16.6 | v5 16.6 | `docs/atomic-v5/phase-00-surgical-edit/16.6-cli-kernel-commands.md` | CLI Kernel Commands: bun run kernel status/diagnose/trace |

## Summary

| Phase | Units | Total |
|-------|-------|-------|
| 0 | 9 | 9 |
| 1 | 7 | 16 |
| 2 | 8 | 24 |
| 3 | 6 | 30 |
| 4 | 5 | 35 |
| 5 | 6 | 41 |
| 6 | 6 | 47 |
| 7 | 7 | 54 |
| 8 | 3 | 57 |
| 9 | 5 | 62 |
| 10 | 3 | 65 |
| 11 | 4 | 69 |
| 12 | 4 | 73 |
| 13 | 3 | 76 |
| 14 | 4 | 80 |
| 15 | 4 | 84 |
| 16 | 6 | **90** |
