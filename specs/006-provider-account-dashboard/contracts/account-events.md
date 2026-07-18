# Contracts: Provider Account Dashboard

**Feature**: 006-provider-account-dashboard
**Date**: 2025-07-17

## 1. WebSocket Account Event Contract (`contracts/account-events.md`)

### Subscription

Frontend opens the existing WebSocket and sends:

```json
{ "type": "subscribe", "entityType": "account", "entityId": "*" }
```

- `entityId: "*"` → receive all `account:*` events.
- `entityId: "<accountId>"` → receive only that account's `account:login_state`.

### Event Shapes (server → frontend)

```jsonc
// Status change for one account
{ "type": "account:login_state", "accountId": "chatgpt_alice",
  "loginState": "authenticated", "lastLoginAt": 1721200000000,
  "debugPort": 9222, "sessionHealth": "healthy" }

// New account added (e.g. via wizard)
{ "type": "account:created", "accountId": "claude_bob" }

// Account removed
{ "type": "account:removed", "accountId": "gemini_carol" }
```

### Reconciliation

On (re)subscribe, the server re-broadcasts current `account:login_state` for all accounts so a reconnecting client reconciles without a separate fetch. If the WS drops, the client retains last-known state and shows a disconnected indicator; on reconnect it re-subscribes and receives the full current state.

## 2. Account Capability Contract (`contracts/account-capabilities.md`)

Each quick action is a `UnifiedCapability` with `surfaces: ['cli','ui','api']`.

| Capability | Input | Output | Backing |
|------------|-------|--------|---------|
| `account.launch_reconnect` | `{ accountId }` | `{ ok, debugPort, pid }` | `POST /api/setup/launch-visible` |
| `account.verify` | `{ accountId }` | `{ alive, loggedIn, sessionHealth }` | `POST /api/setup/verify` |
| `account.remove` | `{ accountId }` | `{ ok }` | delete `providerAccount` row → emit `account:removed` |
| `account.add` | `{ providerId }` | `{ wizardSessionId }` | launch `ChromeSetupWizard` |
| `account.relogin` | `{ accountId }` | `{ wizardSessionId }` | launch `ChromeSetupWizard` with existing profile |

NL patterns (added to `catalog.ts`) bind phrases like "launch chrome for <account>", "verify <account> session", "remove <account>", "add account", "re-login <account>" to the corresponding `capabilityId`.
