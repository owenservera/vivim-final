# Phase 7: Reliability & Persistence — Phase Index

**Units:** 7 | **Status:** [ ] pending | **Domain:** Fleet persistence, port reaper, conversation locking, graceful shutdown

## Overview

Reliability: fleet state persistence across restarts, port reaper adopt-on-restart,
conversation locking, double-send protection, graceful Chrome shutdown, SQLite WAL mode,
configurable retry policies.

## Units

| ID | Name | Priority | Status |
|----|------|----------|--------|
| 7.1 | Fleet Persistence | CRITICAL | [ ] |
| 7.2 | Port Reaper Adopt | HIGH | [ ] |
| 7.3 | Conversation Lock | HIGH | [ ] |
| 7.4 | Double Send Protection | HIGH | [ ] |
| 7.5 | Graceful Shutdown | HIGH | [ ] |
| 7.6 | SQLite WAL Mode | MEDIUM | [ ] |
| 7.7 | Retry Policy | MEDIUM | [ ] |

## Dependency Chain

```
7.1 → 7.2 → 7.3 → 7.4 → 7.5 → 7.6 → 7.7
```

## Key Design Decisions

1. **Fleet persistence** — State must survive server restart
2. **Adopt on restart** — PortReaper should reconnect, not kill
3. **Conversation locking** — Configurable lock policy
4. **Double-send protection** — Idempotency keys prevent duplicate sends
5. **Graceful shutdown** — SIGTERM handler for clean Chrome exit

## Spec References

- 7.1: `docs/atomic-v4/phase-07-reliability/7.1-fleet-persistence.md`
- 7.2: `docs/atomic-v4/phase-07-reliability/7.2-adopt-on-restart.md`
- 7.3: `docs/atomic-v4/phase-07-reliability/7.3-conversation-lock.md`
- 7.4: `docs/atomic-v4/phase-07-reliability/7.4-double-send.md`
- 7.5: `docs/atomic-v4/phase-07-reliability/7.5-graceful-shutdown.md`
- 7.6: `docs/atomic-v4/phase-07-reliability/7.6-sqlite-wal.md`
- 7.7: `docs/atomic-v4/phase-07-reliability/7.7-retry-policy.md`

## Completion Criteria

- [ ] All 7 units marked [x] in tracker
- [ ] Fleet state persists across restarts
- [ ] Graceful shutdown works cleanly
- [ ] Conversation locking prevents conflicts
