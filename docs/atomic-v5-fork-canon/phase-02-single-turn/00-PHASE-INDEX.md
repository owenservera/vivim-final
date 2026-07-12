# Phase 2: Single-Turn Conversation — Phase Index

**Units:** 8 | **Status:** [ ] pending | **Domain:** Full conversation flow: send message → get response → see result

## Overview

Complete single-turn conversation: user types message, Chrome types into provider chatbox,
submits, captures streaming response, parses to blocks, stores, and frontend renders.
This validates the full CDP pipeline end-to-end.

## Units

| ID | Name | Priority | Status |
|----|------|----------|--------|
| 2.1 | Slave ID Derivation | CRITICAL | [ ] |
| 2.2 | Harness Runtime Real Exec | CRITICAL | [ ] |
| 2.3 | Composer Typing via CDP | CRITICAL | [ ] |
| 2.4 | Submit Action via CDP | CRITICAL | [ ] |
| 2.5 | Network Capture | CRITICAL | [ ] |
| 2.6 | Parser: SSE → Blocks | CRITICAL | [ ] |
| 2.7 | Store + Emit Events | HIGH | [ ] |
| 2.8 | Frontend Render | HIGH | [ ] |

## Dependency Chain

```
2.1 → 2.2 → 2.3 → 2.4 → 2.5 → 2.6 → 2.7 → 2.8
```

## Key Design Decisions

1. **slaveId derivation** — Must match FleetSupervisor naming convention
2. **Real harness execution** — Not a stub; must actually type + submit via CDP
3. **Network capture** — Intercept streaming API response via CDP
4. **Parser** — SSE/streaming body → ContentBlock[] (text, code, markdown)

## Spec References

- 2.1: `docs/atomic-v4/phase-02-single-turn/2.1-slave-id-derivation.md`
- 2.2: `docs/atomic-v4/phase-02-single-turn/2.2-harness-real-exec.md`
- 2.3: `docs/atomic-v4/phase-02-single-turn/2.3-composer-typing.md`
- 2.4: `docs/atomic-v4/phase-02-single-turn/2.4-submit-action.md`
- 2.5: `docs/atomic-v4/phase-02-single-turn/2.5-network-capture.md`
- 2.6: `docs/atomic-v4/phase-02-single-turn/2.6-parser-extract.md`
- 2.7: `docs/atomic-v4/phase-02-single-turn/2.7-store-emit.md`
- 2.8: `docs/atomic-v4/phase-02-single-turn/2.8-frontend-render.md`

## Completion Criteria

- [ ] All 8 units marked [x] in tracker
- [ ] User can send message and see response in frontend
- [ ] CDP types into provider chatbox and submits
- [ ] Streaming response captured and parsed
