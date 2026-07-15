# M-003: Provider Setup & Login

**Phase:** 100 (User-Centric Frontend)
**Status:** VERIFIED (2026-07-14)
**Priority:** P0

## User Story

> As a user, I want to connect my AI provider accounts (ChatGPT, Claude, Gemini) so the platform can use them.

## Moment Definition

**Entry State:** User opens app for first time, or clicks "Add Provider"
**Exit State:** Chrome opens visibly, user logs in, session detected via cookies, account saved to DB

## User Flow

```
1. User opens app → Setup Wizard appears (first run)
2. User selects workspace path → Continue
3. User picks provider (ChatGPT / Claude / Gemini) → Continue
4. User enters account nickname → "Open Chrome for Login"
5. Chrome window opens VISIBLE to provider login page
6. User logs in manually in Chrome
7. Auto-polling detects login via cookies (every 3s)
8. Account saved → "Setup Complete!"
9. User clicks "Continue to App"
```

## Visual State

```
┌─────────────────────────────────────────────────────┐
│           Provider Setup Wizard                     │
│                                                     │
│  ┌─────────────────────────────────────────────┐    │
│  │  A Chrome window should now be open to the  │    │
│  │  login page. Log in to chatgpt, then        │    │
│  │  return here.                               │    │
│  │                                             │    │
│  │  Profile: C:\...\chatgpt\user@gmail.com    │    │
│  │  PID: 5808                                  │    │
│  │  Port: 9222                                 │    │
│  │                                             │    │
│  │  ● Auto-checking for login every 3s...      │    │
│  │                                             │    │
│  │  [ Check Now ]                              │    │
│  └─────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────┘
```

## API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `POST /api/setup/launch-visible` | POST | Launch Chrome with visible window |
| `POST /api/setup/verify` | POST | Check login state via cookies/DOM |
| `POST /api/setup/complete` | POST | Save account to DB |
| `GET /api/setup/profiles` | GET | List all configured accounts |

## Login Detection (Cookie-Based)

Each provider uses specific cookies to detect login:

| Provider | Cookies Checked |
|----------|----------------|
| ChatGPT | `__Secure-next-auth.session-token`, `oai-did`, `__cf_bm` |
| Claude | `sessionKey`, `__cf_bm`, `fit_topsid` |
| Gemini | `SID`, `HSID`, `SSID`, `__Secure-1PSID` |

Detection priority:
1. Cookie check (most reliable)
2. DOM selector check with 3 retries (1s apart)
3. URL pattern fallback (least reliable)

## Component Spec

### ProviderSetupWizard
```tsx
// web/ui/src/features/provider-setup-wizard.tsx
// 5-step wizard: workspace → provider → account → login → done
// Auto-polls /api/setup/verify every 3s during login step
// Uses launchResult.debugPort (not hardcoded)
```

### Setup Router
```typescript
// src/server/setup-router.ts
// POST /api/setup/launch-visible — launches Chrome via launchChrome()
// POST /api/setup/verify — cookie-based detection via CDP
// POST /api/setup/complete — saves to provider_account table
// GET /api/setup/profiles — lists all accounts
```

### Chrome Launcher
```typescript
// src/executor/launcher.ts
// launchChrome({ visible: true }) → headed mode
// launchChrome({ visible: false }) → headless mode
// Uses detached: true for headed mode on Windows
// Waits for debug port to respond (15s timeout)
```

## Bugs Found & Fixed

| Bug | Root Cause | Fix |
|-----|-----------|-----|
| PowerShell scripts hang | Bun.spawn pipe handles block bash | Detached processes via .NET, no stream redirection |
| Login detection always true | URL pattern with empty URL | Cookie-based detection per provider |
| Chrome invisible on Windows | `--no-startup-window` added unconditionally | Removed for headed mode |
| CDP WebSocket fails | Missing UUID in URL | Fetch from `/json/version` |
| BigInt column mismatch | SQLite INTEGER vs Prisma BIGINT | Table recreation |

## Files

| File | Purpose |
|------|---------|
| `src/server/setup-router.ts` | REST API for setup wizard |
| `src/executor/launcher.ts` | Chrome launcher with profile isolation |
| `src/executor/cdp.ts` | CDP WebSocket client |
| `src/executor/chrome-instance-profile.ts` | Chrome args and profile config |
| `web/ui/src/features/provider-setup-wizard.tsx` | Frontend setup wizard |
| `scripts/start-all.ps1` | Service launcher (detached) |
| `scripts/stop-all.ps1` | Service teardown |
| `scripts/health-check.ps1` | Health monitor |

## Verification

```bash
# Check health
curl -s http://localhost:9420/health

# List profiles
curl -s http://localhost:9420/api/setup/profiles

# Launch Chrome for a provider
curl -s -X POST http://localhost:9420/api/setup/launch-visible \
  -H 'Content-Type: application/json' \
  -d '{"providerId":"chatgpt","accountSlug":"test","workspace":"C:\\.config\\vivim"}'

# Verify login state
curl -s -X POST http://localhost:9420/api/setup/verify \
  -H 'Content-Type: application/json' \
  -d '{"port":9222,"providerId":"chatgpt"}'
```
