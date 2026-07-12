# Phase 5: Frontend Performance — Phase Index

**Units:** 6 | **Status:** [ ] pending | **Domain:** Fast, responsive UI with optimistic updates

## Overview

Frontend performance: optimistic UI, WebSocket debouncing, virtual scrolling,
mirror engine for bidirectional state sync, latency budgets, mutation safety.

## Units

| ID | Name | Priority | Status |
|----|------|----------|--------|
| 5.1 | Optimistic UI | HIGH | [ ] |
| 5.2 | WebSocket Debounce | HIGH | [ ] |
| 5.3 | Virtual Scroll | MEDIUM | [ ] |
| 5.4 | Mirror Engine | HIGH | [ ] |
| 5.5 | Latency Budget | MEDIUM | [ ] |
| 5.6 | Mutation Safety | HIGH | [ ] |

## Dependency Chain

```
5.1 → 5.2 → 5.3 → 5.4 → 5.5 → 5.6
```

## Key Design Decisions

1. **Optimistic UI** — Instant message echo on send (no waiting for server)
2. **WS debouncing** — Batch streaming block updates to reduce re-renders
3. **Virtual scrolling** — Handle long conversations without performance hit
4. **Mirror engine** — UI⇄Chrome bidirectional state sync
5. **Mutation safety** — Audit webapp mutations to prevent corruption

## Spec References

- 5.1: `docs/atomic-v4/phase-05-frontend-perf/5.1-optimistic-ui.md`
- 5.2: `docs/atomic-v4/phase-05-frontend-perf/5.2-ws-debounce.md`
- 5.3: `docs/atomic-v4/phase-05-frontend-perf/5.3-virtual-scroll.md`
- 5.4: `docs/atomic-v4/phase-05-frontend-perf/5.4-mirror-sync.md`
- 5.5: `docs/atomic-v4/phase-05-frontend-perf/5.5-latency-budget.md`
- 5.6: `docs/atomic-v4/phase-05-frontend-perf/5.6-mutation-safety.md`

## Completion Criteria

- [ ] All 6 units marked [x] in tracker
- [ ] Optimistic UI works (instant message echo)
- [ ] Streaming is smooth with debouncing
- [ ] Long conversations scroll without lag
