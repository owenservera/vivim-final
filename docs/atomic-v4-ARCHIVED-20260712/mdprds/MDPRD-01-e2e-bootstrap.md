# MDPRD-01: E2E Bootstrap & Login

**Phase:** 1 | **Units:** 7 | **Goal:** Get a user from zero to logged-in provider sessions

## Problem

The current server bootstrap (`createServerWithEngines`) creates a ChromeGovernor but never calls `setCdpTransport()`. This means `governor.cdp` throws at runtime, blocking every downstream operation. Additionally, the visible Chrome launched during setup (port 9222) doesn't match the headless slave ports (9300-9400), and there's no guarantee that login sessions persist into headless mode.

## User Story

> As a new user, I want to select my workspace folder, pick a provider (ChatGPT/Claude/Gemini), open Chrome, log in, and have my session saved so that subsequent conversations work without re-login.

## Success Criteria

1. `bun run dev` starts the server and all three provider seeds are loaded
2. The ProviderSetupWizard completes all 5 steps without error
3. After login, the account row is persisted with correct profileDir + debugPort
4. A headless Chrome spawned with the saved profile navigates to the provider URL and is already logged in
5. CDP transport is wired and `governor.cdp.send()` works for basic commands

## Architecture Changes

### CDP Transport Wiring (1.1)

```
createServerWithEngines()
  → governor = new ChromeGovernor(...)
  → transport = new CdpTransportImpl()
  → governor.setCdpTransport(transport)    // ← MISSING TODAY
  → governor.setTraceLog(govStore)
  → governor.setHealthMonitor(govStore)
  → governor.boot()
```

### Profile Lifecycle (1.3–1.7)

```
Setup (visible Chrome):
  workspace/{provider}/{account}/  ← ProfileAllocator creates dir
  Chrome --user-data-dir=workspace/{provider}/{account}/
  User logs in → cookies/session saved in profile dir
  POST /api/setup/complete → persist profileDir + port

Runtime (headless Chrome):
  FleetSupervisor.spawn(provider, account)
    → ProfileAllocator.getPath(provider, account) ← SAME PATH
    → launchChrome({ profileDir: samePath, headless: true })
    → Chrome loads saved cookies → already logged in
```

## Risk: Profile Port Mismatch

The setup wizard hardcodes port 9222 for visible Chrome. FleetSupervisor allocates ports from 9300-9400. This is **fine** because profiles are path-based, not port-based. The port is just for CDP communication. The key invariant: **ProfileAllocator.getPath() must return the same directory in both setup and runtime paths**.

Currently:
- Setup: `new ProfileAllocator(workspace).getPath(provider, account)`
- Runtime: `new ProfileAllocator(chromeProfileBase).allocate(provider, account)`

These use different base dirs unless `chromeProfileBase === workspace`. Unit 1.3 fixes this by persisting the workspace path and passing it to the Governor config.

## Dependencies

- `src/server/index.ts:createServerWithEngines` — wire CdpTransportImpl
- `src/executor/cdp-transport.ts:CdpTransportImpl` — already implemented
- `src/executor/profile-allocator.ts:ProfileAllocator` — already implemented
- `src/server/setup-router.ts` — minor fixes for profile path consistency
- `web/ui/src/features/provider-setup-wizard.tsx` — already functional

## Units

| Unit | Title | Key Files |
|------|-------|-----------|
| 1.1 | Wire CDP transport into ChromeGovernor bootstrap | `src/server/index.ts` |
| 1.2 | Provider seed pipeline at boot | `src/server/index.ts`, `src/engines/provider-registrar.ts` |
| 1.3 | Setup wizard workspace + profile path flow | `src/server/setup-router.ts` |
| 1.4 | Launch visible Chrome with correct profile | `src/server/setup-router.ts` |
| 1.5 | CDP-based login state verification | `src/server/setup-router.ts` |
| 1.6 | Complete setup: persist account | `src/server/setup-router.ts` |
| 1.7 | Headless slave reuse of saved login profile | `src/executor/fleet-supervisor.ts` |
