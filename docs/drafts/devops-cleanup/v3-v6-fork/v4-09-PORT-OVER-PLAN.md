# v4 Port-Over Plan

## Cross-Reference: Fork ID → Source Spec

| Fork ID | v4 ID | Phase | Source Spec Path |
|---------|-------|-------|------------------|
| 1.1 | 1.1 | 1 | `docs/atomic-v4/phase-01-e2e-bootstrap/1.1-wire-cdp-transport.md` |
| 1.2 | 1.2 | 1 | `docs/atomic-v4/phase-01-e2e-bootstrap/1.2-seed-pipeline.md` |
| 1.3 | 1.3 | 1 | `docs/atomic-v4/phase-01-e2e-bootstrap/1.3-workspace-profile-flow.md` |
| 1.4 | 1.4 | 1 | `docs/atomic-v4/phase-01-e2e-bootstrap/1.4-visible-chrome-login.md` |
| 1.5 | 1.5 | 1 | `docs/atomic-v4/phase-01-e2e-bootstrap/1.5-login-verify.md` |
| 1.6 | 1.6 | 1 | `docs/atomic-v4/phase-01-e2e-bootstrap/1.6-complete-persist.md` |
| 1.7 | 1.7 | 1 | `docs/atomic-v4/phase-01-e2e-bootstrap/1.7-headless-profile-reuse.md` |
| 2.1 | 2.1 | 2 | `docs/atomic-v4/phase-02-single-turn/2.1-slave-id-derivation.md` |
| 2.2 | 2.2 | 2 | `docs/atomic-v4/phase-02-single-turn/2.2-harness-real-exec.md` |
| 2.3 | 2.3 | 2 | `docs/atomic-v4/phase-02-single-turn/2.3-composer-typing.md` |
| 2.4 | 2.4 | 2 | `docs/atomic-v4/phase-02-single-turn/2.4-submit-action.md` |
| 2.5 | 2.5 | 2 | `docs/atomic-v4/phase-02-single-turn/2.5-network-capture.md` |
| 2.6 | 2.6 | 2 | `docs/atomic-v4/phase-02-single-turn/2.6-parser-extract.md` |
| 2.7 | 2.7 | 2 | `docs/atomic-v4/phase-02-single-turn/2.7-store-emit.md` |
| 2.8 | 2.8 | 2 | `docs/atomic-v4/phase-02-single-turn/2.8-frontend-render.md` |
| 3.1 | 3.1 | 3 | `docs/atomic-v4/phase-03-multi-turn/3.1-state-persistence.md` |
| 3.2 | 3.2 | 3 | `docs/atomic-v4/phase-03-multi-turn/3.2-dom-recovery.md` |
| 3.3 | 3.3 | 3 | `docs/atomic-v4/phase-03-multi-turn/3.3-streaming-ws.md` |
| 3.4 | 3.4 | 3 | `docs/atomic-v4/phase-03-multi-turn/3.4-frontend-streaming.md` |
| 3.5 | 3.5 | 3 | `docs/atomic-v4/phase-03-multi-turn/3.5-error-recovery.md` |
| 3.6 | 3.6 | 3 | `docs/atomic-v4/phase-03-multi-turn/3.6-selector-healing.md` |
| 4.1 | 4.1 | 4 | `docs/atomic-v4/phase-04-three-provider/4.1-chatgpt-e2e.md` |
| 4.2 | 4.2 | 4 | `docs/atomic-v4/phase-04-three-provider/4.2-claude-e2e.md` |
| 4.3 | 4.3 | 4 | `docs/atomic-v4/phase-04-three-provider/4.3-gemini-e2e.md` |
| 4.4 | 4.4 | 4 | `docs/atomic-v4/phase-04-three-provider/4.4-provider-switch.md` |
| 4.5 | 4.5 | 4 | `docs/atomic-v4/phase-04-three-provider/4.5-health-monitor.md` |
| 5.1 | 5.1 | 5 | `docs/atomic-v4/phase-05-frontend-perf/5.1-optimistic-ui.md` |
| 5.2 | 5.2 | 5 | `docs/atomic-v4/phase-05-frontend-perf/5.2-ws-debounce.md` |
| 5.3 | 5.3 | 5 | `docs/atomic-v4/phase-05-frontend-perf/5.3-virtual-scroll.md` |
| 5.4 | 5.4 | 5 | `docs/atomic-v4/phase-05-frontend-perf/5.4-mirror-sync.md` |
| 5.5 | 5.5 | 5 | `docs/atomic-v4/phase-05-frontend-perf/5.5-latency-budget.md` |
| 5.6 | 5.6 | 5 | `docs/atomic-v4/phase-05-frontend-perf/5.6-mutation-safety.md` |
| 6.1 | 6.1 | 6 | `docs/atomic-v4/phase-06-platform-foundation/6.1-action-catalog.md` |
| 6.2 | 6.2 | 6 | `docs/atomic-v4/phase-06-platform-foundation/6.2-agent-bridge.md` |
| 6.3 | 6.3 | 6 | `docs/atomic-v4/phase-06-platform-foundation/6.3-generic-renderer.md` |
| 6.4 | 6.4 | 6 | `docs/atomic-v4/phase-06-platform-foundation/6.4-devtools.md` |
| 6.5 | 6.5 | 6 | `docs/atomic-v4/phase-06-platform-foundation/6.5-provider-mgmt.md` |
| 6.6 | 6.6 | 6 | `docs/atomic-v4/phase-06-platform-foundation/6.6-workspace-settings.md` |
| 7.1 | 7.1 | 7 | `docs/atomic-v4/phase-07-reliability/7.1-fleet-persistence.md` |
| 7.2 | 7.2 | 7 | `docs/atomic-v4/phase-07-reliability/7.2-adopt-on-restart.md` |
| 7.3 | 7.3 | 7 | `docs/atomic-v4/phase-07-reliability/7.3-conversation-lock.md` |
| 7.4 | 7.4 | 7 | `docs/atomic-v4/phase-07-reliability/7.4-double-send.md` |
| 7.5 | 7.5 | 7 | `docs/atomic-v4/phase-07-reliability/7.5-graceful-shutdown.md` |
| 7.6 | 7.6 | 7 | `docs/atomic-v4/phase-07-reliability/7.6-sqlite-wal.md` |
| 7.7 | 7.7 | 7 | `docs/atomic-v4/phase-07-reliability/7.7-retry-policy.md` |
| 8.1 | 8.1 | 8 | `docs/atomic-v4/phase-08-resource-mgmt/8.1-idle-ttl.md` |
| 8.2 | 8.2 | 8 | `docs/atomic-v4/phase-08-resource-mgmt/8.2-db-abstraction.md` |
| 8.3 | 8.3 | 8 | `docs/atomic-v4/phase-08-resource-mgmt/8.3-backpressure.md` |
| 9.1 | 9.1 | 9 | `docs/atomic-v4/phase-09-observability/9.1-structured-logging.md` |
| 9.2 | 9.2 | 9 | `docs/atomic-v4/phase-09-observability/9.2-metrics-export.md` |
| 9.3 | 9.3 | 9 | `docs/atomic-v4/phase-09-observability/9.3-error-tracking.md` |
| 9.4 | 9.4 | 9 | `docs/atomic-v4/phase-09-observability/9.4-audit-trail.md` |
| 9.5 | 9.5 | 9 | `docs/atomic-v4/phase-09-observability/9.5-latency-sla.md` |
| 10.1 | 10.1 | 10 | `docs/atomic-v4/phase-10-frontend-resilience/10.1-error-boundary.md` |
| 10.2 | 10.2 | 10 | `docs/atomic-v4/phase-10-frontend-resilience/10.2-loading-states.md` |
| 10.3 | 10.3 | 10 | `docs/atomic-v4/phase-10-frontend-resilience/10.3-keyboard-shortcuts.md` |
| 11.1 | 11.1 | 11 | `docs/atomic-v4/phase-11-stealth-core/11.1-launch-profile-engine.md` |
| 11.2 | 11.2 | 11 | `docs/atomic-v4/phase-11-stealth-core/11.2-stealth-module-engine.md` |
| 11.3 | 11.3 | 11 | `docs/atomic-v4/phase-11-stealth-core/11.3-stealth-profile-store.md` |
| 11.4 | 11.4 | 11 | `docs/atomic-v4/phase-11-stealth-core/11.4-extension-bridge.md` |
| 12.1 | 12.1 | 12 | `docs/atomic-v4/phase-12-fingerprint-engines/12.1-canvas-noise.md` |
| 12.2 | 12.2 | 12 | `docs/atomic-v4/phase-12-fingerprint-engines/12.2-webgl-spoof.md` |
| 12.3 | 12.3 | 12 | `docs/atomic-v4/phase-12-fingerprint-engines/12.3-audio-context.md` |
| 12.4 | 12.4 | 12 | `docs/atomic-v4/phase-12-fingerprint-engines/12.4-font-screen.md` |
| 13.1 | 13.1 | 13 | `docs/atomic-v4/phase-13-human-simulation/13.1-human-mouse.md` |
| 13.2 | 13.2 | 13 | `docs/atomic-v4/phase-13-human-simulation/13.2-human-keyboard.md` |
| 13.3 | 13.3 | 13 | `docs/atomic-v4/phase-13-human-simulation/13.3-human-scroll.md` |
| 14.1 | 14.1 | 14 | `docs/atomic-v4/phase-14-profile-trace/14.1-profile-warmup.md` |
| 14.2 | 14.2 | 14 | `docs/atomic-v4/phase-14-profile-trace/14.2-cdp-artifact-cleaner.md` |
| 14.3 | 14.3 | 14 | `docs/atomic-v4/phase-14-profile-trace/14.3-network-fingerprint.md` |
| 14.4 | 14.4 | 14 | `docs/atomic-v4/phase-14-profile-trace/14.4-behavioral-pattern.md` |

## Summary

| Phase | Units | Source |
|-------|-------|--------|
| 1 | 7 | v4 Phase 1 |
| 2 | 8 | v4 Phase 2 |
| 3 | 6 | v4 Phase 3 |
| 4 | 5 | v4 Phase 4 |
| 5 | 6 | v4 Phase 5 |
| 6 | 6 | v4 Phase 6 |
| 7 | 7 | v4 Phase 7 |
| 8 | 3 | v4 Phase 8 |
| 9 | 5 | v4 Phase 9 |
| 10 | 3 | v4 Phase 10 |
| 11 | 4 | v4 Phase 11 |
| 12 | 4 | v4 Phase 12 |
| 13 | 3 | v4 Phase 13 |
| 14 | 4 | v4 Phase 14 |
| **Total** | **71** | |

**Note:** Fork IDs match v4 IDs exactly (1:1 mapping). No renumbering needed.
