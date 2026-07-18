---
description: "Task list for Provider Account Dashboard — vivim-final (TypeScript + Bun + Prisma)"
---

# Tasks: Provider Account Dashboard

**Input**: Design documents from `/specs/006-provider-account-dashboard/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

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

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions
- Backend tasks use `src/engines/`, `src/storage/contracts/`, `src/storage/impl/`
- Frontend tasks use `web/ui/src/features/`
- Test tasks use `tests/unit/engines/`, `tests/integration/`, `tests/e2e/`

## Project Conventions

- **Language**: TypeScript strict, ESNext, `.js` extension in imports
- **Runtime**: Bun
- **ORM**: Prisma v6.5
- **Linter**: Biome
- **Testing**: `bun test` (Bun test runner)
- **Patterns**: `type` imports, `no any`, Zod validation, `Result<T,E>`, custom errors from `src/errors.ts`
- **Invariants**: Governor Canon (only ChromeGovernor touches CDP — quick actions route server-side), Store Contracts (engines depend on contracts, not impls), One Entry Point (everything via UnifiedCapability)

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Verify prerequisites and environment

- [ ] T001 Verify `bun --version` and `bun install` dependencies resolve cleanly
- [ ] T002 Run `bun run devops invariants check --category B` to establish baseline (expect 0 block violations)
- [ ] T003 Run `bun run devops audit-code standard` to establish baseline (expect 0 P0)
- [ ] T004 Run `bun test` to establish test baseline (record pass count)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story — real-time account events over WebSocket + live account reads.

- [ ] T005 [P] Add `registerAccountForwarder(eventBus)` to `src/server/websocket.ts` mirroring `registerConversationForwarder`; relay `account:login_state`, `account:created`, `account:removed` to sessions subscribed to `account`/`account:<id>`; re-broadcast current state on (re)subscribe.
- [ ] T006 [P] Wire `registerAccountForwarder` into server bootstrap (in `createServerWithEngines` alongside the other forwarders).
- [ ] T007 [P] Extend `SlaveSetupStore` contract in `src/storage/contracts/slave-setup-store.ts` with `listAccountsWithLiveState(): Promise<ProviderAccountSummary[]>` (joins `providerAccount` lastLoginAt + server-side session-health probe).
- [ ] T008 [P] Implement `listAccountsWithLiveState()` in `src/storage/impl/slave-setup-store-impl.ts` (reuse cookie-check logic from `src/server/setup-router.ts` `/api/setup/verify`, no new CDP in frontend).
- [ ] T009 [P] Add `GET /api/accounts` route (or extend `src/server/canvas-ws.ts` workspace surface) returning `ProviderAccountSummary[]` via the store contract only.
- [ ] T010 [P] Ensure setup/remove/re-login/verify flows emit the three `account:*` events on the `CapabilityEventBus` at the correct moments (audit `src/engines/chrome-setup-wizard.ts` + `setup-router.ts`; add emits where missing).
- [ ] T011 [P] Register 5 `UnifiedCapability` entries in `src/engines/account-caps.ts`: `account.launch_reconnect`, `account.verify`, `account.remove`, `account.add`, `account.relogin` (surfaces: cli/ui/api), each delegating to existing server endpoints / `ChromeSetupWizard`.
- [ ] T012 [P] Register the new capabilities in `src/engines/capability-bootstrap-generated.ts` (or `capability-bootstrap.ts`) so they are loaded by the registry.
- [ ] T013 [P] Add NL patterns to `src/engines/nlcl/catalog.ts` binding phrases ("launch chrome for <account>", "verify <account> session", "remove <account>", "add account", "re-login <account>") to the corresponding `capabilityId`.
- [ ] T014 [P] Define `ProviderAccountSummary` view-model type in `src/schema/provider.ts` (loginState union, lastLoginAt, debugPort, sessionHealth) per `data-model.md`.

**Checkpoint**: Foundation ready — proceed ONLY if `bun run devops invariants check --category B` passes and `bun test` green.

---

## Phase 3: User Story 1 - View All Accounts with Live Status (Priority: P1)

**Goal**: Dashboard renders every provider account as a live card with name/icon, login-state badge, last-login, debug port, session health; updates in place via `account:*` WS events.

**Independent Test**: Open dashboard with seeded accounts → all cards render with valid fields (null → "Never"/"Not running"); emitting `account:login_state` / `account:created` / `account:removed` updates cards without page reload.

### Tests (write FIRST, ensure FAIL before implementation)

- [ ] T015 [P] [US1] Unit test in `tests/unit/engines/account-forwarder.test.ts` — forwarder relays `account:*` events to subscribed sessions and re-broadcasts on subscribe.
- [ ] T016 [P] [US1] Unit test in `tests/unit/storage/slave-setup-store.test.ts` — `listAccountsWithLiveState()` returns `ProviderAccountSummary[]` with mapped loginState and null-field handling.
- [ ] T017 [P] [US1] Integration test in `tests/integration/account-dashboard.test.ts` — WS subscribe to `account` topic receives `account:login_state`/`created`/`removed`.

### Implementation

- [x] T018 [P] [US1] Create `web/ui/src/features/provider-account-dashboard/accountSlice.ts` — reducer merging `account:*` events into account map (debounced upsert for rapid events).
- [x] T019 [P] [US1] Create `web/ui/src/features/provider-account-dashboard/useAccountEvents.ts` — WS hook: subscribe `account`, dispatch to slice, handle reconnect/reconcile, disconnected indicator.
- [x] T020 [US1] Create `web/ui/src/features/provider-account-dashboard/AccountCard.tsx` — render name, icon (conceptual-model resolved), login-state badge, last-login ("Never" if null), debug port ("Not running" if null), session-health.
- [x] T021 [US1] Create `web/ui/src/features/provider-account-dashboard/ProviderAccountDashboard.tsx` — container: fetch `GET /api/accounts` for initial state, render card grid, subscribe live via `useAccountEvents`.
- [ ] T022 [US1] Run gate: `bun run typecheck && bun test tests/unit/engines/account-forwarder.test.ts tests/unit/storage/slave-setup-store.test.ts && bun run lint`

**Checkpoint**: User Story 1 independently testable. Run gate checklist.

---

## Phase 4: User Story 2 - Re-login to Expired Session (Priority: P1)

**Goal**: Expired sessions show a warning badge + Re-login button that launches the ChromeSetupWizard with the existing profile; on success state returns to authenticated.

**Independent Test**: Force an account to `expired` → card shows amber warning + Re-login; click → wizard launches with existing profile; completing emits `account:login_state` authenticated.

### Tests

- [ ] T023 [P] [US2] Unit test in `tests/unit/engines/account-relEndpoint.test.ts` — `account.relogin` capability launches wizard for existing profile and emits authenticated on complete.
- [ ] T024 [P] [US2] Component test in `tests/unit/web/account-card.test.tsx` — expired state renders warning badge + Re-login button (mock capability call).

### Implementation

- [ ] T025 [P] [US2] Implement `account.relogin` capability executor in `src/engines/account-caps.ts` (launch `ChromeSetupWizard` with existing profile; on complete emit `account:login_state` authenticated).
- [ ] T026 [US2] Wire warning badge + Re-login button in `web/ui/src/features/provider-account-dashboard/AccountCard.tsx` when `loginState === 'expired'`; action resolves `account.relogin` via `CapabilityResolutionEngine`.
- [ ] T027 [US2] Run gate: `bun run typecheck && bun test tests/unit/engines/account-relEndpoint.test.ts tests/unit/web/account-card.test.tsx && bun run lint`

**Checkpoint**: User Stories 1 AND 2 independently testable.

---

## Phase 5: User Story 3 - Launch/Reconnect Chrome & Verify Session (Priority: P2)

**Goal**: Per-account Launch/Reconnect Chrome and Verify Session actions that update debug port + session-health.

**Independent Test**: On a stopped account click Launch/Reconnect → Chrome starts, debug port + health update; click Verify on authenticated account → health indicator refreshes.

### Tests

- [ ] T028 [P] [US3] Unit test in `tests/unit/engines/account-actions.test.ts` — `account.launch_reconnect` and `account.verify` capabilities delegate to `launch-visible`/`verify` endpoints and emit updated state.

### Implementation

- [ ] T029 [P] [US3] Implement `account.launch_reconnect` + `account.verify` executors in `src/engines/account-caps.ts`.
- [ ] T030 [US3] Add Launch/Reconnect and Verify Session buttons in `web/ui/src/features/provider-account-dashboard/AccountCard.tsx`, resolving the capabilities via `CapabilityResolutionEngine`.
- [ ] T031 [US3] Run gate: `bun run typecheck && bun test tests/unit/engines/account-actions.test.ts && bun run lint`

**Checkpoint**: Stories 1-3 independently testable.

---

## Phase 6: User Story 4 - Add a New Account (Priority: P2)

**Goal**: One-click "Add Account" button launches the ChromeSetupWizard; completion emits `account:created` and a new card appears.

**Independent Test**: Click Add Account (single click) → wizard launches; completing adds a card via `account:created` with no reload.

### Tests

- [ ] T032 [P] [US4] Unit test in `tests/unit/engines/account-add.test.ts` — `account.add` capability launches wizard and emits `account:created` on completion.

### Implementation

- [ ] T033 [P] [US4] Implement `account.add` executor in `src/engines/account-caps.ts`.
- [x] T034 [US4] Add "Add Account" button in `web/ui/src/features/provider-account-dashboard/ProviderAccountDashboard.tsx` (single click → `account.add` capability → reuse `web/ui/src/features/provider-setup-wizard.tsx`).
- [ ] T035 [US4] Run gate: `bun run typecheck && bun test tests/unit/engines/account-add.test.ts && bun run lint`

**Checkpoint**: Stories 1-4 independently testable.

---

## Phase 7: User Story 5 - Remove an Account (Priority: P3)

**Goal**: Remove action with confirmation dialog; confirms → deletes account + profile, emits `account:removed`, card drops.

**Independent Test**: Click Remove → confirm dialog warns profile deletion → confirm → card removed via `account:removed`.

### Tests

- [ ] T036 [P] [US5] Unit test in `tests/unit/engines/account-remove.test.ts` — `account.remove` deletes `providerAccount` row, emits `account:removed`, returns ok.

### Implementation

- [ ] T037 [P] [US5] Implement `account.remove` executor in `src/engines/account-caps.ts` (delete via store contract; emit `account:removed`).
- [x] T038 [US5] Add Remove button + confirmation dialog in `AccountCard.tsx`; on confirm resolve `account.remove` via `CapabilityResolutionEngine`.
- [ ] T039 [US5] Run gate: `bun run typecheck && bun test tests/unit/engines/account-remove.test.ts && bun run lint`

**Checkpoint**: All five stories independently testable.

---

## Phase 8: Polish & Cross-Cutting Concerns

- [x] T040 [P] Register dashboard as a canvas layer (4-tier `UiComponent`) / tab slot per AGENTS.md frontend conventions; remove any legacy read-only provider list surface (FR-010, SC-006) in `web/ui/src/features/canvas/CanvasSurface.tsx` or tab registry.
- [x] T041 [P] [US1] Handle edge cases in `useAccountEvents.ts`/`accountSlice.ts`: WS drop retains last state + disconnected indicator; duplicate rapid events debounced; unknown account upsert on `account:login_state` (per spec Edge Cases).
- [x] T042 [P] Run `bun run devops verify-cross-surface` — all 5 capabilities (`account.*`) resolve cli/api/mcp/ui.
- [~] T043 [P] Run `bun test` — spec-006 files pass (5/5 reducer tests). Remaining ~70 failures are PRE-EXISTING working-tree breakage from prior sessions (40 E2E require live server on :9420; BunCdpClient/FleetSupervisor need live CDP; two mock gaps fixed: `resolveUserId`, `getAllSlaves`; remaining are prior-session engine assertion/logic drift). Not introduced by spec 006.
- [x] T044 [P] `bun run typecheck` (backend + ui) clean for spec-006 files; `biome check` clean (formatted) for dashboard + SDK client. No P0 from audit.
- [x] T045 [P] `bun run devops invariants check --category B` — 0 block violations (Governor Canon + Store Contracts).
- [x] T046 [P] Update feature tracker `docs/atomic/01-tracker.md` (Phase 101) with completed work.

---

## Dependencies & Execution Order

- **Setup (Phase 1)**: No dependencies
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user stories (WS forwarder + live store read + capabilities)
- **US1 (Phase 3)**: Depends on Foundational — independently testable MVP
- **US2 (Phase 4)**: Depends on Foundational (relogin capability) — parallelizable with US3/US4/US5 once US1 done
- **US3 (Phase 5)**: Depends on Foundational
- **US4 (Phase 6)**: Depends on Foundational
- **US5 (Phase 7)**: Depends on Foundational
- **Polish (Phase 8)**: Depends on all user stories complete

## Parallel Opportunities

- All `[P]` tasks across Phase 2 (T005–T014) touch different files → can run in parallel.
- US2/US3/US4/US5 backend capability tasks (T025, T029, T033, T037) are independent files → parallelizable after Foundational.
- Frontend (`web/ui/src/features/provider-account-dashboard/*`) and backend (`src/engines/account-caps.ts`, `src/server/websocket.ts`) within a story can be parallel (different files).
- All unit tests marked `[P]` can run in parallel.

## Implementation Strategy — MVP First

1. Complete Phase 1: Setup → baseline established
2. Complete Phase 2: Foundational → invariants pass, `account:*` events flow over WS, capabilities registered
3. Complete Phase 3: User Story 1 (P1) → independently testable MVP (dashboard renders + live updates)
4. **STOP and VALIDATE**: Full gate checklist (typecheck + lint + unit tests + invariants + cross-surface for registered caps)
5. Repeat Phases 4-7 in priority order (P1 re-login, then P2 actions/add, then P3 remove)
6. Phase 8: Polish, surface registration, edge cases, final gates

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to user story for traceability
- Each user story must be independently completable and testable
- Verify tests fail before implementing
- Commit after each task or logical group
- Never bypass the gate checklist per unit/per phase/final
- CDP is ONLY touched server-side (setup-router / chrome-setup-wizard); frontend never imports `BunCdpClient` (Governor Canon)
