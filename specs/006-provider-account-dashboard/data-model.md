# Data Model: Provider Account Dashboard

**Feature**: 006-provider-account-dashboard
**Date**: 2025-07-17

## Entities

### ProviderAccountSummary (dashboard view model)

| Field | Type | Source | Notes |
|-------|------|--------|-------|
| accountId | string | `providerAccount.id` (`${providerId}_${accountSlug}`) | Primary key |
| providerId | string | `providerAccount.providerId` | e.g. chatgpt, claude, gemini |
| providerName | string | ProviderType.displayName | Human label |
| providerIcon | string | ProviderType.icon (conceptual model) | Resolved via UiComponent tier |
| loginState | `'authenticated' \| 'expired' \| 'never_logged_in'` | derived from `providerAccount.loginState` | Mapped per research R5 |
| lastLoginAt | number \| null | `providerAccount.lastLoginAt` | null → "Never" |
| debugPort | number \| null | `providerAccount.debugPort` | null → "Not running" |
| sessionHealth | `'healthy' \| 'degraded' \| 'unknown'` | live Chrome probe | From `/api/setup/verify`-style check |

### AccountLiveEvent (WebSocket payloads)

```text
account:login_state  -> { type, accountId, loginState, lastLoginAt, debugPort, sessionHealth }
account:created      -> { type, accountId }
account:removed      -> { type, accountId }
```

## State Transitions

```text
never_logged_in --(setup complete / verify ok)--> authenticated
authenticated   --(CDP cookie check fails)------> expired
expired         --(re-login + verify ok)--------> authenticated
*              --(remove confirmed)------------> (account:removed)
```

## Validation Rules (from requirements)

- A card MUST never render an undefined field: null `lastLoginAt` → "Never", null `debugPort` → "Not running" (SC-004).
- Expired state MUST show warning badge + Re-login (FR-007, SC-005).
- `account:created` / `account:removed` MUST upsert/remove the card without page reload (FR-003).
