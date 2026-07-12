# Phase 4: Three-Provider Demo — Phase Index

**Units:** 5 | **Status:** [ ] pending | **Domain:** ChatGPT + Claude + Gemini all working

## Overview

Provider coverage: verify all three providers (ChatGPT, Claude, Gemini) work end-to-end.
Multi-provider switching in frontend. Provider health monitoring.

## Units

| ID | Name | Priority | Status |
|----|------|----------|--------|
| 4.1 | ChatGPT E2E | HIGH | [ ] |
| 4.2 | Claude E2E | HIGH | [ ] |
| 4.3 | Gemini E2E | HIGH | [ ] |
| 4.4 | Provider Switch | MEDIUM | [ ] |
| 4.5 | Health Monitor | MEDIUM | [ ] |

## Dependency Chain

```
4.1 → 4.2 → 4.3 → 4.4 → 4.5
```

## Key Design Decisions

1. **E2E per provider** — Each provider needs full pipeline verification
2. **Provider switching** — Frontend can switch between providers mid-conversation
3. **Health monitoring** — Track provider status (connected/disconnected/error)

## Spec References

- 4.1: `docs/atomic-v4/phase-04-three-provider/4.1-chatgpt-e2e.md`
- 4.2: `docs/atomic-v4/phase-04-three-provider/4.2-claude-e2e.md`
- 4.3: `docs/atomic-v4/phase-04-three-provider/4.3-gemini-e2e.md`
- 4.4: `docs/atomic-v4/phase-04-three-provider/4.4-provider-switch.md`
- 4.5: `docs/atomic-v4/phase-04-three-provider/4.5-health-monitor.md`

## Completion Criteria

- [ ] All 5 units marked [x] in tracker
- [ ] All 3 providers work end-to-end
- [ ] Provider switching works in frontend
- [ ] Health monitoring active
