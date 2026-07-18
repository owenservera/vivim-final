# Tasks: First-Run Onboarding

**Input**: `specs/005-first-run-onboarding/plan.md`  
**Prerequisites**: plan.md ✅ | spec.md ✅ | research.md ✅ | data-model.md ✅ | quickstart.md ✅

## Format: `[ID] [P?] [Story] Description`

## Phase 1: First-Run Detection (US1)

- [ ] T001 [P] [US1] Create `web/ui/src/features/canvas/useFirstRun.ts` — hook checking provider count + localStorage
- [ ] T002 [US1] Update app entry to conditionally show FirstRunWizard vs canvas based on useFirstRun()

## Phase 2: Feature Tour (US3)

- [ ] T003 [P] [US3] Create `web/ui/src/features/canvas/FeatureTour.tsx` — 3-step overlay with localStorage
- [ ] T004 [US3] Wire FeatureTour to show after wizard completion (stored `vivim.tour_complete`)

## Phase 3: Provider Install Wiring (US1)

- [ ] T005 [US1] Update FirstRunWizard provider step to use existing provider-setup-wizard flow instead of `POST /api/plugins/install`
- [ ] T006 [US1] Set `vivim.onboarding_complete` on wizard done step

## Phase 4: Gate

- [ ] T007 Run `bun run typecheck` on new files
- [ ] T008 Run `bun run devops verify-cross-surface`
