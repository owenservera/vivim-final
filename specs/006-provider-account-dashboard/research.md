# Research: Provider Account Dashboard

**Feature**: 006-provider-account-dashboard
**Date**: 2025-07-17

## R1 — How do account events reach the frontend today?

**Decision**: They do not yet. `account:login_state`, `account:created`, `account:removed` are typed on `CapabilityEventBus` (`src/engines/capability-event-bus.ts`) and whitelisted in `src/automation/scheduler.ts`, but there is **no WebSocket forwarder** for them. Existing forwarders exist for `conversation:*`, `canvas:*`, `config:changed`, `kernel:oracle`.

**Rationale**: Mirroring the proven `registerConversationForwarder` pattern is the lowest-risk way to expose live account state. Frontends already subscribe via `{type:'subscribe', entityType, entityId}` and the event bus relays to `ws.send`.

**Alternatives considered**:
- Polling `GET /api/accounts` on an interval — rejected: violates SC-002 (<200ms) and wastes bandwidth; the event bus already exists.
- Custom WS topic protocol — rejected: diverges from the established subscribe/forward convention.

## R2 — Where does account data come from?

**Decision**: `SlaveSetupStore.listAccounts()` returns `SetupAccount {id, providerId, accountSlug, displayName, planTier, loginState, profileDir, debugPort, created_at, updated_at}`. Extend with `listAccountsWithLiveState()` that joins `providerAccount` last-login + a server-side Chrome liveness/session-health probe (reusing `/api/setup/verify` cookie-check logic). UI consumes the contract only.

**Rationale**: Honors Store Contracts (no raw Prisma in UI). The `SetupAccount` shape already covers most FR-002 fields; only `lastLoginAt` and `sessionHealth` need enrichment.

**Alternatives considered**:
- Read `ctx.db.prisma.providerAccount` directly in the route/UI — rejected: violates Store Contracts.

## R3 — How should quick actions be implemented?

**Decision**: Every action is a `UnifiedCapability` (One Entry Point). Reuse server endpoints in `setup-router.ts`:
- Launch/Reconnect → `/api/setup/launch-visible`
- Verify → `/api/setup/verify`
- Add / Re-login → `ChromeSetupWizard` flow (existing `src/engines/chrome-setup-wizard.ts` + `provider-setup-wizard.tsx`)
- Remove → new capability deleting the `providerAccount` row (emits `account:removed`)

NL patterns added in `catalog.ts` bound to each `capabilityId`; surfaced on cli/ui/api.

**Rationale**: Constitution mandates One Entry Point; existing endpoints already do the CDP work server-side (Governor Canon compliant).

**Alternatives considered**:
- Hardcoded UI button → direct fetch — rejected: violates One Entry Point and cross-surface parity.

## R4 — Frontend surface & icons

**Decision**: Render dashboard as a canvas layer (consistent with `canvas:layer:spawned`/`dismissed`) and/or a tab slot. Provider icons resolved via the existing provider-type conceptual model (`ProviderType` + `UiComponent` 4-tier resolution) — no hardcoded `if (slug)` branches.

**Rationale**: AGENTS.md frontend conventions; avoids legacy list duplication.

## R5 — Login-state vocabulary

**Decision**: Map `providerAccount.loginState` to three dashboard states:
- `authenticated` → green "Authenticated"
- `expired` / `logged_out` → amber warning badge "Session Expired" + Re-login
- never logged in (row exists, no successful login) → neutral "Never logged in"

**Rationale**: Matches FR-002's three required states and SC-004 (no blank fields).
