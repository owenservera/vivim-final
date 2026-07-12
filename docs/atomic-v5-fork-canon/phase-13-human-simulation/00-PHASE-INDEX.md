# Phase 13: Human Simulation Engines — Phase Index

**Units:** 3 | **Status:** [ ] pending | **Domain:** Mouse, keyboard, scroll simulation

## Overview

Human simulation: bezier-curve mouse movement, variable rhythm typing,
natural scroll velocity curves.

## Units

| ID | Name | Priority | Status |
|----|------|----------|--------|
| 13.1 | Human Mouse | HIGH | [ ] |
| 13.2 | Human Keyboard | HIGH | [ ] |
| 13.3 | Human Scroll | MEDIUM | [ ] |

## Dependency Chain

```
13.1 → 13.2 → 13.3
```

## Key Design Decisions

1. **Bezier curves** — Mouse movement follows natural bezier paths
2. **Variable rhythm** — Typing speed varies (not constant)
3. **Natural scroll** — Scroll velocity follows human-like curves

## Spec References

- 13.1: `docs/atomic-v4/phase-13-human-simulation/13.1-human-mouse.md`
- 13.2: `docs/atomic-v4/phase-13-human-simulation/13.2-human-keyboard.md`
- 13.3: `docs/atomic-v4/phase-13-human-simulation/13.3-human-scroll.md`

## Completion Criteria

- [ ] All 3 units marked [x] in tracker
- [ ] Mouse movement follows bezier curves
- [ ] Typing has variable rhythm
- [ ] Scroll velocity is natural
