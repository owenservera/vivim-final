# Phase 15: Kernel Oracle — Phase Index

**Units:** 4 | **Status:** [ ] pending | **Domain:** System self-understanding — query, diagnose, heal, stream

## Overview

The kernel oracle makes the system queryable. You can ask it questions about its own state,
detect problems (stubs, broken wires, missing deps), take self-healing actions, and stream
real-time system state over WebSocket.

## Units

| ID | Name | Priority | Status |
|----|------|----------|--------|
| 15.1 | Oracle Query Engine | HIGH | [ ] |
| 15.2 | Oracle Diagnostic Engine | HIGH | [ ] |
| 15.3 | Oracle Actuator | HIGH | [ ] |
| 15.4 | Oracle Event Stream | MEDIUM | [ ] |

## Dependency Chain

```
15.1 → 15.2 → 15.3 → 15.4
```

## Key Design Decisions

1. **Structured queries** — OracleQueryEngine handles typed queries about system state
2. **Diagnostic engine** — Detects stubs, broken wires, missing dependencies
3. **Actuator** — Self-healing actions (restart, heal, reconfig)
4. **Event stream** — Real-time system state over WebSocket

## Spec References

- 15.1: `docs/atomic-v5/phase-15-kernel-oracle/15.1-oracle-query.md`
- 15.2: `docs/atomic-v5/phase-15-kernel-oracle/15.2-oracle-diagnostic.md`
- 15.3: `docs/atomic-v5/phase-15-kernel-oracle/15.3-oracle-actuator.md`
- 15.4: `docs/atomic-v5/phase-15-kernel-oracle/15.4-oracle-event-stream.md`

## Completion Criteria

- [ ] All 4 units marked [x] in tracker
- [ ] OracleQueryEngine answers structured questions
- [ ] Diagnostic engine detects problems
- [ ] Actuator performs self-healing
- [ ] Event stream delivers real-time state
