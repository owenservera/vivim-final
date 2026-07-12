# Phase 1: E2E Bootstrap & Login — Phase Index

**Units:** 7 | **Status:** [ ] pending | **Domain:** User can log in, see Chrome window

## Overview

First proof of the CDP pipeline. User sees a visible Chrome window, can log in,
and state persists for headless reuse. This validates the CDP transport layer.

## Units

| ID | Name | Priority | Status |
|----|------|----------|--------|
| 1.1 | Wire CDP Transport | CRITICAL | [ ] |
| 1.2 | Seed Pipeline | CRITICAL | [ ] |
| 1.3 | Workspace + Profile Flow | HIGH | [ ] |
| 1.4 | Visible Chrome Login | CRITICAL | [ ] |
| 1.5 | Login State Verification | CRITICAL | [ ] |
| 1.6 | Complete + Persist | HIGH | [ ] |
| 1.7 | Headless Profile Reuse | HIGH | [ ] |

## Dependency Chain

```
1.1 → 1.2 → 1.3 → 1.4 → 1.5 → 1.6 → 1.7
```

## Key Design Decisions

1. **CDP transport first** — ChromeGovernor must connect to CDP before anything else
2. **Visible window for login** — First run must show Chrome for user to log in
3. **Profile persistence** — Save profile directory + CDP port for headless reuse
4. **Seed pipeline** — chatgpt/claude/gemini providers must be seeded at boot

## Spec References

- 1.1: `docs/atomic-v4/phase-01-e2e-bootstrap/1.1-wire-cdp-transport.md`
- 1.2: `docs/atomic-v4/phase-01-e2e-bootstrap/1.2-seed-pipeline.md`
- 1.3: `docs/atomic-v4/phase-01-e2e-bootstrap/1.3-workspace-profile-flow.md`
- 1.4: `docs/atomic-v4/phase-01-e2e-bootstrap/1.4-visible-chrome-login.md`
- 1.5: `docs/atomic-v4/phase-01-e2e-bootstrap/1.5-login-verify.md`
- 1.6: `docs/atomic-v4/phase-01-e2e-bootstrap/1.6-complete-persist.md`
- 1.7: `docs/atomic-v4/phase-01-e2e-bootstrap/1.7-headless-profile-reuse.md`

## Completion Criteria

- [ ] All 7 units marked [x] in tracker
- [ ] Chrome window opens, user can log in
- [ ] Login state persists for headless reuse
- [ ] Seeds loaded for all 3 providers
