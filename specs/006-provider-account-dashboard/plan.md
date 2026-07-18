# Implementation Plan: Provider Account Dashboard

**Branch**: `006-provider-account-dashboard` | **Date**: 2025-07-17
**Spec**: [spec.md](./spec.md)

## Summary

Build an interactive, real-time provider account dashboard that replaces the legacy read-only provider list. Each configured account (from the existing `providerAccount` table) renders as a live card showing provider name/icon, login state (authenticated / expired / never-logged-in), last login timestamp, Chrome debug port, and session health, with quick actions (launch/reconnect Chrome, verify session, remove account, re-login). Live updates arrive over the existing WebSocket transport via `account:login_state`, `account:created`, and `account:removed` events. A one-click "Add Account" button launches the existing ChromeSetupWizard.

The work is **frontend-first with one small backend gap**: the `account:*` events are defined on the `CapabilityEventBus` but are not yet forwarded to WebSocket frontends. The plan adds a forwarder (mirroring the existing conversation/canvas forwarders), exposes account reads through the store contract, and wires the dashboard as a canvas layer / workspace surface driven by `UiComponent` tiers — all while honoring the constitution (no direct CDP in frontend, all actions as `UnifiedCapability`, store-contract-only data access).

## Technical Context

**Language/Version**: TypeScript 5.x (strict, ESNext) / Bun runtime
**Primary Dependencies**: Bun, Prisma v6.5, Zod, React 18, React Flow
**Storage**: SQLite via Prisma (`dev.db`); `providerAccount` table already exists
**Testing**: Bun test runner (`bun test`)
**Target Platform**: Windows (PowerShell 7+), Bun HTTP server
**Project Type**: Full-stack monorepo (backend engines + API + React Flow canvas frontend)
**Linter/Formatter**: Biome
**Build**: tsup (ESM + DTS)

**Performance Goals**:
- Dashboard paints all accounts within 1s of open (SC-001)
- WS-driven status change reflected on card within 200ms (SC-002)

**Constraints** (from constitution):
- Governor Canon: frontend NEVER touches CDP; Chrome launch/verify/re-login happen server-side (`setup-router.ts` / `chrome-setup-wizard.ts`).
- Store Contracts: account reads go through `SlaveSetupStore` / a store contract, never `ctx.db.prisma.providerAccount` directly in engines.
- One Entry Point: every quick action is a `UnifiedCapability` (capability → API → execute), surfaced on CLI/UI/API.
- Capability-driven frontend: dashboard actions resolve through `CapabilityResolutionEngine`, not hardcoded `if (slug)` handlers.

## Constitution Check

*GATE: Must pass before implementation. Re-check after design.*

- [x] **Governor Canon**: No frontend/engine imports `BunCdpClient`. CDP only in `setup-router.ts` / `chrome-setup-wizard.ts` (server-side, already compliant). New forwarder only relays events.
- [x] **Store Contracts**: Account list/state read via `SlaveSetupStore.listAccounts()` (contract already exists). New UI read path added as a store-contract method, not raw Prisma in UI.
- [x] **One Entry Point**: Quick actions (launch/reconnect, verify, remove, add, re-login) registered as `UnifiedCapability` entries + NL patterns in `catalog.ts`.
- [x] **Custom errors**: No raw `new Error()` in new engines/stores; use `src/errors.ts`.
- [x] **TypeScript strict**: No `any`, `type` imports, `.js` extensions in new files.
- [x] **Tests**: Unit + integration + typecheck + lint gates, plus cross-surface verification.

## Project Structure

### Documentation (this feature)

```text
specs/006-provider-account-dashboard/
├── plan.md              # This file
├── research.md          # Phase 0 output (below)
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # WS event + capability contracts
└── tasks.md             # Phase 2 output
```

### Source Code touched

```text
src/
├── engines/capability-event-bus.ts     # account:* event types already defined
├── server/websocket.ts                 # ADD registerAccountForwarder (ws bridge)
├── server/setup-router.ts              # existing CDP launch/verify/complete (reuse)
├── server/canvas-ws.ts                 # workspace surface already returns profiles
├── storage/contracts/slave-setup-store.ts   # ADD listAccountsWithLiveState()
├── storage/impl/slave-setup-store-impl.ts   # implement
├── engines/*caps.ts                    # register account capabilities (One Entry Point)
├── engines/nlcl/catalog.ts             # NL patterns -> capabilityId
└── index.ts                            # barrel exports

web/ui/src/
├── features/canvas/CanvasSurface.tsx   # primary surface (render dashboard layer)
├── features/provider-account-dashboard/  # NEW dashboard feature module
│   ├── ProviderAccountDashboard.tsx    # container + WS subscription
│   ├── AccountCard.tsx                 # per-account card
│   ├── useAccountEvents.ts             # WS hook (account:*)
│   └── accountSlice.ts                 # reducer for live state
└── features/provider-setup-wizard.tsx  # existing; reused for Add/Re-login
```

**Structure Decision**: Reuse the existing canvas/workspace surface and `provider-setup-wizard.tsx`. No new engines; one new store-contract method and one WS forwarder. Frontend is a new `provider-account-dashboard` feature module rendered as a canvas layer (4-tier `UiComponent` resolution) and/or a tab slot.

## Phase 0: Research (resolved — no NEEDS CLARIFICATION)

