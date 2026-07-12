# Phase 11: Stealth Core Architecture — Phase Index

**Units:** 4 | **Status:** [ ] pending | **Domain:** Launch profiles, stealth modules, profile store, extension bridge

## Overview

Stealth core: multi-mode launch strategy, stealth module registry with CDP injection,
per-provider profile config from DB, browser extension interaction mode.

## Units

| ID | Name | Priority | Status |
|----|------|----------|--------|
| 11.1 | Launch Profile Engine | HIGH | [ ] |
| 11.2 | Stealth Module Engine | HIGH | [ ] |
| 11.3 | Stealth Profile Store | MEDIUM | [ ] |
| 11.4 | Extension Bridge | MEDIUM | [ ] |

## Dependency Chain

```
11.1 → 11.2 → 11.3 → 11.4
```

## Key Design Decisions

1. **Launch profiles** — Multi-mode launch (headless, headed, stealth)
2. **Stealth modules** — Registry + CDP injection pipeline
3. **Profile store** — Per-provider profile config from DB
4. **Extension bridge** — Browser extension interaction mode

## Spec References

- 11.1: `docs/atomic-v4/phase-11-stealth-core/11.1-launch-profile-engine.md`
- 11.2: `docs/atomic-v4/phase-11-stealth-core/11.2-stealth-module-engine.md`
- 11.3: `docs/atomic-v4/phase-11-stealth-core/11.3-stealth-profile-store.md`
- 11.4: `docs/atomic-v4/phase-11-stealth-core/11.4-extension-bridge.md`

## Completion Criteria

- [ ] All 4 units marked [x] in tracker
- [ ] Launch profiles work (headless, headed, stealth)
- [ ] Stealth modules inject via CDP
- [ ] Profile store reads from DB
