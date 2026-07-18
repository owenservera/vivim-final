# Tasks: Production Hardening & Sovereign Trust

**Input**: Design documents from `specs/001-production-hardening/`
**Prerequisites**: plan.md ✅ | spec.md ✅ | research.md ✅ | data-model.md ✅ | contracts/ ✅ | quickstart.md ✅

**Gate (per unit)**:
```powershell
bun run typecheck              # 0 errors in touched files
bun test tests/unit/<path>     # unit tests pass
bun run lint                   # 0 new warnings
```

**Gate (per phase)**:
```powershell
bun run devops invariants check --category B  # 0 block violations
bun run devops audit-code standard             # 0 P0
```

**Gate (final)**:
```powershell
bun test                                      # all tests pass
bun run devops verify-cross-surface           # all caps resolve
```

---

## Phase 1: Baseline Verification

**Purpose**: Establish current state — what's actually broken vs already fixed.

- [ ] T001 [P] Run `bun run devops invariants check --category B` to get current B1/B7 violation list
- [ ] T002 [P] Run `bun run devops audit-code standard` to get current P0 findings

---

## Phase 2: Fix Remaining P0 Violations

**Purpose**: If any B7 (raw Error) or P0 audit findings remain, fix them.

- [ ] T003 Fix remaining B7 raw `new Error()` calls in engine files — replace with typed errors from `src/errors.ts`
- [ ] T004 Fix any P0 audit findings from `bun run devops audit-code standard`
- [ ] T005 Re-run `bun run devops invariants check --category B` — verify 0 violations
- [ ] T006 Re-run `bun run devops audit-code standard` — verify 0 P0

---

## Phase 3: ConsentEngine & TrustScoreEngine — Unit Tests (Primary Gap)

**Purpose**: The engines exist but lack unit tests. Write test files.

### Tests for ConsentEngine

- [ ] T007 [US2] Create `tests/unit/engines/consent-engine.test.ts` — test all ConsentEngine methods:
  - `check()` denies `financial` when threshold is `write`
  - `grant()` + `check()` allows previously-denied operation
  - `revoke()` + `check()` denies after revocation
  - `isAllowed('read')` returns true with default config
  - `require()` throws `ConsentViolationError` when denied

### Tests for TrustScoreEngine

- [ ] T008 [US2] Create `tests/unit/engines/trust-score.test.ts` — test TrustScoreEngine with mocked DB:
  - Perfect provider (all successes) → score ≥ 90
  - Failing provider (all failures) → score ≤ 20
  - Mixed provider → score between 30-70

---

## Phase 4: Verification & CHANGELOG

**Purpose**: Verify all existing wiring works, correct documentation.

- [ ] T009 [US1] Run `bun run devops verify-cross-surface` — all 50 capabilities must resolve
- [ ] T010 [US3] Run `bun test tests/e2e/smoke.test.ts` — verify smoke test passes
- [ ] T011 Correct `CHANGELOG.md` Phase 31 entries to reflect actual implementation state (ConsentEngine ✅, TrustScoreEngine ✅)

---

## Phase 5: Final Gate

**Purpose**: Full gate checklist — all must pass.

- [ ] T012 Run `bun run typecheck` — 0 errors
- [ ] T013 Run `bun run lint` — 0 warnings
- [ ] T014 Run `bun test` — full suite passes
- [ ] T015 Run `bun run devops invariants check --category B` — 0 violations
- [ ] T016 Run `bun run devops audit-code standard` — 0 P0
- [ ] T017 Run `bun run devops verify-cross-surface` — all caps resolve

---

## Dependencies & Execution Order

```
Phase 1 (T001-T002)  →  Baseline
    ↓
Phase 2 (T003-T006)  →  Only needed if baseline finds violations
    ↓
Phase 3 (T007-T008)  →  Unit tests (primary new work)
    ↓
Phase 4 (T009-T011)  →  Verification + CHANGELOG
    ↓
Phase 5 (T012-T017)  →  Final gate
```

## Parallel Opportunities

- T001 + T002 can run simultaneously
- T003 + T004 can run simultaneously (different files)
- T007 + T008 can run simultaneously (different test files)
- T012 + T013 can run simultaneously

## Notes

- Research confirmed ConsentEngine and TrustScoreEngine already exist — focus on tests
- Consent gate wiring already done in capability-bootstrap.ts (lines 1245-1277)
- Trust score already 8th signal in provider-health.ts (SIGNAL_WEIGHTS.trustScore: 10)
- HITL gate UI already exists at web/sandbox/src/features/hitl-gate.tsx
- Smoke test already exists at tests/e2e/smoke.test.ts
