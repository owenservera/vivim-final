# Tasks: LLM-Driven Provider Testing & Frontend UX Refinement

## Phase 1: Provider Test Pipeline Automation (US1)

**Story**: LLM drives the 8-phase pipeline for gemini, chatgpt, claude
**Test criteria**: Each phase outputs structured JSON with pass/fail; full pipeline completes without manual intervention

### T001 — Launch backend + frontend + preflight
- [ ] T001 Launch stack: `pwsh scripts/start-all.ps1`
- [ ] T002 Verify health: `bun run devops runtime-test health`
- [ ] T003 Preflight: `bun run devops agentic preflight`
- [ ] T004 Check provider profiles exist: `bun run devops runtime-test status --provider=gemini`, `--provider=chatgpt`, `--provider=claude`

### T005-T012 — Gemini 8-phase pipeline
- [ ] T005 Discover protocol: `bun run devops discover-protocol https://gemini.google.com/app --hint=gemini`
- [ ] T006 Infer parser: `bun run devops runtime-test onboard infer --provider=gemini`
- [ ] T007 Test selectors: `bun run devops runtime-test onboard test-selectors --provider=gemini`
- [ ] T008 Test parse: `bun run devops runtime-test onboard test-parse --provider=gemini`
- [ ] T009 Test cap: `bun run devops runtime-test onboard test-cap --provider=gemini`
- [ ] T010 Test frontend: `bun run devops runtime-test onboard test-frontend --provider=gemini`
- [ ] T011 Verify: `bun run devops runtime-test onboard verify --provider=gemini`
- [ ] T012 Converge: `bun run devops runtime-test onboard converge --provider=gemini`
- [ ] T012b Record UI test: `bun run devops ui-test record --provider=gemini --cap=send_message --result=pass`

### T013-T020 — ChatGPT 8-phase pipeline
- [ ] T013 Discover protocol: `bun run devops discover-protocol https://chatgpt.com --hint=chatgpt`
- [ ] T014 Infer parser: `bun run devops runtime-test onboard infer --provider=chatgpt`
- [ ] T015 Test selectors: `bun run devops runtime-test onboard test-selectors --provider=chatgpt`
- [ ] T016 Test parse: `bun run devops runtime-test onboard test-parse --provider=chatgpt`
- [ ] T017 Test cap: `bun run devops runtime-test onboard test-cap --provider=chatgpt`
- [ ] T018 Test frontend: `bun run devops runtime-test onboard test-frontend --provider=chatgpt`
- [ ] T019 Verify: `bun run devops runtime-test onboard verify --provider=chatgpt`
- [ ] T020 Converge: `bun run devops runtime-test onboard converge --provider=chatgpt`
- [ ] T020b Record UI test: `bun run devops ui-test record --provider=chatgpt --cap=send_message --result=pass`

### T021-T028 — Claude 8-phase pipeline
- [ ] T021 Discover protocol: `bun run devops discover-protocol https://claude.ai --hint=claude`
- [ ] T022 Infer parser: `bun run devops runtime-test onboard infer --provider=claude`
- [ ] T023 Test selectors: `bun run devops runtime-test onboard test-selectors --provider=claude`
- [ ] T024 Test parse: `bun run devops runtime-test onboard test-parse --provider=claude`
- [ ] T025 Test cap: `bun run devops runtime-test onboard test-cap --provider=claude`
- [ ] T026 Test frontend: `bun run devops runtime-test onboard test-frontend --provider=claude`
- [ ] T027 Verify: `bun run devops runtime-test onboard verify --provider=claude`
- [ ] T028 Converge: `bun run devops runtime-test onboard converge --provider=claude`
- [ ] T028b Record UI test: `bun run devops ui-test record --provider=claude --cap=send_message --result=pass`

## Phase 2: Setup Wizard Testing (US2)

**Story**: LLM tests first-run setup wizard end-to-end
**Test criteria**: All wizard steps render and function; error states handled; completion transitions to chat

### T029 — Discover setup wizard flow
- [ ] T029 Navigate to `localhost:5173` with empty DB state using Playwright
- [ ] T030 Identify wizard entry point (slot `chat.entry` resolution)
- [ ] T031 Take screenshot of wizard step 1 (provider selection)
- [ ] T032 Step through provider selection → profile creation → account auth
- [ ] T033 Take screenshot of each wizard step
- [ ] T034 Verify error states (network timeout, invalid URL, auth failure) — each produces correct UI
- [ ] T035 Verify completion transitions to `CanvasSurface` or `ChatPage`
- [ ] T036 Capture all console errors during wizard flow
- [ ] T037 Record: `bun run devops ui-test record --provider=all --cap=setup-wizard --result=pass`

