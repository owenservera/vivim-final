# Quickstart Validation: Provider Account Dashboard

**Feature**: 006-provider-account-dashboard
**Date**: 2025-07-17

## Prerequisites

- `bun run db:setup` has been run (provider accounts seeded; if empty, run the ChromeSetupWizard once per provider).
- Stack running: `pwsh scripts/start-bg.ps1`.
- Backend engines + WebSocket server up (health check green).

## Validation Scenarios

### S1 — Accounts render (FR-001, FR-002, SC-001, SC-004)

1. Open the UI → navigate to the provider account dashboard (canvas layer / tab).
2. **Expected**: every `providerAccount` row renders a card with name, icon, login-state badge, last-login, debug port, session health.
3. Null fields show "Never" / "Not running" (no blanks).
4. All cards visible within ~1s.

### S2 — Live status update (FR-003, SC-002)

1. With dashboard open, force an account's session to expire (CDP cookie check fails) so `account:login_state` emits `expired`.
2. **Expected**: within ~200ms the card flips to amber "Session Expired" + Re-login button.

### S3 — Add Account (FR-008, SC-003, SC-006)

1. Click "Add Account" (one click).
2. **Expected**: ChromeSetupWizard launches; completing it emits `account:created` and a new card appears without reload.

### S4 — Remove Account (FR-006)

1. Click "Remove" on a card → confirmation dialog warns deletion removes profile.
2. Confirm → `account:removed` drops the card.

### S5 — Re-login / Verify (FR-004, FR-005, FR-007, FR-009, SC-005)

1. On an expired card click "Re-login" → wizard launches with existing profile.
2. On an authenticated card click "Verify Session" → session-health indicator refreshes.

## Commands

```powershell
pwsh scripts/start-bg.ps1
bun test tests/unit/engines/account tests/integration/account
bun run typecheck
bun run lint
bun run devops verify-cross-surface   # all 5 capabilities resolve cli/api/mcp/ui
```

## Notes

Implementation detail (tasks.md) belongs in the implementation phase; this guide only proves end-to-end behavior. Do not include full component bodies or migrations here.
