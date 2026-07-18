# Tasks: Conversation Resilience

**Feature**: `007-conversation-resilience` · **Plan**: [plan.md](./plan.md) · **Spec**: [spec.md](./spec.md)

Phased breakdown. Format: `- [ ] T### [P?] [US#?] Description` — `P` = parallelizable, `US#` = user story.
Per-unit gates: `bun run typecheck`, `bun test tests/unit/engines/<x>`, `bun run lint`.
Per-phase gates: `bun run devops invariants check --category B`, `bun run devops audit-code standard`.
Final: `bun test`, `bun run devops verify-cross-surface`.

> Status: backend fully implemented + tested (9 passing integration tests). Frontend slot
> implemented; frontend tree has PRE-EXISTING type errors unrelated to 007 (CanvasSurface,
> HitlGateProps, deleteRef) — these are not introduced by this feature.

## Phase 0 — Setup

- [X] T001 Create `src/engines/send-resilience.ts` skeleton exporting `SendResilienceEngine` and `RecoveryKind` union; add barrel export in `src/index.ts`.
- [X] T002 Add `SendResilienceError extends EngineError` to `src/errors.ts` with `recoveryKind`, `providerId`, `retryAfterMs`, `autoReconnectAttempted`, `defaultMessage` fields.

## Phase 1 — Foundational (blocking, no UI yet)

- [X] T010 [P] [US1] Implement `preflight()` in `SendResilienceEngine`: liveness via `governor.getAllHealth`, CDP via `governor.isConnected?`, session via `health.getHealth(providerId).signals` (`session_expiry`). Return `SendPreflightResult`.
- [X] T011 [P] [US1] Implement error mapping rules (contract table) classifying thrown `EngineError` → `RecoveryKind` (`circuit_open` / `cdp_down` / `chrome_crash` / `session_expired` / `unknown`).
- [X] T012 [P] [US1] [US3] Implement `sendResilient()`: run preflight; on failure throw `SendResilienceError`; on send `EngineError` map + throw with correct `recoveryKind` and `retryAfterMs` for circuit-open.
- [X] T013 [US1] [US2] Implement FR-005 auto-reconnect: on `chrome_crash`/`cdp_down`, exactly one `ensureConnected`/`launch` attempt within `reconnectBudgetMs` (default 5000), then transparent resend; on 2nd failure throw with `autoReconnectAttempted: true`.
- [X] T014 [US2] Implement `recover('relogin')`: call `wizard.needsSetup` + launch visible via existing setup path; return once wizard launches (login is interactive).
- [X] T015 [US1] Implement `recover('retry')`: `ensureConnected`/`launch` + resend `lastMessage` from `SendInput`; return `SendOutput`.

## Phase 2 — User Story 1: Chrome Crash During Send

- [X] T020 [US1] Write `tests/unit/engines/send-resilience.preflight.test.ts`: liveness/CDP/session gate cases.
- [X] T021 [US1] Write `tests/integration/engines/send-resilience.test.ts`: mock `SendResilienceDeps`; slave `stopped` → ONE silent relaunch → resend succeeds; 2nd failure → `SendResilienceError` `chrome_crash` `autoReconnectAttempted:true`.
- [X] T022 [US1] Gate: `bun run typecheck`, `bun test tests/unit/engines/send-resilience*`, `bun run lint`, `bun run devops invariants check --category B`.

## Phase 3 — User Story 2: Session Expired Mid-Conversation

- [X] T030 [US2] Wire `session-caps.ts` send path through `SendResilienceEngine.sendResilient` (wrap the existing send fn from deps).
- [X] T031 [US2] Write `tests/integration/engines/send-resilience.test.ts`: `session_expiry` signal `0` → `SendResilienceError` `session_expired`; `recover('relogin')` invokes wizard.
- [X] T032 [US2] Gate: `bun run typecheck`, `bun test tests/unit/engines/send-resilience*`, `bun run lint`.

## Phase 4 — User Story 3: Circuit Breaker Open

- [X] T040 [US3] Write integration case: `governor.cdp.send` throws `EngineError('Circuit breaker open …')` → `recoveryKind:'circuit_open'` with `retryAfterMs` from `FleetConfig.circuitBreakerResetMs`.
- [X] T041 [US3] Gate: `bun run typecheck`, `bun test tests/unit/engines/send-resilience*`, `bun run lint`.

## Phase 5 — Frontend Slot (FR-006)

- [X] T050 [US1] [US2] [US3] Create `web/ui/src/features/chat/SendErrorSlot.tsx`: renders `ResilienceSlotPayload` (message + actions `retry`/`relogin` + optional countdown), exhaustive `switch` on `RecoveryKind` with `never` guard.
- [X] T051 [US1] [US2] [US3] Wire composer to catch `SendResilienceError` → resolve slot message from `UiComponent` tier (fallback `defaultMessage`); Retry calls `recover('retry')`, Re-login calls `recover('relogin')`.
- [X] T052 [US1] [US2] [US3] Add `UiComponent` tier(s) in `seeds/conceptual-model/seed.ts` for the three recovery strings (FR-006) so strings are DB-backed, not hardcoded; include fallback defaults in code.
- [ ] T053 [US1] [US2] [US3] Write `tests/unit`/component test for `SendErrorSlot` covering all four `RecoveryKind`s and the no-tier fallback path.

## Phase 6 — Polish

- [X] T060 Run `bun test` (full suite) — no regressions on the happy path (Scenario D).
- [X] T061 Run `bun run devops invariants check --category B` and `bun run devops audit-code standard`.
- [X] T062 Run `bun run devops verify-cross-surface` (new recovery capability surfaces resolve across CLI/API/MCP/UI).
- [ ] T063 Manual E2E via `pwsh scripts/start-bg.ps1`: execute quickstart Scenarios A, B, C, D in the UI; confirm no raw stack trace (SC-003) and one-click recovery path exists (SC-001).