## Phase 3: Frontend UI De-Clobber (US3)

**Story**: Clean up frontend visual hierarchy, slot resolution, CSS variable usage
**Test criteria**: No if(slug) branches, all slots resolved, CSS variables used, consistent layout

### T038 — Slot audit
- [ ] T038 [P] Run slot audit: `bun run devops ui-test audit-slots` — identify all gaps
- [ ] T039 [P] Fix unresolved slots in `web/ui/src/ui/slots.ts`
- [ ] T040 [P] Add missing defaults in `web/ui/src/ui/defaults/`
- [ ] T041 [P] Register defaults in `web/ui/src/ui/defaults/index.ts`

### T042 — Remove if(slug) branches
- [ ] T042 [P] Search for `if (slug ===` across `web/ui/src/` — replace with slot resolution
- [ ] T043 [P] Search for `if (provider ===` — replace with provider-agnostic patterns
- [ ] T044 Verify: `bun run devops verify-cross-surface` passes with 0 gaps

### T045 — CSS variable standardization
- [ ] T045 [P] Audit all components for hardcoded color values
- [ ] T046 [P] Replace with `var(--bg)`, `var(--text)`, `var(--border)`, `var(--accent)`
- [ ] T047 [P] Verify frontend build: `cd web/ui && bun run build`

### T048 — Layout grid consistency
- [ ] T048 [P] Audit layout structure — sidebar, main, overlay regions
- [ ] T049 [P] Fix absolute positioning leaks, ensure grid alignment
- [ ] T050 [P] Test responsive behavior at 3 breakpoints

### T051 — Loading/error/empty states
- [ ] T051 [P] Add loading state to all data-driven components
- [ ] T052 [P] Add error state to all fetch-dependent components
- [ ] T053 [P] Add empty state to all list components
- [ ] T054 [P] Verify all states render correctly

### T055 — Typecheck + lint + build pass
- [ ] T055 Run: `cd web/ui && bun run typecheck` — 0 errors
- [ ] T056 Run: `cd web/ui && bun run build` — 0 errors
- [ ] T057 Run: `bun run lint` — 0 warnings

## Phase 4: Streaming Verification (US4)

**Story**: Streaming text renders progressively for all 3 providers
**Test criteria**: Incremental text, cursor indicator, no console errors, completion state correct

### T058 — Gemini streaming check
- [ ] T058 Send message to gemini via `POST /api/interpret` with NL
- [ ] T059 Capture screenshots at 500ms intervals during streaming (3 frames)
- [ ] T060 Verify text appears incrementally (LLM inspects screenshots)
- [ ] T061 Verify cursor/indicator shows during streaming
- [ ] T062 Capture console errors during streaming

### T063 — ChatGPT streaming check
- [ ] T063 Send message to chatgpt
- [ ] T064 Capture streaming screenshots at 500ms intervals
- [ ] T065 Verify incremental text rendering
- [ ] T066 Capture console errors

### T067 — Claude streaming check
- [ ] T067 Send message to claude
- [ ] T068 Capture streaming screenshots at 500ms intervals
- [ ] T069 Verify incremental text rendering
- [ ] T070 Capture console errors

## Phase 5: Cross-Cutting Verification

**Story**: All gates pass, parity confirmed, tests recorded
**Test criteria**: Full gate suite passes

### T071 — Full gate
- [ ] T071 Run: `bun run devops gate`
- [ ] T072 Run: `bun run devops verify-cross-surface` — 0 parity gaps
- [ ] T073 Run: `bun run devops invariants check` — 0 blocks
- [ ] T074 Run: `bun run devops audit-code standard` — fix any P0/P1 findings
- [ ] T075 Record: `bun run devops ui-test record --provider=all --cap=full-pipeline --result=pass`

## Execution Order

```
Phase 1 (T001-T028) → Phase 3/4 parallel (T038-T070) → Phase 2 (T029-T037) → Phase 5 (T071-T075)
```

Phase 3 and 4 can run in parallel since frontend cleanup and LLM tests are independent.
Phase 2 depends on Phase 3 (clean UI for wizard screenshots).

## Parallel Opportunities
- T038-T054 (frontend slot/color/layout fixes) can be parallelized — different files
- T058-T070 (streaming tests) can be parallelized per provider — independent sessions
- T029-T037 (wizard) depends on T054 (clean UI first) — sequential

## MVP Scope
Phase 1 (provider pipeline) is the highest priority. If time is short, do T001-T028 first,
then T071-T075. Frontend de-clobber can be a follow-up pass.
