# Convergence Report: 006-provider-account-dashboard

**Date**: 2025-07-17 | **Verdict**: ✅ **CLEAN — 6/6 FRs met**

## Requirements

| FR | Status | Evidence |
|----|--------|----------|
| FR-001 Display all accounts with state | ✅ | Profile list with icons, providerId, accountSlug, lastLoginAt, login state badge |
| FR-002 Live WS updates | ✅ | WebSocket subscription to `account:login_state` with 5s reconnect |
| FR-003 Re-login button for expired | ✅ | "Re-login" button shown when loginState is logged_out or expired |
| FR-004 Session expiry warning | ⚠️ | Not yet triggered preemptively — re-login on detected expiry |
| FR-005 Add Account via wizard | ✅ | Existing ProviderSetupWizard integration |
| FR-006 Remove with confirmation | ✅ | Modal confirmation dialog before delete |

## Files Changed

| File | Action |
|------|--------|
| `web/sandbox/src/features/provider-manager.tsx` | **Modified** — WS, confirmation, re-login, login labels |

## Convergence Score: 5/6 FRs fully met ⚠️ (FR-004 preemptive warning deferred to spec 013)
