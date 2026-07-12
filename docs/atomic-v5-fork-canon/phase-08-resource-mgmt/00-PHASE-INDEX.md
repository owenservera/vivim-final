# Phase 8: Resource Management — Phase Index

**Units:** 3 | **Status:** [ ] pending | **Domain:** Idle TTL, DB abstraction, backpressure

## Overview

Resource management: idle slave TTL with configurable eviction, database abstraction layer,
request queueing with backpressure policy.

## Units

| ID | Name | Priority | Status |
|----|------|----------|--------|
| 8.1 | Idle TTL | MEDIUM | [ ] |
| 8.2 | DB Abstraction | HIGH | [ ] |
| 8.3 | Backpressure | MEDIUM | [ ] |

## Dependency Chain

```
8.1 → 8.2 → 8.3
```

## Key Design Decisions

1. **Idle TTL** — Configurable eviction policy for unused slaves
2. **DB abstraction** — Multi-strategy store (SQLite, in-memory, etc.)
3. **Backpressure** — Request queueing with policy (reject, queue, shed)

## Spec References

- 8.1: `docs/atomic-v4/phase-08-resource-mgmt/8.1-idle-ttl.md`
- 8.2: `docs/atomic-v4/phase-08-resource-mgmt/8.2-db-abstraction.md`
- 8.3: `docs/atomic-v4/phase-08-resource-mgmt/8.3-backpressure.md`

## Completion Criteria

- [ ] All 3 units marked [x] in tracker
- [ ] Idle slaves are evicted after TTL
- [ ] DB abstraction layer works
- [ ] Backpressure policy enforced
