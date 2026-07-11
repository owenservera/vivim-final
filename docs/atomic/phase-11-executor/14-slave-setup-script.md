# Unit 11.12: Slave Setup Script

**Phase:** 11 | **File:** `scripts/setup-slaves.ts`
**Depends:** 11.2 Launcher | 11.3 Profile Allocator | 11.1 CDP Client
**Produces:** Standalone bootstrap script that spawns visible Chrome slaves with provider accounts logged in, persists profiles, and verifies headless reuse for real testing.
**Source:** New operational tooling (no port source). Drives `src/executor/launcher.ts` + `src/executor/cdp.ts` directly.

## Purpose
Bootstrap the initial "chrome slaves" with provider accounts already authenticated so the agent can run real end-to-end testing against them. For each target `(provider, account, loginUrl)` the script:

1. Launches a **visible** Chrome instance with a **persistent profile dir** at the exact path `ProfileAllocator` uses (`chrome-profiles/<provider>/<account>`), navigated to the provider login URL.
2. Blocks on the human to complete login (credentials + 2FA) — cookies persist in the profile dir.
3. Optionally verifies the session via CDP (`Target.getTargets` + `Network.getCookies`).
4. On the `--verify` path, kills the visible instance and relaunches **headless** reusing the same profile dir to prove the logged-in session survives, then health-checks via `Browser.getVersion`.

The profile path convention is chosen so that later `ChromeGovernor.spawn(provider, account)` (which routes through the same `ProfileAllocator.getPath`) reuses the authenticated session.

## Interface
```typescript
// scripts/setup-slaves.ts  (run: bun run scripts/setup-slaves.ts [--verify])
export interface SetupAccount {
  provider: string   // slug: 'chatgpt' | 'claude' | 'gemini'
  account: string    // account id, e.g. 'default'
  loginUrl: string   // provider login / landing URL
}

// Defaults (editable at top of script):
const ACCOUNTS: SetupAccount[] = [
  { provider: 'chatgpt', account: 'default', loginUrl: 'https://chat.openai.com/' },
  { provider: 'claude',  account: 'default', loginUrl: 'https://claude.ai/login' },
  { provider: 'gemini',  account: 'default', loginUrl: 'https://gemini.google.com/' },
]

// Per-account launch config:
interface SlaveLaunch {
  profileDir: string   // join('chrome-profiles', provider, account)  — matches ProfileAllocator
  debugPort: number    // unique port per account, allocated from 9222+
  pid: number
}
```

CLI:
- `bun run scripts/setup-slaves.ts` — spawn visible, wait for manual login (ENTER per account), then auto-relaunch headless to verify persistence.
- `bun run scripts/setup-slaves.ts --verify` — relaunch headless from existing profiles, confirm auth persists, no visible window.

## Required Capabilities
- Spawn visible Chrome via `launchChrome({ visible: true, profileDir, debugPort, extraArgs: [loginUrl] })`.
- Profile dir equals `ProfileAllocator.getPath(provider, account)` so `ChromeGovernor` reuses it.
- Unique `debugPort` per account (allocated from `9222+`, no collisions).
- Block on stdin until the human confirms login for each account.
- Verify via `BunCdpClient`: connect `ws://127.0.0.1:<port>/devtools/browser`, `Target.getTargets`, `Network.getCookies` (or detect URL left the login path).
- `--verify` path: `killChrome(pid)` then relaunch headless with same `profileDir`; `Browser.getVersion` health check; cookie check to confirm persisted auth.
- Clear per-account PASS/FAIL reporting and a final summary.

## Tests
- [ ] `bun run scripts/setup-slaves.ts --verify` relaunches headless and reports auth persisted for each seeded profile (after a manual login run).
- [ ] Each `chrome-profiles/<provider>/<account>` dir contains populated `Default/Cookies` / Local Storage after login.
- [ ] Headless relaunch from a logged-in profile does NOT redirect to the provider login page.

## Gate
- `bun run typecheck` passes (script must compile under project TS config).
- Manual smoke: run script, log in to each provider, confirm headless `--verify` reports PASS.
- No changes to engine/executor source — this is additive tooling only.

## Notes
- Does NOT implement `ChromeGovernor.cdp` (Phase 12.1). Uses `BunCdpClient` + `launchChrome` directly to avoid the stubbed CDP proxy and the DB dependency.
- DB prerequisite (`bun run migrate` + `bun run seed`) is needed only for later `ChromeGovernor`-based testing, not for this script.
- Avoid SingletonLock conflicts: visible instance is killed before the headless relaunch.
