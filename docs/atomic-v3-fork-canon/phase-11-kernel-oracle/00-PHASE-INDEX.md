# Phase 11: Kernel Oracle

**Source:** v5 Phase 15 (`docs/atomic-v5/phase-15-kernel-oracle/`)
**Units:** 4 | **Done:** 4 | **Pending:** 0
**Status:** COMPLETE — implemented as v8, all code in `src/engines/kernel/`
**Dependencies:** All prior phases (oracle queries the full system)

## Units

| Fork ID | v5 ID | Name | Status | File |
|---------|-------|------|--------|------|
| 11.1 | 15.1 | OracleQueryEngine: structured queries about system state | `[x]` | `docs/atomic-v5/phase-15-kernel-oracle/15.1-oracle-query.md` |
| 11.2 | 15.2 | OracleDiagnosticEngine: detect stubs, broken wires, missing deps | `[x]` | `docs/atomic-v5/phase-15-kernel-oracle/15.2-oracle-diagnostic.md` |
| 11.3 | 15.3 | OracleActuator: self-healing actions (restart, heal, reconfig) | `[x]` | `docs/atomic-v5/phase-15-kernel-oracle/15.3-oracle-actuator.md` |
| 11.4 | 15.4 | OracleEventStream: real-time system state over WebSocket | `[x]` | `docs/atomic-v5/phase-15-kernel-oracle/15.4-oracle-event-stream.md` |

## Internal Dependencies

```
11.1 Query → 11.2 Diagnostic → 11.3 Actuator → 11.4 EventStream
```
