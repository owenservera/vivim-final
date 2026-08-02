# VIVIM Full Workplan — Remaining Work
# Generated: 2026-08-02

## Current State Summary

### DONE (verified, tests pass)
- Phase 0A: Memory intelligence patches (memory, context, semantic, export, harness)
- Phase 0B: Tunnel + P2P — 16 source files ported to src/lib/
- Phase 1: Schema + 21 models + 10 routes + FTS5 + 5 views + taxonomy seeds
- Integration Phases 1-8: chain-verifier, ledger-client, manifest-applier, connection-manager, frame-protocol, orchestrator wiring
- Testing: 59 tests across 10 files, 122 assertions — ALL PASS

### UNTESTED (13 files in src/lib/)
| Module | Files | Priority | Complexity |
|--------|-------|----------|------------|
| tunnel-shared | constants, errors, index, logger, types | LOW | Pure values/types |
| p2p-node | crdt-sync, file-sync, index, node-manager, types | HIGH | libp2p, crypto, streams |
| tunnel-client | heartbeat, index, reconnection, request-handler, types | MED | Timers, HTTP fwd |
| orchestrator | config, health-monitor, index | MED | Config, timers |
| local-server | index | MED | HTTP server |

### MISSING (docs/process)
- AGENTS.md: No maintenance testing protocol
- POST-UPGRADE-REVIEW.md: Not updated with test results

## Workplan (8 units, sequential)

### Unit 1: tunnel-shared tests (constants, errors)
- Test PROTOCOL_VERSION, TUNNEL_DEFAULTS, P2P_PROTOCOLS values
- Test VivimError, TunnelError, TunnelConnectionError hierarchy
- File: tests/unit/lib/tunnel-shared/shared.test.ts
- **Status: DONE** — 10 tests, 14 assertions

### Unit 2: tunnel-client tests (heartbeat, reconnection, request-handler)
- Heartbeat: start/stop, ping/pong timeout
- ReconnectionManager: backoff calculation, reset
- RequestHandler: request forwarding, timeout
- Files: tests/unit/lib/tunnel-client/{heartbeat,reconnection,request-handler}.test.ts
- **Status: DONE** — 27 tests, 36 assertions

### Unit 3: orchestrator tests (config, health-monitor)
- Config: defaults, env overrides
- HealthMonitor: service registration, status updates
- Files: tests/unit/lib/orchestrator/{config,health-monitor}.test.ts
- **Status: DONE** — 19 tests, 30 assertions

### Unit 4: p2p-node tests (crdt-sync, file-sync, node-manager)
- CRDTDocument: apply operation, merge, clock sync
- FileSyncHandler: progress events, transfer tracking
- NodeManager: lifecycle (mocked libp2p), state transitions
- Files: tests/unit/lib/p2p-node/{crdt-sync,file-sync,node-manager}.test.ts
- **Status: DONE** — 27 tests, 51 assertions

### Unit 5: local-server test
- LocalServer: start/stop, request handling
- File: tests/unit/lib/local-server/local-server.test.ts
- **Status: DONE** — 10 tests, 18 assertions

### Unit 6: Integration — end-to-end sync pipeline with real crypto
- Full pipeline with actual Ed25519 signing (not mocked)
- File: tests/integration/lib/full-pipeline-crypto.test.ts
- **Status: DONE** — 10 tests, 18 assertions

### Unit 7: AGENTS.md + POST-UPGRADE-REVIEW.md update
- Add maintenance testing protocol to AGENTS.md
- Update POST-UPGRADE-REVIEW.md with test results
- **Status: DONE** — both files updated

### Unit 8: Final gate — run all tests + tsc
- bun test tests/unit/lib/ tests/integration/lib/
- bunx tsc --noEmit
- **Status: DONE** — 146 tests, 296 assertions, 0 source file TS errors
