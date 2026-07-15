# Unit 37.2 — Onboarding Flow

**Fork ID:** 13.3 (v3: 10.3) | **Status:** `[ ]` | **Class:** C

> **Audit (2026-07-13):** No `onboarding` directory or first-run wizard in `web/`. Confirmed `[ ]`.
**Source spec:** `docs/atomic-v3-fork-canon/phase-13-polish-sdk/10.3-onboarding-flow.md`
**Depends on:** providers (Phase 6), device pairing (36.4), airgap (10.4)

## Context
First-run experience: guide a new user through profile, provider connect (local or cloud-with-consent), and a sample task, so they reach value fast.

## Current State
- Providers + consent exist; no guided first-run.
- `web/ui/` primitives available.

## Requirements
New `web/sandbox/src/onboarding/`:
- Step wizard: welcome → connect provider → (optional) cloud consent → run a sample capability → done.
- Persists onboarding completion; skippable; re-openable from settings.
- Respects airgap (defaults to local provider).

## Acceptance Criteria
1. Wizard walks through provider connect + sample task.
2. Completion state persisted; skip works.
3. Airgap default steers to local provider.
4. `bun run devops gate` passes (`web/`).

## Tests
`web/sandbox/src/onboarding/__tests__/onboarding.test.tsx` — completes flow; skip persists; re-open works.

## DevOps
```powershell
bun run devops gate
```