- **Account event transport**: `account:login_state` / `account:created` / `account:removed` are typed on `CapabilityEventBus` (`src/engines/capability-event-bus.ts`) and whitelisted in `src/automation/scheduler.ts`. They are emitted but NOT forwarded to WebSocket frontends. Decision: add `registerAccountForwarder(eventBus)` in `websocket.ts`, mirroring `registerConversationForwarder` — frontends subscribe with `subscribe` + `topic: account` (or `account:<id>`).
- **Account data source**: `SlaveSetupStore.listAccounts(): Promise<SetupAccount[]>` already returns `{id, providerId, accountSlug, displayName, planTier, loginState, profileDir, debugPort, ...}`. Decision: extend with a `listAccountsWithLiveState()` that joins last-login + session-health from `providerAccount` plus a live Chrome liveness probe (server-side, via existing `/api/setup/verify` style check). UI reads this through the contract only.
- **Quick actions → capabilities**: Reuse server endpoints in `setup-router.ts` (`/api/setup/launch-visible`, `/api/setup/verify`, `/api/setup/complete`, `/api/setup/restore`) wrapped as `UnifiedCapability` entries. Remove = new capability calling `upsertAccount` deletion path / `prisma.providerAccount.delete`. Add/Re-login = capability that launches `ChromeSetupWizard` flow.
- **Frontend surface**: Dashboard rendered as a canvas layer (consistent with `canvas:layer:spawned`/`dismissed` pattern) AND reachable as a tab. Provider icons resolved via the existing provider-type conceptual model.
- **Reconnect vs expired**: `loginState` values already in use: `authenticated`, `expired`/`logged_out`, and never-logged-in (null/`created`). Dashboard maps these to three badge states.

## Phase 1: Design & Contracts

### data-model.md (summary)

- **ProviderAccountSummary** (view model): `accountId, providerId, providerName, providerIcon, loginState ('authenticated'|'expired'|'never_logged_in'), lastLoginAt: number|null, debugPort: number|null, sessionHealth: 'healthy'|'degraded'|'unknown'`.
- **AccountLiveEvent** (WS payloads):
  - `account:login_state` → `{ type, accountId, loginState, lastLoginAt, debugPort, sessionHealth }`
  - `account:created` → `{ type, accountId }`
  - `account:removed` → `{ type, accountId }`
- State transitions: `never_logged_in → authenticated` (setup complete) → `expired` (cookie check fails) → `authenticated` (re-login).

### contracts/

- `account-events.md`: WS subscribe contract (`{type:'subscribe', entityType:'account', entityId:'*'|accountId}`), event shapes above, reconnection reconciliation (server re-broadcasts current state on (re)subscribe).
- `account-capabilities.md`: capability contract for each quick action (input/output schema, surfaces: cli/ui/api).

### quickstart.md (summary)

1. `bun run db:setup` (seed provider accounts if empty).
2. `pwsh scripts/start-bg.ps1` → open UI, navigate to dashboard layer/tab.
3. Verify: all seeded accounts render; manually emit `account:login_state` (or expire a cookie) → card updates <200ms; click Re-login → wizard launches; click Remove → confirm dialog → `account:removed` drops card; click Add Account → wizard launches → `account:created` adds card.
4. `bun test tests/unit/engines/account` + `bun run devops verify-cross-surface`.

## Remaining Work (broken into tasks in tasks.md)

1. **Backend — WS forwarder**: add `registerAccountForwarder(eventBus)` in `websocket.ts`; wire in `createServerWithEngines`. (FR-003, SC-002)
2. **Backend — live state read**: extend `SlaveSetupStore` with `listAccountsWithLiveState()` + impl; expose via a `GET /api/accounts` (or workspace surface) route returning `ProviderAccountSummary[]`. (FR-001, FR-002)
3. **Backend — emit account events**: ensure setup/remove/re-login/verify flows `eventBus.emit` the three `account:*` events at the right moments (verify these are already emitted; add where missing). (FR-003, FR-007, FR-009)
4. **Capabilities (One Entry Point)**: register `account.launch_reconnect`, `account.verify`, `account.remove`, `account.add`, `account.relogin` capabilities in a `*caps.ts` module; add NL patterns in `catalog.ts` bound to each. (FR-004–FR-009)
5. **Frontend — dashboard module**: `ProviderAccountDashboard.tsx` + `useAccountEvents.ts` (subscribe to `account` topic, reducer merges events) + `AccountCard.tsx` (badges, actions). (FR-001, FR-002, FR-010)
6. **Frontend — actions**: wire each quick action button to its capability via `CapabilityResolutionEngine`; Add/Re-login launch `provider-setup-wizard.tsx`. Remove shows confirmation dialog. (FR-004–FR-009)
7. **Frontend — expiry UX**: warning badge + Re-login button when `loginState === 'expired'`; placeholder "Never" / "Not running" for null fields. (FR-007, SC-004, SC-005)
8. **Frontend — surface**: register as canvas layer (4-tier `UiComponent`) / tab slot; remove legacy read-only list if present. (FR-010, SC-006)
9. **Tests + gates**: unit (forwarder, reducer, store), integration (WS event → card update), `verify-cross-surface`, typecheck/lint/invariants.

## Complexity Tracking

No constitution violations. All new work routes through existing compliant mechanisms (WS forwarder pattern, store contract, capability registry). The only net-new backend code is the forwarder + one store method — both mirror existing patterns.
