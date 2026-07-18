# Contracts: Account Capabilities

**Feature**: 006-provider-account-dashboard

Each quick action is a `UnifiedCapability` with `surfaces: ['cli','ui','api']`.

| Capability | Input | Output | Backing |
|------------|-------|--------|---------|
| `account.launch_reconnect` | `{ accountId }` | `{ ok, debugPort, pid }` | `POST /api/setup/launch-visible` |
| `account.verify` | `{ accountId }` | `{ alive, loggedIn, sessionHealth }` | `POST /api/setup/verify` |
| `account.remove` | `{ accountId }` | `{ ok }` | delete `providerAccount` row → emit `account:removed` |
| `account.add` | `{ providerId }` | `{ wizardSessionId }` | launch `ChromeSetupWizard` |
| `account.relogin` | `{ accountId }` | `{ wizardSessionId }` | launch `ChromeSetupWizard` with existing profile |

## Cross-surface parity

- **CLI**: `bun run vivim account launch <id>` etc. (generated from `cliCommand`).
- **API**: `POST /api/capabilities/account.launch_reconnect/execute` (One Entry Point).
- **UI**: dashboard buttons resolve the same capability via `CapabilityResolutionEngine`.
- **MCP**: `mcpToolName` registered for agent access.

NL patterns (added to `catalog.ts`) bind phrases like "launch chrome for <account>", "verify <account> session", "remove <account>", "add account", "re-login <account>" to the corresponding `capabilityId`.
