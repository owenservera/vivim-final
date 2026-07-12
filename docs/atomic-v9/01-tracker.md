# Atomic v9 Implementation Tracker

**Total units:** 10 | **Done:** 10 | **Pending:** 0

> Phase 23: Unified Command + Config + Oracle Surface.
> Turns the passive kernel/oracle into a live, configurable, operable system.
> PRD: docs/prd-kernel-cli-oracle-integration.md

---

## Phase 23: Unified Command + Config + Oracle Surface (10 units)

- [x] 23.1 — ConfigUniversalSurface → `src/engines/config-universal-surface.ts`
- [x] 23.2 — Kernel CLI commands (oracle + config) → `src/cli/commands/kernel.ts`
- [x] 23.3 — CapabilityAutoBridge (wire syncCliFromUnified at startup) → `src/cli/index.ts`
- [x] 23.4 — NLCL kernel + config patterns → `src/engines/nlcl/catalog.ts` (already exists - extending with kernel patterns)
- [x] 23.5 — Canvas config + kernel capabilities → `src/canvas/canvas-agent-tools.ts`
- [x] 23.6 — Kernel/Config REST routes → `src/server/kernel-router.ts`
- [x] 23.7 — ProtocolLoopParser (loop-mode streaming parse) → `src/engines/protocol-loop-parser.ts`
- [x] 23.8 — CapabilityDiscoveryLoop (auto-discover + store) → `src/engines/capability-discovery-loop.ts`
- [x] 23.9 — Realtime telemetry (oracle events + config:changed → WS) → `src/server/websocket.ts`
- [x] 23.10 — Tests (23.1–23.6) → `tests/unit/engines/config-universal-surface.test.ts` + others