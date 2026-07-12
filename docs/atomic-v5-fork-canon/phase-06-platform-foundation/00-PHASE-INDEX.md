# Phase 6: Platform Foundation — Phase Index

**Units:** 6 | **Status:** [ ] pending | **Domain:** Action registry, agent bridge, capability UI, DevTools

## Overview

Platform foundation: typed action catalog with Zod schemas, WebSocket command routing,
generic capability renderer, DevTools surface, provider management UI, workspace settings.

## Units

| ID | Name | Priority | Status |
|----|------|----------|--------|
| 6.1 | Action Registry | CRITICAL | [ ] |
| 6.2 | Agent Bridge | CRITICAL | [ ] |
| 6.3 | Generic Renderer | HIGH | [ ] |
| 6.4 | DevTools Surface | MEDIUM | [ ] |
| 6.5 | Provider Management UI | MEDIUM | [ ] |
| 6.6 | Workspace Settings | MEDIUM | [ ] |

## Dependency Chain

```
6.1 → 6.2 → 6.3 → 6.4 → 6.5 → 6.6
```

## Key Design Decisions

1. **Action registry** — Full typed action catalog with Zod schemas (not a stub)
2. **Agent bridge** — WebSocket command routing + result relay
3. **Generic renderer** — Contract-driven capability UI (not hardcoded)
4. **DevTools** — Debug panel + capability harness for development

## Spec References

- 6.1: `docs/atomic-v4/phase-06-platform-foundation/6.1-action-catalog.md`
- 6.2: `docs/atomic-v4/phase-06-platform-foundation/6.2-agent-bridge.md`
- 6.3: `docs/atomic-v4/phase-06-platform-foundation/6.3-generic-renderer.md`
- 6.4: `docs/atomic-v4/phase-06-platform-foundation/6.4-devtools.md`
- 6.5: `docs/atomic-v4/phase-06-platform-foundation/6.5-provider-mgmt.md`
- 6.6: `docs/atomic-v4/phase-06-platform-foundation/6.6-workspace-settings.md`

## Completion Criteria

- [ ] All 6 units marked [x] in tracker
- [ ] Action registry has full typed catalog
- [ ] Agent bridge routes commands via WebSocket
- [ ] Generic capability renderer works
