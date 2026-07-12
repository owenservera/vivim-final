# Phase 11: Kernel Oracle

**Source:** v5 Phase 15 (`docs/atomic-v5/phase-15-kernel-oracle/`)
**Units:** 4 | **Done:** 0 | **Pending:** 4
**Dependencies:** All prior phases (oracle queries the full system)

## Units

| Fork ID | v5 ID | Name | Status | File |
|---------|-------|------|--------|------|
| 11.1 | 15.1 | OracleQueryEngine: structured queries about system state | `[ ]` | `docs/atomic-v5/phase-15-kernel-oracle/15.1-oracle-query.md` |
| 11.2 | 15.2 | OracleDiagnosticEngine: detect stubs, broken wires, missing deps | `[ ]` | `docs/atomic-v5/phase-15-kernel-oracle/15.2-oracle-diagnostic.md` |
| 11.3 | 15.3 | OracleActuator: self-healing actions (restart, heal, reconfig) | `[ ]` | `docs/atomic-v5/phase-15-kernel-oracle/15.3-oracle-actuator.md` |
| 11.4 | 15.4 | OracleEventStream: real-time system state over WebSocket | `[ ]` | `docs/atomic-v5/phase-15-kernel-oracle/15.4-oracle-event-stream.md` |

## Internal Dependencies

```
11.1 Query → 11.2 Diagnostic → 11.3 Actuator → 11.4 EventStream
```
