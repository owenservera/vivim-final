# Phase 3: Multi-Turn Conversation — Phase Index

**Units:** 6 | **Status:** [ ] pending | **Domain:** Multiple turns, streaming, DOM recovery, error handling

## Overview

Extended conversation: multiple turns with state persistence, streaming block delivery,
DOM recovery after page reload, and error recovery. This validates robustness.

## Units

| ID | Name | Priority | Status |
|----|------|----------|--------|
| 3.1 | State Persistence | HIGH | [ ] |
| 3.2 | DOM Recovery | HIGH | [ ] |
| 3.3 | Streaming via WebSocket | CRITICAL | [ ] |
| 3.4 | Frontend Streaming | HIGH | [ ] |
| 3.5 | Error Recovery | HIGH | [ ] |
| 3.6 | Selector Healing | MEDIUM | [ ] |

## Dependency Chain

```
3.1 → 3.2 → 3.3 → 3.4 → 3.5 → 3.6
```

## Key Design Decisions

1. **State persistence** — Conversation state must survive across turns
2. **DOM recovery** — Handle page reload + SPA navigation
3. **Streaming** — Progressive block delivery over WebSocket
4. **Selector healing** — Auto-detect + repair broken selectors

## Spec References

- 3.1: `docs/atomic-v4/phase-03-multi-turn/3.1-state-persistence.md`
- 3.2: `docs/atomic-v4/phase-03-multi-turn/3.2-dom-recovery.md`
- 3.3: `docs/atomic-v4/phase-03-multi-turn/3.3-streaming-ws.md`
- 3.4: `docs/atomic-v4/phase-03-multi-turn/3.4-frontend-streaming.md`
- 3.5: `docs/atomic-v4/phase-03-multi-turn/3.5-error-recovery.md`
- 3.6: `docs/atomic-v4/phase-03-multi-turn/3.6-selector-healing.md`

## Completion Criteria

- [ ] All 6 units marked [x] in tracker
- [ ] Multi-turn conversations work with state persistence
- [ ] Streaming blocks delivered progressively
- [ ] DOM recovery handles page reloads
