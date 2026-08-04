# Audit: Onboarding Flow

Reference extract from the full audit. See `01-AUDIT.md` for the complete findings.

## Three things called "onboarding"

| # | Name | Layer | Concern | Status |
|---|------|-------|---------|--------|
| A | **GuidedLanding** (chat-as-landing-page) | Frontend UI + missing `/api/setup/*` | User-facing first-run | UI complete, **backend routes missing** |
| B | **OnboardingTour** (spotlight walkthrough) | Frontend UI + `/api/onboarding/*` | Feature tour | UI complete, **shared types missing**, endpoints missing |
| C | **devops/onboard-*** | Backend CLI/devops | Provider auto-onboarding | Fully implemented, separate concern |

## End-to-end first-run journey

**Entry**: `/` → `page.tsx` → `CanvasApp` calls `checkNeedsSetup()` on mount → `GET /api/setup/profiles` → if empty, opens GuidedLanding (z=2000).

**GuidedLanding state machine**: `booting → awaiting_provider_pick → launching_chrome → awaiting_login → completing → done`

1. Agent types "Hey — I'm Vivim. I'll be your canvas." (typewriter, 60 cps)
2. Types second message with provider chips (ChatGPT, Claude, Gemini, DeepSeek, Grok, Qwen)
3. User picks → `POST /api/setup/launch-visible` → visible Chrome at login URL
4. Polls `POST /api/setup/verify` every 3s (max 5 min)
5. On login: `POST /api/setup/complete` + `POST /api/setup/kill` + `POST /api/conversations`
6. Fade-out → `onComplete(conv.id, provider.id)` → page.tsx closes overlay, refreshes

**OnboardingTour** (parallel, independent): fetches `/api/onboarding/state?userId=user:demo`. If null or has uncompleted steps, starts spotlight tour.

## State machines

**GuidedLanding** (not persisted): `booting | awaiting_provider_pick | launching_chrome | awaiting_login | completing | done | error`

**OnboardingTour** (persisted in MemoryOnboardingStore): `idle | entering | visible | exiting | completed | dismissed`

**Devops Onboard Ledger** (persisted to `.runtime/onboard-ledger.json`): `OnboardPhase = discover | infer | test-selectors | test-parse | test-cap | test-frontend | verify | converge`

## Persistence map

| What | Where | Survives restart? |
|---|---|---|
| GuidedLanding state | React `useState` only | ❌ (re-derived via `checkNeedsSetup()`) |
| OnboardingTour step completion | `MemoryOnboardingStore` | ❌ |
| OnboardingTour analytics (client) | `localStorage['vivim-tour-analytics']` (last 100) | ✅ per-browser |
| OnboardingTour analytics (server) | `/api/onboarding/analytics` — **doesn't exist** | ❌ |
| Devops onboard phase progress | `.runtime/onboard-ledger.json` | ✅ |
| Provider onboarding session | SQLite `provider_onboarding_session` | ✅ |

## Critical onboarding gaps

1. **`frontend/src/shared/onboarding.ts` does NOT exist.** 6 files import from it.
2. **`/api/setup/*` routes don't exist.** 6 endpoints called by frontend, all 404.
3. **`/api/onboarding/analytics` doesn't exist.** Analytics silently dropped.
4. **`/api/onboarding/complete-tour` doesn't exist.** Tour completion data lost.

## Moderate onboarding issues

5. Two competing onboarding systems mounted simultaneously on `page.tsx`.
6. `OnboardFlow` (`features/onboard-flow.tsx`) is dead code.
7. `MemoryOnboardingStore` is the only impl — no Prisma backing.
8. No `UserOnboarding` table in Prisma.
9. `shell.ts` `onboarding` CLI command is a stub.
10. `OnboardingTour` is always mounted with `userId="user:demo"` hardcoded.

## Minor onboarding issues

11. `detectProvider` exported as `_detectProvider` (line 975).
12. `OnboardingTour.onAction` prop is `() => {}` no-op in `page.tsx`.
13. `MemoryOnboardingStore.completeStep` sets `lastShownAt` (should be `lastCompletedAt`).
14. `useAnalytics` localStorage key not namespaced per user.
